// Shared chord-suggestion helpers for the Arrange editors (current + V2).
//
// Recents are persisted per song-key under one localStorage bucket so the
// palette/autocomplete remembers what you actually use. Tokens are validated
// against the importer's chord regex so non-chords (e.g. "[Intro]", "[Verse]")
// can never leak into suggestions.

import { isChordToken } from '@/importer';

export { isChordToken };

const RECENTS_KEY = 'setlists-md:recent-chords';
const MAX_RECENTS = 12;

export function loadRecents(key) {
  try {
    const all = JSON.parse(localStorage.getItem(RECENTS_KEY) || '{}');
    const list = all[key || 'C'];
    return Array.isArray(list) ? list.filter(isChordToken) : [];
  } catch {
    return [];
  }
}

export function saveRecents(key, list) {
  try {
    const all = JSON.parse(localStorage.getItem(RECENTS_KEY) || '{}');
    all[key || 'C'] = list.slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(all));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

// Merge a recents list with a fresh chord, newest-first, de-duped, capped.
export function pushRecent(list, chord) {
  if (!isChordToken(chord)) return list;
  return [chord, ...list.filter(c => c !== chord)].slice(0, MAX_RECENTS);
}
