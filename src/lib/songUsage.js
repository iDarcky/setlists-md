// Song usage: what the church played, when, and which leader planned it.
// Pure: TeamScreen feeds app state, /design and the tests feed samples.
//
// "Played" = a song in a setlist whose date has passed (the same rule as the
// key and tempo histories). "Planned by" = the person who made the setlist
// (`setlist.createdBy`), which is what the user means by "the leader".

import { isPastSetlist } from '@/performanceHistory';
import { resolvedKeyForItem } from '@/keyHistory';

export const USAGE_RANGES = [
  { id: '1m', label: 'Last month', months: 1 },
  { id: '3m', label: 'Last 3 months', months: 3 },
  { id: '6m', label: 'Last 6 months', months: 6 },
  { id: '12m', label: 'Last year', months: 12 },
  { id: 'all', label: 'All time', months: null },
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The first day counted for a range id, as YYYY-MM-DD, or null for all time. */
export function rangeStart(rangeId, today = new Date()) {
  const r = USAGE_RANGES.find(x => x.id === rangeId);
  if (!r?.months) return null;
  // 31 Oct minus a month is 30 Sep, not 1 Oct: clamp to the month's last day.
  const first = new Date(today.getFullYear(), today.getMonth() - r.months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const d = new Date(first.getFullYear(), first.getMonth(), Math.min(today.getDate(), last));
  return ymd(d);
}

/** "26 Oct" */
export const shortDate = (date) => (date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

/**
 * → {
 *   services: [{ id, date, name, service, leaderId, songs: [{ songId, title, key }] }]  newest first
 *   songs:    [{ songId, title, plays, last, keys: {A: 3}, leaders: {uid: 2}, history: [{ setlistId, date, name, service, leaderId, key }] }]
 *             most played first, then most recent
 *   totals:   { services, songs, newSongs }
 *   serviceNames: [...], leaderIds: [...]   what the filters can offer (unfiltered)
 * }
 * `newSongs` counts songs whose first play ever falls inside the range.
 */
export function songUsage(setlists = [], songs = [], { range = '3m', service = 'all', leader = 'all', today = new Date() } = {}) {
  const from = rangeStart(range, today);
  const byId = new Map((songs || []).filter(Boolean).map(s => [s.id, s]));
  const past = (setlists || []).filter(sl => sl && isPastSetlist(sl, today));

  const firstPlayed = {};
  const serviceNames = new Set();
  const leaderIds = new Set();
  for (const sl of past) {
    if (sl.service) serviceNames.add(sl.service);
    if (sl.createdBy) leaderIds.add(sl.createdBy);
    for (const it of sl.items || []) {
      if (!it?.songId || it.type === 'break') continue;
      if (!firstPlayed[it.songId] || sl.date < firstPlayed[it.songId]) firstPlayed[it.songId] = sl.date;
    }
  }

  const picked = past
    .filter(sl => !from || sl.date >= from)
    .filter(sl => service === 'all' || (sl.service || '') === service)
    .filter(sl => leader === 'all' || (sl.createdBy || '') === leader)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

  const agg = new Map();
  const services = picked.map(sl => {
    const rows = [];
    for (const it of sl.items || []) {
      if (!it?.songId || it.type === 'break') continue;
      const song = byId.get(it.songId);
      const title = song?.title || it.songTitle || 'Missing song';
      const key = song ? (resolvedKeyForItem(it, song) || '') : '';
      rows.push({ songId: it.songId, title, key });
      let a = agg.get(it.songId);
      if (!a) {
        a = { songId: it.songId, title, plays: 0, last: null, keys: {}, leaders: {}, history: [] };
        agg.set(it.songId, a);
      }
      a.plays += 1;
      if (!a.last || sl.date > a.last) a.last = sl.date;
      if (key) a.keys[key] = (a.keys[key] || 0) + 1;
      if (sl.createdBy) a.leaders[sl.createdBy] = (a.leaders[sl.createdBy] || 0) + 1;
      a.history.push({ setlistId: sl.id, date: sl.date, name: sl.name || 'Service', service: sl.service || '', leaderId: sl.createdBy || '', leaderName: sl.createdByName || '', key });
    }
    return { id: sl.id, date: sl.date, name: sl.name || 'Service', service: sl.service || '', leaderId: sl.createdBy || '', leaderName: sl.createdByName || '', songs: rows };
  });

  const songRows = [...agg.values()].sort((a, b) => b.plays - a.plays || (b.last || '').localeCompare(a.last || '') || a.title.localeCompare(b.title));
  const newSongs = songRows.filter(s => firstPlayed[s.songId] && (!from || firstPlayed[s.songId] >= from)).length;

  return {
    services,
    songs: songRows,
    totals: { services: services.length, songs: songRows.length, newSongs },
    serviceNames: [...serviceNames].sort(),
    leaderIds: [...leaderIds],
  };
}

/** The key a song was played in most, or ''. */
export const usualKey = (keys = {}) => Object.entries(keys).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

/** "Ana 6 · Daniel 3": who planned it, most first. */
export const leaderSplit = (leaders = {}, nameOf = (id) => id) =>
  Object.entries(leaders).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ');
