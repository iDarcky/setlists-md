// Shared helpers for the "Library plus" Labs features (songsLibraryPlus /
// setlistsLibraryPlus). Pure functions — call sites keep their own useMemo.
//
// Nothing here changes stored data shapes: everything is derived from the
// existing song/setlist/arrangement fields, so the flags are safe to toggle.

import { durationToSeconds } from './duration.js';
import { splitMulti } from './songFacets.js';
import { searchSetlists, normalizeText } from './search.js';

// --- Arrangement accessors (mirror the ones in Library/songFacets) -----------
export function defaultArrangement(song) {
  if (!Array.isArray(song?.arrangements)) return song || {};
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}

export function arrangementCount(song) {
  return Array.isArray(song?.arrangements) ? song.arrangements.length : 1;
}

// --- Song usage (how many setlists reference a song) -------------------------
// Returns Map<songId, count>. A setlist counts once per song even if the song
// appears twice in its items.
export function buildSongUsage(setlists) {
  const usage = new Map();
  for (const sl of setlists || []) {
    const seen = new Set();
    for (const item of sl.items || []) {
      const id = item?.songId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      usage.set(id, (usage.get(id) || 0) + 1);
    }
  }
  return usage;
}

// --- Duplicate-title detection ----------------------------------------------
// Returns Set<songId> for every song whose (normalized) title is shared by at
// least one other song. Empty titles are ignored.
export function duplicateTitleIds(songs) {
  const byTitle = new Map();
  for (const s of songs || []) {
    const t = normalizeText(s.title);
    if (!t) continue;
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t).push(s.id);
  }
  const dupes = new Set();
  for (const ids of byTitle.values()) {
    if (ids.length > 1) ids.forEach(id => dupes.add(id));
  }
  return dupes;
}

// --- Data-quality predicates (for the quick-filter chips) --------------------
export const DATA_QUALITY = {
  untagged: {
    label: 'Untagged',
    test: (s) => !(s.tags && s.tags.length),
  },
  noTempo: {
    label: 'No tempo',
    test: (s) => {
      const t = defaultArrangement(s).tempo ?? s.tempo;
      return !t || Number.isNaN(Number(t));
    },
  },
};

export function matchesDataQuality(song, active) {
  if (!active || active.length === 0) return true;
  // AND across active chips — each further narrows the list.
  return active.every(k => DATA_QUALITY[k]?.test(song));
}

// --- Setlist total duration --------------------------------------------------
// Sums the default-arrangement duration of each referenced song. Songs without
// a stored duration contribute 0 (we don't guess). `songMap` is Map<id, song>.
export function setlistDurationSeconds(setlist, songMap) {
  let total = 0;
  for (const item of setlist?.items || []) {
    if (!item?.songId) continue;
    const song = songMap.get(item.songId);
    if (!song) continue;
    // A per-item duration override wins if present, else the song default.
    const d = item.duration || defaultArrangement(song).duration;
    total += durationToSeconds(d);
  }
  return total;
}

// --- Setlist search including contained songs --------------------------------
// Runs the normal metadata search, then unions in any setlist whose items
// reference a song that matches the query (by title/artist). Order: metadata
// matches first (more relevant), then contained-song-only matches.
export function searchSetlistsPlus(setlists, songs, query) {
  const metaMatches = searchSetlists(setlists, query);
  const q = normalizeText(query);
  if (!q) return metaMatches;

  const tokens = q.split(/\s+/).filter(Boolean);
  const songById = new Map((songs || []).map(s => [s.id, s]));
  const matchesSong = (song) => {
    if (!song) return false;
    const hay = normalizeText(`${song.title || ''} ${song.artist || ''}`);
    return tokens.every(tok => hay.includes(tok));
  };

  const already = new Set(metaMatches);
  const extra = [];
  for (const sl of setlists || []) {
    if (already.has(sl)) continue;
    const hit = (sl.items || []).some(it => it.songId && matchesSong(songById.get(it.songId)));
    if (hit) extra.push(sl);
  }
  return [...metaMatches, ...extra];
}

// --- Column cell values (Songs table plus columns) ---------------------------
export function songColumnValue(song, id) {
  const arr = defaultArrangement(song);
  switch (id) {
    case 'ccli': return song.ccli || '';
    case 'year': return song.year ? String(song.year).trim() : '';
    case 'capo': return arr.capo ? String(arr.capo) : '';
    case 'duration': return arr.duration || '';
    case 'arrangements': return arrangementCount(song);
    case 'themes': return splitMulti(song.themes, song.genres);
    case 'language': return splitMulti(song.language);
    case 'scripture': return splitMulti(song.scripture);
    default: return '';
  }
}
