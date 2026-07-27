// Tracks how often each song has been performed in each key.
// Counts only setlists whose date is in the past — future and undated
// setlists are not "performances" and would otherwise inflate the data.
//
// Storage shape: each song carries a `keyHistory` object at the song level
// (NOT per-arrangement) of the form { 'G': 5, 'A': 3, 'Bb': 1 }. The key is
// the *resolved* performance key (arrangement.key + item.transpose), so a
// song with multiple arrangements still gets a single, comparable history.

import { transposeKey } from './music';
import { getArrangement } from './arrangements';

export function resolvedKeyForItem(item, song) {
  if (!item || !song) return null;
  const arr = getArrangement(song, item.arrangementId);
  if (!arr) return null;
  return transposeKey(arr.key, item.transpose || 0);
}

export function isPastSetlist(setlist, today = new Date()) {
  if (!setlist?.date) return false;
  // setlist.date is YYYY-MM-DD. Compare as strings to avoid TZ skew.
  const d = today instanceof Date ? today : new Date(today);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${day}`;
  return setlist.date <= todayStr;
}

// Recompute every song's keyHistory from scratch by scanning past-dated
// setlists. O(setlists × items). Pure function — returns a new map keyed by
// songId rather than mutating songs.
export function computeKeyHistories(songs, setlists, today = new Date()) {
  const out = {};
  for (const sl of setlists || []) {
    if (!isPastSetlist(sl, today)) continue;
    for (const it of sl.items || []) {
      if (it.type === 'break') continue;
      const song = songs.find(s => s.id === it.songId);
      if (!song) continue;
      const k = resolvedKeyForItem(it, song);
      if (!k) continue;
      out[song.id] ||= {};
      out[song.id][k] = (out[song.id][k] || 0) + 1;
    }
  }
  return out;
}

// Shallow { key: count } equality — histories are flat maps of small ints.
function historiesEqual(a, b) {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

// Reference-preserving: a song whose history is already up to date keeps its
// object identity. Downstream, reference identity is the "did it change?"
// signal for per-song IndexedDB writes, the sync engines' hash caches, and
// mid-sync edit detection (sync/adopt.js) — returning fresh objects for
// unchanged songs would rewrite the whole library on every launch and make
// every song look locally edited to a sync that was in flight.
export function applyKeyHistories(songs, histories) {
  let changed = false;
  const next = songs.map(s => {
    const h = histories[s.id] || {};
    if (historiesEqual(s.keyHistory, h)) return s;
    changed = true;
    return { ...s, keyHistory: h };
  });
  return changed ? next : songs;
}

// Diff two snapshots of a setlist and adjust per-song histories to reflect
// the change. Used by the save handler so we don't have to recompute the
// full history every time. Both snapshots may be null (creation/deletion).
export function incrementForSetlistDiff(songs, prev, next, today = new Date()) {
  const wasPast = prev && isPastSetlist(prev, today);
  const isPast = next && isPastSetlist(next, today);
  if (!wasPast && !isPast) return songs;

  const tally = {}; // songId → { key: deltaCount }
  const apply = (sl, sign) => {
    if (!sl) return;
    for (const it of sl.items || []) {
      if (it.type === 'break') continue;
      const song = songs.find(s => s.id === it.songId);
      if (!song) continue;
      const k = resolvedKeyForItem(it, song);
      if (!k) continue;
      tally[song.id] ||= {};
      tally[song.id][k] = (tally[song.id][k] || 0) + sign;
    }
  };
  if (wasPast) apply(prev, -1);
  if (isPast)  apply(next, +1);

  if (Object.keys(tally).length === 0) return songs;

  return songs.map(s => {
    const delta = tally[s.id];
    if (!delta) return s;
    const next = { ...(s.keyHistory || {}) };
    for (const [k, d] of Object.entries(delta)) {
      const v = (next[k] || 0) + d;
      if (v <= 0) delete next[k];
      else next[k] = v;
    }
    return { ...s, keyHistory: next };
  });
}

export function mostPlayedKey(keyHistory) {
  if (!keyHistory || typeof keyHistory !== 'object') return null;
  const entries = Object.entries(keyHistory);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function totalPlays(keyHistory) {
  if (!keyHistory || typeof keyHistory !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(keyHistory)) n += v;
  return n;
}
