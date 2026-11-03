import { resolveSongView } from '@/arrangements';
import { playStats } from '@/lib/songsData';

// "Suggested" in Add a song: a few songs that fit this slot, each with the
// reason it is there. Signals (owner, 2026-10-26): not played in a while, not
// played last week, the key follows on from the song before, the tempo
// changes pace, and at most one new song per setlist.

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const DAY = 86400000;

function pitch(key) {
  if (!key) return null;
  const m = String(key).match(/^([A-G][#b]?)/);
  if (!m) return null;
  return NOTES.indexOf(FLAT[m[1]] || m[1]);
}

/** Keys a fifth apart, the same key, or relative — they follow on without a jolt. */
export function keysFlow(a, b) {
  const x = pitch(a), y = pitch(b);
  if (x == null || y == null) return false;
  const d = (y - x + 12) % 12;
  return d === 0 || d === 5 || d === 7 || d === 2 || d === 10;
}

/**
 * @param {object} p
 * @param {Array} p.songs           the library
 * @param {object} p.setlist        the one being edited
 * @param {Array} p.setlists        every setlist (for play counts and last week)
 * @param {number} p.at             index the new song goes in at
 * @param {number} [p.limit=3]
 * @returns {Array<{ song, why }>}
 */
export function suggestSongs({ songs = [], setlist, setlists = [], at, now = Date.now(), limit = 3 }) {
  const items = setlist?.items || [];
  const inSet = new Set(items.map(it => it?.songId).filter(Boolean));
  const stats = playStats(setlists, now);
  const newCount = items.filter(it => it?.songId && !stats[it.songId]).length;
  const prevItem = [...items.slice(0, at)].reverse().find(it => it?.songId);
  const prev = prevItem ? songs.find(s => s.id === prevItem.songId) : null;
  const prevView = prev ? resolveSongView(prev, prevItem.arrangementId) : null;

  // Songs on any setlist in the 8 days before this one.
  const day = setlist?.date ? new Date(`${setlist.date}T12:00:00`).getTime() : now;
  const lastWeek = new Set();
  for (const sl of setlists) {
    if (sl.id === setlist?.id || !sl.date) continue;
    const t = new Date(`${sl.date}T12:00:00`).getTime();
    if (t < day && day - t <= 8 * DAY) for (const it of sl.items || []) if (it?.songId) lastWeek.add(it.songId);
  }

  const scored = [];
  for (const s of songs) {
    if (inSet.has(s.id) || lastWeek.has(s.id)) continue;
    const v = resolveSongView(s);
    const st = stats[s.id];
    if (!st && newCount >= 1) continue;
    let score = 0;
    let why = '';
    if (!st) { score += 1; why = 'New, not played yet'; }
    else if (st.last) {
      const weeks = Math.floor((day - new Date(`${st.last}T12:00:00`).getTime()) / (7 * DAY));
      if (weeks >= 8) { score += 2 + Math.min(weeks / 8, 2); why = weeks >= 9 * 4 ? 'Not played in over 6 months' : `Not played in ${Math.round(weeks / 4.3)} months`; }
      score += Math.min(st.plays, 6) / 6; // the team knows it
    }
    if (prevView) {
      if (keysFlow(prevView.key, v?.key)) { score += 1.5; if (!why) why = `Fits after ${prevView.title} (${prevView.key} → ${v.key})`; }
      const a = Number(prevView.tempo), b = Number(v?.tempo);
      if (a && b && Math.abs(a - b) >= 15) { score += 0.75; if (!why) why = b < a ? 'Slows things down after the last song' : 'Lifts the pace after the last song'; }
    }
    if (!why) continue;
    scored.push({ song: s, why, score });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit).map(({ song, why }) => ({ song, why }));
}
