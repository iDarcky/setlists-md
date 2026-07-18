// Setlist ↔ song reference integrity.
//
// THE PROBLEM: a setlist item references a song by `songId` (a snapshot taken
// when the item was added). When a song is later re-imported/replaced it gets a
// NEW id, and every past setlist that referenced the old id is orphaned — the
// item can't open the real chart, transpose, etc. (Newer items also store a
// `songTitle` fallback; older ones don't, which is why some orphans are
// unrecoverable.)
//
// THE FIX (two halves, both here):
//   1. `healSetlistLinks` — a reference-preserving pass run on load. For each
//      item whose `songId` no longer resolves but whose `songTitle` matches a
//      current song, it rewrites the `songId` (self-heal). It also backfills a
//      missing `songTitle` on items whose `songId` still resolves, so a FUTURE
//      id change stays recoverable.
//   2. `analyzeSetlistLinks` — a read-only classifier that powers the
//      Settings → Sync "Setlist links" diagnostic.
//
// Identity matching folds diacritics/punctuation via the shared search
// normalizer, so "Laudă" and "Lauda" match. Reference preservation matters:
// storage writes, both sync engines' hash caches, and sync/adopt's mid-sync
// edit detection all treat a NEW object reference as "this changed" — so an
// unchanged setlist/item MUST keep its identity or we reintroduce whole-library
// rewrites on launch (same contract as `applyKeyHistories`).

import { normalizeText } from '../lib/search';

// Build normalizedTitle → song. When two songs share a normalized title the
// index records `ambiguous: true` for that title so we never silently re-link
// to the wrong one (real within-team duplicates are ~never, but be safe).
export function buildTitleIndex(songs) {
  const map = new Map();
  for (const s of songs || []) {
    const key = normalizeText(s.title || '');
    if (!key) continue;
    const existing = map.get(key);
    if (existing) existing.ambiguous = true;
    else map.set(key, { song: s, ambiguous: false });
  }
  return map;
}

// Find a single unambiguous song for a title, or null.
export function matchSongByTitle(songs, title, index = null) {
  const key = normalizeText(title || '');
  if (!key) return null;
  const idx = index || buildTitleIndex(songs);
  const hit = idx.get(key);
  return hit && !hit.ambiguous ? hit.song : null;
}

// Classify one item against the current library. Pure; no mutation.
// Returns one of: 'break' | 'linked' | 'relinkable' | 'missing' | 'untitled'.
export function classifyItem(item, songById, titleIndex) {
  if (!item || item.type === 'break') return 'break';
  if (item.songId && songById.has(item.songId)) return 'linked';
  const key = normalizeText(item.songTitle || '');
  if (!key) return 'untitled'; // orphaned with no title fallback → unrecoverable from data
  const hit = titleIndex.get(key);
  if (hit && !hit.ambiguous) return 'relinkable';
  return 'missing'; // title present but no (unambiguous) song by that name
}

// Read-only health report for the current library's setlists.
export function analyzeSetlistLinks(setlists, songs) {
  const songById = new Map((songs || []).map(s => [s.id, s]));
  const titleIndex = buildTitleIndex(songs);
  const counts = { total: 0, linked: 0, relinkable: 0, missing: 0, untitled: 0 };
  const relinkable = [];
  const missing = [];
  const untitled = [];
  for (const sl of setlists || []) {
    for (const it of sl.items || []) {
      if (!it || it.type === 'break') continue;
      counts.total++;
      const kind = classifyItem(it, songById, titleIndex);
      counts[kind]++;
      const where = { setlist: sl.name || 'Untitled', date: sl.date || null, title: it.songTitle || null, songId: it.songId || null };
      if (kind === 'relinkable') relinkable.push(where);
      else if (kind === 'missing') missing.push(where);
      else if (kind === 'untitled') untitled.push(where);
    }
  }
  return { counts, relinkable, missing, untitled };
}

// Reference-preserving heal. Returns { setlists, relinked, backfilled }.
// `setlists` is the SAME array reference when nothing changed.
export function healSetlistLinks(setlists, songs) {
  const songById = new Map((songs || []).map(s => [s.id, s]));
  const titleIndex = buildTitleIndex(songs);
  let relinked = 0;
  let backfilled = 0;
  let anySetlistChanged = false;

  const nextSetlists = (setlists || []).map(sl => {
    let itemsChanged = false;
    const nextItems = (sl.items || []).map(it => {
      if (!it || it.type === 'break') return it;

      // Case A: songId still resolves → only backfill a missing title.
      if (it.songId && songById.has(it.songId)) {
        if (!it.songTitle) {
          const song = songById.get(it.songId);
          if (song?.title) { itemsChanged = true; backfilled++; return { ...it, songTitle: song.title }; }
        }
        return it;
      }

      // Case B: songId missing but title matches a current song → re-link.
      const match = matchSongByTitle(songs, it.songTitle, titleIndex);
      if (match) {
        itemsChanged = true;
        relinked++;
        return {
          ...it,
          songId: match.id,
          songTitle: match.title,
          arrangementId: match.defaultArrangementId || it.arrangementId,
        };
      }

      // Case C: unrecoverable (missing / untitled) → leave untouched.
      return it;
    });

    if (!itemsChanged) return sl;
    anySetlistChanged = true;
    return { ...sl, items: nextItems };
  });

  return {
    setlists: anySetlistChanged ? nextSetlists : setlists,
    relinked,
    backfilled,
  };
}
