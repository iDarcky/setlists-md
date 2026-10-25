// What the Songs page shows, worked out from the library and the setlists.
// Pure: Songs.jsx feeds app state, the tests feed fixtures.

import { isPastSetlist } from '@/performanceHistory';
import { isSetlistUpcoming, setlistStartMs } from './setlistTime';
import { songFacetValues, tempoBucket, keyRank } from './songFacets';

/** A song not played for this long gets the gold "Not played in …" note. */
export const STALE_DAYS = 120;
const DAY = 86400000;

function defaultArrangement(song) {
  const arrs = song?.arrangements;
  if (!Array.isArray(arrs) || !arrs.length) return song || {};
  return arrs.find(a => a.id === song.defaultArrangementId) || arrs[0];
}
export const songKey = (song) => defaultArrangement(song).key || '';
export const songTempo = (song) => defaultArrangement(song).tempo || null;

/**
 * How often each song was played and when last, from past-dated setlists.
 * A song twice in one setlist counts once. → { [songId]: { plays, last } }
 */
export function playStats(setlists = [], now = Date.now()) {
  const out = {};
  for (const sl of setlists) {
    if (!isPastSetlist(sl, new Date(now))) continue;
    const ids = new Set((sl.items || []).filter(it => it?.type !== 'break' && it?.songId).map(it => it.songId));
    for (const id of ids) {
      const s = (out[id] ||= { plays: 0, last: null });
      s.plays++;
      if (!s.last || sl.date > s.last) s.last = sl.date;
    }
  }
  return out;
}

/** The songs of the church's next setlist, and its short date ("Sun 1"). */
export function nextSetlistSongs(setlists = [], now = Date.now()) {
  const next = setlists
    .filter(sl => sl.date && isSetlistUpcoming(sl, now))
    .sort((a, b) => setlistStartMs(a) - setlistStartMs(b))[0];
  if (!next) return { label: '', ids: new Set() };
  const d = new Date(`${next.date}T12:00:00`);
  return {
    label: `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()}`,
    ids: new Set((next.items || []).map(it => it?.songId).filter(Boolean)),
  };
}

const short = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** The line under a song's title: "Played 7× · last 25 Oct", or why not. */
export function playLine(stat, now = Date.now()) {
  if (!stat?.plays) return { text: 'Not played yet', stale: false };
  const days = Math.floor((now - new Date(`${stat.last}T12:00:00`).getTime()) / DAY);
  if (days >= STALE_DAYS) {
    const months = Math.round(days / 30);
    return { text: `Not played in ${months} month${months === 1 ? '' : 's'}`, stale: true };
  }
  return { text: `Played ${stat.plays}× · last ${short(stat.last)}`, stale: false };
}

export const SORTS = [
  { value: 'az', label: 'A–Z' },
  { value: 'recent', label: 'Recently changed' },
  { value: 'most', label: 'Most played' },
  { value: 'stale', label: 'Not played in a while' },
];

const byTitle = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });

export function sortSongs(songs, sort = 'az', stats = {}) {
  const list = [...songs];
  const plays = (s) => stats[s.id]?.plays || 0;
  const last = (s) => stats[s.id]?.last || '';
  if (sort === 'recent') list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || byTitle(a, b));
  else if (sort === 'most') list.sort((a, b) => plays(b) - plays(a) || byTitle(a, b));
  // Never played first, then the longest ago.
  else if (sort === 'stale') list.sort((a, b) => last(a).localeCompare(last(b)) || byTitle(a, b));
  else list.sort(byTitle);
  return list;
}

/**
 * The filter sheet's choices: { keys: [], themes: [], tempos: [], stale: bool }.
 * OR within a group, AND across groups, as in the old library facets.
 */
export const NO_FILTERS = { keys: [], themes: [], tempos: [], stale: false };

export function filterSongs(songs, f = NO_FILTERS, stats = {}, now = Date.now()) {
  return songs.filter(s => {
    if (f.keys.length && !f.keys.includes(songKey(s))) return false;
    if (f.themes.length && !songFacetValues(s, 'theme').some(t => f.themes.includes(t))) return false;
    if (f.tempos.length && !f.tempos.includes(tempoBucket(songTempo(s)))) return false;
    if (f.stale && !playLine(stats[s.id], now).stale && stats[s.id]?.plays) return false;
    return true;
  });
}

export const filterCount = (f) => f.keys.length + f.themes.length + f.tempos.length + (f.stale ? 1 : 0);

/** Every key and theme in the library, for the filter sheet. */
export function filterOptions(songs) {
  const keys = new Set();
  const themes = new Map();
  for (const s of songs) {
    const k = songKey(s);
    if (k) keys.add(k);
    for (const t of songFacetValues(s, 'theme')) themes.set(t, (themes.get(t) || 0) + 1);
  }
  return {
    keys: [...keys].sort((a, b) => keyRank(a) - keyRank(b)),
    themes: [...themes.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
  };
}
