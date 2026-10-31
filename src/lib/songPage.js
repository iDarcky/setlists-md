// What the song page shows about one song, worked out from the setlists.
// Pure: Song.jsx feeds app state, /design and the tests feed samples.

import { playStats } from './songsData';
import { isSetlistUpcoming, setlistStartMs } from './setlistTime';
import { mostPlayedKey } from '@/keyHistory';
import { compactLabel } from '@/music';

const short = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const dayLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * → { plays, last ("18 Oct" | null), usualKey, next: { setlist, label, name, position } | null }
 * `position` counts songs only (a moment between songs is not "song 3").
 */
export function songFacts(song, setlists = [], now = Date.now()) {
  if (!song) return { plays: 0, last: null, usualKey: '', next: null };
  const stat = playStats(setlists, now)[song.id];
  const sl = setlists
    .filter(s => s.date && isSetlistUpcoming(s, now) && (s.items || []).some(it => it?.songId === song.id))
    .sort((a, b) => setlistStartMs(a) - setlistStartMs(b))[0];
  let next = null;
  if (sl) {
    const songs = (sl.items || []).filter(it => it?.type !== 'break' && it?.songId);
    next = {
      setlist: sl,
      label: dayLabel(sl.date),
      name: sl.name || sl.title || 'Service',
      position: songs.findIndex(it => it.songId === song.id) + 1,
    };
  }
  return {
    plays: stat?.plays || 0,
    last: stat?.last ? short(stat.last) : null,
    usualKey: mostPlayedKey(song.keyHistory) || '',
    next,
  };
}

/** The play order as short codes for "How it goes": I, V1, C, V2 … */
export const flowCodes = (ordered = [], customTypes = null) =>
  ordered.map(sec => compactLabel(String(sec?.type || ''), customTypes));
