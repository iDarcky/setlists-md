// Unified "ultra search" for songs and setlists.
//
// One shared engine so every search bar (Library, the mobile global search,
// Setlists, the setlist song picker) behaves identically:
//   1. Diacritic-insensitive — `Laudă` is found by typing `lauda` (matters for
//      the RO/HU audience). See normalizeText().
//   2. Multi-field — searches title, original title, artist, writers, album,
//      tags, themes, scripture, key, arrangement names, … not just title/artist.
//   3. Hybrid matching — a precise diacritic-folded substring pass first, with
//      fuse.js fuzzy matching as a *ranked fallback* only when the exact pass
//      finds little and the query is long enough. This gives typo tolerance
//      ("amazin grce" → "Amazing Grace") without everyday fuzzy noise.
//
// Pure functions (no React) — callers keep their own useMemo/useDeferredValue.
// Records and the Fuse index are memoized per input-array reference via WeakMap,
// so typing doesn't rebuild the index every keystroke (the array identity is
// stable between renders unless the underlying data actually changes).

import Fuse from 'fuse.js';
import { EXTRA_META_KEYS } from '../parser.js';

// Standalone letters that NFD does NOT decompose (they aren't a base letter +
// combining diacritic), so we transliterate them explicitly. Covers German,
// Nordic, and Slavic letters that worship libraries run into.
const TRANSLIT = {
  ß: 'ss', ẞ: 'ss',
  ø: 'o', Ø: 'o',
  æ: 'ae', Æ: 'ae',
  œ: 'oe', Œ: 'oe',
  ł: 'l', Ł: 'l',
  đ: 'd', Đ: 'd', ð: 'd', Ð: 'd',
  þ: 'th', Þ: 'th',
  ı: 'i', ŀ: 'l',
};
const TRANSLIT_RE = new RegExp(`[${Object.keys(TRANSLIT).join('')}]`, 'g');

