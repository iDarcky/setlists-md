import { transposeKey } from '@/music';
import { resolveSongView } from '@/arrangements';
import { durationToSeconds } from '@/lib/duration';

// The setlist page's running order, worked out once for View, the run sheet and
// (later) Edit. Pure: no React, no clock of its own.

/** A song with no length counts as four minutes, and the total says "about". */
export const GUESS_SECONDS = 240;

function findSong(songs, item) {
  let s = songs.find(x => x.id === item.songId);
  if (!s && item.songTitle) s = songs.find(x => x.title === item.songTitle);
  return s ? resolveSongView(s, item.arrangementId) : null;
}

/** "10:00" + 125 s → "10:02" (wraps past midnight). */
export function addClock(hhmm, seconds) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const mins = (h * 60 + m + Math.round(seconds / 60)) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/**
 * @param {object} setlist  { items, time }
 * @param {Array} songs
 * @param {(userId) => string} [nameOf]  for "who leads"
 * @returns {{ rows, songCount, totalSeconds, estimated }}
 *   rows: { kind: 'song'|'moment', idx, n?, title, key?, tempo?, time?, leads?, note?, minutes?, startsAt?, missing? }
 */
export function buildOrder(setlist, songs = [], nameOf = () => '') {
  const rows = [];
  let n = 0;
  let elapsed = 0;
  let estimated = false;
  (setlist?.items || []).forEach((item, idx) => {
    const startsAt = addClock(setlist.time, elapsed);
    if (!item || item.type === 'break') {
      const minutes = item?.duration || 0;
      rows.push({ kind: 'moment', idx, title: item?.label || 'Moment', minutes, note: item?.note || '', startsAt });
      elapsed += minutes * 60;
      return;
    }
    n += 1;
    const song = findSong(songs, item);
    const secs = durationToSeconds(song?.duration);
    if (secs > 0) elapsed += secs; else { elapsed += GUESS_SECONDS; estimated = true; }
    rows.push({
      kind: 'song', idx, n, startsAt,
      songId: item.songId,
      missing: !song,
      title: song?.title || item.songTitle || 'Missing song',
      key: song ? transposeKey(song.key, item.transpose) : '',
      tempo: item.tempo ?? song?.tempo ?? null,
      time: song?.time || '',
      capo: item.capo || 0,
      leads: item.leadBy ? nameOf(item.leadBy) : '',
      note: item.note || '',
    });
  });
  return { rows, songCount: n, totalSeconds: elapsed, estimated };
}

/** "about 28 min" / "1 h 05" */
export function totalLabel(seconds, estimated) {
  const mins = Math.round(seconds / 60);
  const txt = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
  return estimated ? `about ${txt}` : txt;
}

/** Whole days from today to the setlist's date: 0 today, 1 tomorrow, negative past. */
export function daysAway(date, now = Date.now()) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(now); t.setHours(12, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

export function daysLabel(days) {
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

// ── Changed since Ready ─────────────────────────────────────────────────────
// Mark ready keeps a small copy of the order; the page compares against it so
// the band can see what moved after the leader said it was final.

/** What Mark ready stores on the setlist. */
export function readySnapshot(setlist) {
  return (setlist?.items || []).map(it => (it?.type === 'break'
    ? { type: 'break', label: it.label || '' }
    : { songId: it.songId, title: it.songTitle || '', transpose: it.transpose || 0 }));
}

/**
 * Lines like "Added Living Hope", "Way Maker now in F", "Order changed".
 * Empty when nothing changed or the setlist was never marked ready.
 */
export function changesSinceReady(setlist, songs = []) {
  const before = setlist?.readyItems;
  if (setlist?.status !== 'ready' || !Array.isArray(before)) return [];
  const now = readySnapshot(setlist);
  const title = (x) => songs.find(s => s.id === x.songId)?.title || x.title || 'a song';
  const ids = (xs) => xs.filter(x => x.songId).map(x => x.songId);
  const was = ids(before), is = ids(now);
  const out = [];
  for (const x of now) if (x.songId && !was.includes(x.songId)) out.push(`Added ${title(x)}`);
  for (const x of before) if (x.songId && !is.includes(x.songId)) out.push(`Removed ${title(x)}`);
  for (const x of now) {
    const old = x.songId && before.find(b => b.songId === x.songId);
    if (old && (old.transpose || 0) !== (x.transpose || 0)) {
      const base = resolveSongView(songs.find(s => s.id === x.songId))?.key;
      out.push(base ? `${title(x)} now in ${transposeKey(base, x.transpose || 0)}` : `${title(x)} changed key`);
    }
  }
  const kept = was.filter(id => is.includes(id));
  if (kept.join() !== is.filter(id => was.includes(id)).join()) out.push('Order changed');
  const moments = (xs) => xs.filter(x => x.type === 'break').map(x => x.label).join('|');
  if (moments(before) !== moments(now)) out.push('Moments changed');
  return out;
}
