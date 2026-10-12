// Tracks how often each song has been performed in each key.
// Counts only setlists whose date is in the past — future and undated
// setlists are not "performances" and would otherwise inflate the data.
//
// Storage shape: each song carries a `keyHistory` object at the song level
// (NOT per-arrangement) of the form { 'G': 5, 'A': 3, 'Bb': 1 }. The key is
// the *resolved* performance key (arrangement.key + item.transpose), so a
// song with multiple arrangements still gets a single, comparable history.
//
// The walk, the reference-preserving apply and the save-time diff live in
// `performanceHistory.js`, shared with `tempoHistory.js`. This file is only
// the answer to "what key was that?".

import { transposeKey } from './music';
import { getArrangement } from './arrangements';
import {
  isPastSetlist,
  computeHistories,
  applyHistories,
  incrementForDiff,
  topEntry,
  totalCount,
} from './performanceHistory';

export { isPastSetlist };

export function resolvedKeyForItem(item, song) {
  if (!item || !song) return null;
  const arr = getArrangement(song, item.arrangementId);
  if (!arr) return null;
  return transposeKey(arr.key, item.transpose || 0);
}

export function computeKeyHistories(songs, setlists, today = new Date()) {
  return computeHistories(songs, setlists, resolvedKeyForItem, today);
}

export function applyKeyHistories(songs, histories) {
  return applyHistories(songs, histories, 'keyHistory');
}

export function incrementForSetlistDiff(songs, prev, next, today = new Date()) {
  return incrementForDiff(songs, prev, next, resolvedKeyForItem, 'keyHistory', today);
}

export function mostPlayedKey(keyHistory) {
  return topEntry(keyHistory);
}

export function totalPlays(keyHistory) {
  return totalCount(keyHistory);
}