// Fold to a diacritic-free, punctuation-free, lowercased form for matching.
// `José → jose`, `Laudă → lauda`, `Țară → tara`, `groß → gross`.
// Punctuation is collapsed to spaces so "Holy, Holy, Holy" and "holy holy holy"
// match either way; apostrophes are dropped so "Mary's" ~ "marys".
export function normalizeText(str) {
  return String(str ?? '')
    .replace(TRANSLIT_RE, ch => TRANSLIT[ch])
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’`´]/g, '')          // drop apostrophes (possessives/contractions)
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // any other punctuation/symbol → space
    .trim();
}

// Quick lookup of the extended descriptive fields stored at song level
// (all lowercase keys — see EXTRA_META_FIELDS in parser.js).
const extra = (song, key) => song[key] ?? '';

// Build the per-song search record once: a weighted list of normalized field
// values for the exact pass + ranking, plus grouped strings for the Fuse index.
function songRecord(song) {
  const arrangements = Array.isArray(song.arrangements) ? song.arrangements : null;
  const arrNames = arrangements
    ? arrangements.map(a => a.name).filter(Boolean)
    : (song._arrangementName ? [song._arrangementName] : []);
  const keys = arrangements
    ? arrangements.map(a => a.key).filter(Boolean)
    : (song.key ? [song.key] : []);

  // [weight, rawValue] — higher weight = more relevant when matched.
  const fields = [
    [1.0, song.title],
    [0.9, extra(song, 'originaltitle')],
    [0.8, song.artist],
    // medium
    [0.5, extra(song, 'writers')],
    [0.5, extra(song, 'translator')],
    [0.5, extra(song, 'publishers')],
    [0.5, extra(song, 'album')],
    [0.5, extra(song, 'label')],
    [0.5, (song.tags || []).join(' ')],
    [0.5, arrNames.join(' ')],
    // low
    [0.2, song.ccli],
    [0.2, extra(song, 'themes')],
    [0.2, extra(song, 'genres')],
    [0.2, extra(song, 'scripture')],
    [0.2, extra(song, 'language')],
    [0.2, extra(song, 'year')],
    [0.2, extra(song, 'copyright')],
    [0.2, extra(song, 'vocalrange')],
    [0.2, extra(song, 'moment')],
    [0.2, extra(song, 'story')],
    [0.2, keys.join(' ')],
  ];

  const norm = fields
    .map(([w, v]) => [w, normalizeText(v)])
    .filter(([, v]) => v);

  return {
    ref: song,
    norm,
    // Grouped, pre-normalized strings keyed for Fuse field weighting.
    title: normalizeText(song.title),
    originaltitle: normalizeText(extra(song, 'originaltitle')),
    artist: normalizeText(song.artist),
    mid: norm.filter(([w]) => w === 0.5).map(([, v]) => v).join(' '),
    low: norm.filter(([w]) => w === 0.2).map(([, v]) => v).join(' '),
  };
}

function setlistRecord(setlist) {
  const fields = [
    [1.0, setlist.name],
    [0.6, setlist.service],
    [0.4, (setlist.tags || []).join(' ')],
  ];
  const norm = fields
    .map(([w, v]) => [w, normalizeText(v)])
    .filter(([, v]) => v);
  return {
    ref: setlist,
    norm,
    name: normalizeText(setlist.name),
    service: normalizeText(setlist.service),
    tags: normalizeText((setlist.tags || []).join(' ')),
  };
}

// Score an item against all query tokens. Every token must appear in at least
// one field (AND across tokens, OR across fields). Returns null on no match.
function exactScore(rec, tokens) {
  let score = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const [w, v] of rec.norm) {
      if (v.includes(tok)) {
        // Prefix hits (start of a field) rank above mid-string hits.
        const s = v.startsWith(tok) ? w * 1.5 : w;
        if (s > best) best = s;
      }
    }
    if (best === 0) return null;
    score += best;
  }
  return score;
}

const SONG_FUSE_KEYS = [
  { name: 'title', weight: 1.0 },
  { name: 'originaltitle', weight: 0.9 },
  { name: 'artist', weight: 0.8 },
  { name: 'mid', weight: 0.5 },
  { name: 'low', weight: 0.2 },
];

const SETLIST_FUSE_KEYS = [
  { name: 'name', weight: 1.0 },
  { name: 'service', weight: 0.6 },
  { name: 'tags', weight: 0.4 },
];

const FUSE_OPTIONS = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
};

// Per-array memo caches — keyed by the songs/setlists array reference.
const recordsCache = new WeakMap();
const fuseCache = new WeakMap();

function getRecords(items, build) {
  let recs = recordsCache.get(items);
  if (!recs) {
    recs = items.map(build);
    recordsCache.set(items, recs);
  }
  return recs;
}

function getFuse(items, records, keys) {
  let fuse = fuseCache.get(items);
  if (!fuse) {
    fuse = new Fuse(records, { ...FUSE_OPTIONS, keys });
    fuseCache.set(items, fuse);
  }
  return fuse;
}

// Shared hybrid engine. Returns matched `items` ranked by relevance.
function runSearch(items, query, build, fuseKeys, limit) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const q = normalizeText(query);
  if (!q) return limit ? items.slice(0, limit) : items;

  const tokens = q.split(/\s+/).filter(Boolean);
  const records = getRecords(items, build);

  // 1. Exact (diacritic-folded substring) pass.
  const exact = [];
  const seen = new Set();
  for (const rec of records) {
    const score = exactScore(rec, tokens);
    if (score != null) {
      exact.push({ ref: rec.ref, score });
      seen.add(rec.ref);
    }
  }
  exact.sort((a, b) => b.score - a.score);
  const out = exact.map(e => e.ref);

  // 2. Fuzzy fallback — only for longer queries when exact found little.
  if (q.length >= 3 && exact.length < 5) {
    const fuse = getFuse(items, records, fuseKeys);
    for (const hit of fuse.search(q)) {
      if (!seen.has(hit.item.ref)) {
        seen.add(hit.item.ref);
        out.push(hit.item.ref);
      }
    }
  }

  return limit ? out.slice(0, limit) : out;
}

export function searchSongs(songs, query, { limit } = {}) {
  return runSearch(songs, query, songRecord, SONG_FUSE_KEYS, limit);
}

export function searchSetlists(setlists, query, { limit } = {}) {
  return runSearch(setlists, query, setlistRecord, SETLIST_FUSE_KEYS, limit);
}

// Fold a single character the same way normalizeText folds whole strings, so a
// match found in folded text can be mapped back onto the original (accented)
// characters for highlighting.
function foldChar(ch) {
  return (TRANSLIT[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’`´]/g, '');
}

// Split `text` into segments flagged for highlighting against `query`. Matching
// is diacritic-/punctuation-insensitive, consistent with searchSongs, but the
// returned segments slice the ORIGINAL text so accents render intact.
// Returns [{ text, hit }] — `hit: true` marks the matched spans.
export function highlightSegments(text, query) {
  const str = String(text ?? '');
  const q = normalizeText(query);
  if (!str || !q) return [{ text: str, hit: false }];
  const tokens = q.split(' ').filter(Boolean);

  // Folded string + a map from each folded char back to its original index.
  let folded = '';
  const map = [];
  for (let i = 0; i < str.length; i++) {
    const f = foldChar(str[i]);
    for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i); }
  }

  const ranges = [];
  for (const tok of tokens) {
    let from = 0;
    let idx;
    while ((idx = folded.indexOf(tok, from)) !== -1) {
      ranges.push([map[idx], map[idx + tok.length - 1] + 1]);
      from = idx + tok.length;
    }
  }
  if (ranges.length === 0) return [{ text: str, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const segs = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) segs.push({ text: str.slice(pos, s), hit: false });
    segs.push({ text: str.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < str.length) segs.push({ text: str.slice(pos), hit: false });
  return segs;
}
