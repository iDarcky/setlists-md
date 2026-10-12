// Tracks how fast each song has actually been played.
//
// The tempo twin of `keyHistory.js`, and it only became possible when a
// setlist item started recording its own tempo. The old objection — written
// into `features/reader/songInfo.js` — was that "most played tempo" would be
// one number repeated, because the only tempo field in the setlist editor
// wrote straight back to the SONG. The cards row (`SetlistCardRow`) writes
// `item.tempo` as a per-setlist OVERRIDE instead, so a past setlist now
// carries the tempo it was played at, the same way `item.transpose` carries
// the key.
//
// Storage shape: each song carries a `tempoHistory` object at the song level
// (NOT per-arrangement) of the form { '72': 5, '76': 2 }. The value is the
// *resolved* performance tempo — the item's override when it has one, else
// the arrangement's own tempo — so a song with several arrangements still
// gets a single, comparable history. Keys are strings because object keys
// always are; `mostPlayedTempo` hands back a number.

import { getArrangement } from './arrangements';
import {
  computeHistories,
  applyHistories,
  incrementForDiff,
  topEntry,
  totalCount,
} from './performanceHistory';

// A tempo is a positive whole number of beats per minute. `null`, `0`, ''
// and a half-typed value are all "nobody recorded a tempo" — counting them
// would put a `0 ×12` chip on the third of the library that has no BPM set.
export function normalizeTempo(value) {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!Number.isFinite(n)) return null;
  const bpm = Math.round(n);
  return bpm > 0 ? bpm : null;
}

export function resolvedTempoForItem(item, song) {
  if (!item || !song) return null;
  const override = normalizeTempo(item.tempo);
  if (override) return String(override);
  const arr = getArrangement(song, item.arrangementId);
  if (!arr) return null;
  const base = normalizeTempo(arr.tempo);
  return base ? String(base) : null;
}

export function computeTempoHistories(songs, setlists, today = new Date()) {
  return computeHistories(songs, setlists, resolvedTempoForItem, today);
}

export function applyTempoHistories(songs, histories) {
  return applyHistories(songs, histories, 'tempoHistory');
}

export function incrementTempoForSetlistDiff(songs, prev, next, today = new Date()) {
  return incrementForDiff(songs, prev, next, resolvedTempoForItem, 'tempoHistory', today);
}

export function mostPlayedTempo(tempoHistory) {
  const top = topEntry(tempoHistory);
  return top == null ? null : Number(top);
}

export function totalTempoPlays(tempoHistory) {
  return totalCount(tempoHistory);
}

// Ranked [bpm, count] pairs, fastest-climbing first, with the bpm as a NUMBER
// so a display site can sort or compare without re-parsing. Ties keep the
// most-played order; equal counts fall back to the slower tempo first, which
// is stable across recomputes (insertion order is not, once a history has
// been incremented rather than rebuilt).
export function rankedTempos(tempoHistory) {
  return Object.entries(tempoHistory || {})
    .map(([bpm, n]) => [Number(bpm), n])
    .filter(([bpm, n]) => Number.isFinite(bpm) && bpm > 0 && n > 0)
    .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
}

// "Is there anything here the song's own tempo does not already say?"
//
// One recorded tempo that equals the song's tempo is the bar's BPM printed a
// second time — `songInfo.js` calls that carelessness, and it is right. Two
// distinct tempos, or one that disagrees with the song, is a fact.
export function tempoHistoryIsInteresting(tempoHistory, songTempo) {
  const ranked = rankedTempos(tempoHistory);
  if (ranked.length === 0) return false;
  if (ranked.length > 1) return true;
  const base = normalizeTempo(songTempo);
  return base == null || ranked[0][0] !== base;
}
