import { describe, it, expect } from 'vitest';
import { playStats, nextSetlistSongs, playLine, sortSongs, filterSongs, filterOptions, filterCount, NO_FILTERS } from '@/lib/songsData';

// Sunday 25 October 2026, 09:00 local.
const NOW = new Date(2026, 9, 25, 9, 0).getTime();
const song = (id, title, key, extra = {}) => ({ id, title, arrangements: [{ id: `${id}a`, key, tempo: extra.tempo }], ...extra });
const SONGS = [
  song('wm', 'Way Maker', 'E', { tempo: 68, themes: 'Praise' }),
  song('gg', 'Goodness of God', 'A', { tempo: 63, themes: 'Praise, Grace', updatedAt: 5 }),
  song('ag', 'Amazing Grace', 'G', { tempo: 130, themes: 'Grace' }),
  song('ff', 'Firm Foundation', 'C', { updatedAt: 9 }),
];
const sl = (date, ids) => ({ id: date, date, time: '10:00', items: ids.map(songId => ({ songId })) });
const SETLISTS = [
  sl('2026-10-18', ['wm', 'gg', 'wm']),
  sl('2026-10-11', ['wm']),
  sl('2026-03-01', ['ag']),
  sl('2026-11-01', ['gg', 'ff']),
];

describe('songsData', () => {
  it('counts past plays once per setlist and the last date', () => {
    const s = playStats(SETLISTS, NOW);
    expect(s.wm).toEqual({ plays: 2, last: '2026-10-18' });
    expect(s.ag).toEqual({ plays: 1, last: '2026-03-01' });
    expect(s.ff).toBeUndefined();
  });

  it('finds the next setlist and labels it', () => {
    const n = nextSetlistSongs(SETLISTS, NOW);
    expect(n.label).toBe('Sun 1');
    expect([...n.ids]).toEqual(['gg', 'ff']);
  });

  it('writes the play line, gold when it has been months', () => {
    const s = playStats(SETLISTS, NOW);
    expect(playLine(s.wm, NOW)).toEqual({ text: 'Played 2× · last 18 Oct', stale: false });
    expect(playLine(s.ag, NOW)).toEqual({ text: 'Not played in 8 months', stale: true });
    expect(playLine(undefined, NOW).text).toBe('Not played yet');
  });

  it('sorts four ways', () => {
    const s = playStats(SETLISTS, NOW);
    const ids = (sort) => sortSongs(SONGS, sort, s).map(x => x.id);
    expect(ids('az')).toEqual(['ag', 'ff', 'gg', 'wm']);
    expect(ids('recent')).toEqual(['ff', 'gg', 'ag', 'wm']);
    expect(ids('most')[0]).toBe('wm');
    expect(ids('stale')).toEqual(['ff', 'ag', 'gg', 'wm']);
  });

  it('filters by key, theme, tempo and not played lately', () => {
    const s = playStats(SETLISTS, NOW);
    const ids = (f) => filterSongs(SONGS, { ...NO_FILTERS, ...f }, s, NOW).map(x => x.id);
    expect(ids({ keys: ['E', 'A'] })).toEqual(['wm', 'gg']);
    expect(ids({ themes: ['Grace'] })).toEqual(['gg', 'ag']);
    expect(ids({ tempos: ['Fast'] })).toEqual(['ag']);
    expect(ids({ stale: true })).toEqual(['ag', 'ff']);
    expect(filterCount({ ...NO_FILTERS, keys: ['E'], stale: true })).toBe(2);
    expect(filterOptions(SONGS)).toEqual({ keys: ['C', 'E', 'G', 'A'], themes: ['Praise', 'Grace'] });
  });
});
