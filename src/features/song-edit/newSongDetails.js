// Pure helpers for the new-song details form (NewSongForm.jsx).
import { songKey } from '@/lib/songsData';
import { songFromFlat } from '@/arrangements';
import { generateId } from '@/parser';

/** Every artist in the library, most used first. "A, B" counts as two. */
export function libraryArtists(songs = []) {
  const count = new Map();
  for (const x of songs) for (const part of String(x?.artist || '').split(',')) { const a = part.trim(); if (a && a !== 'Unknown') count.set(a, (count.get(a) || 0) + 1); }
  return [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b));
}

/** What is still missing, as words ("a key and a BPM"), or null when ready. */
export function detailsMissing(d) {
  const need = [!d.title?.trim() && 'a name', !d.artist?.trim() && 'an artist', !d.key && 'a key', !d.tempo && 'a BPM'].filter(Boolean);
  if (!need.length) return null;
  return need.length > 1 ? `${need.slice(0, -1).join(', ')} and ${need.at(-1)}` : need[0];
}

// Most worship songs are 4/4, so the chip starts there.
export const EMPTY_DETAILS = { title: '', artist: '', key: '', tempo: null, time: '4/4' };


/** "You already have Oceans by Hillsong United, in D." */
export function sameSongLine(song) {
  const k = songKey(song);
  return `You already have ${song.title}${song.artist ? ` by ${song.artist}` : ''}${k ? `, in ${k}` : ''}.`;
}

/** A new, empty song from the details sheet, ready for the chart page. */
export function songFromDetails(d = {}) {
  const song = songFromFlat({ id: generateId() });
  const a = song.arrangements[0];
  song.title = (d.title || '').trim();
  song.artist = (d.artist || '').trim();
  a.name = 'Main';
  a.key = d.key || '';
  if (d.tempo) a.tempo = d.tempo;
  if (d.time) a.time = d.time.trim();
  return song;
}
