import { describe, it, expect } from 'vitest';
import { songUsage, rangeStart, leaderSplit, usualKey } from '@/lib/songUsage';
import { groupOf } from '@/lib/teamPeople';
import { songFromFlat } from '@/arrangements';

const today = new Date('2026-10-31T12:00:00');
const songs = [
  songFromFlat({ id: 'g', title: 'Goodness of God', key: 'A', sections: [] }),
  songFromFlat({ id: 'w', title: 'Way Maker', key: 'E', sections: [] }),
  songFromFlat({ id: 'o', title: 'Old Song', key: 'G', sections: [] }),
];
const sl = (id, date, createdBy, service, items) => ({ id, name: service, date, createdBy, service, items });
const setlists = [
  sl('a', '2026-10-25', 'ana', 'Sunday Morning', [{ songId: 'g' }, { type: 'break', label: 'Prayer' }, { songId: 'w', transpose: 1 }]),
  sl('b', '2026-10-18', 'dan', 'Youth', [{ songId: 'g', transpose: 1 }]),
  sl('c', '2026-10-11', 'ana', 'Sunday Morning', [{ songId: 'g' }]),
  sl('old', '2025-01-05', 'dan', 'Sunday Morning', [{ songId: 'o' }, { songId: 'w' }]),
  sl('future', '2026-11-08', 'ana', 'Sunday Morning', [{ songId: 'w' }]),
];

describe('songUsage', () => {
  it('counts past services in the range, most played first', () => {
    const u = songUsage(setlists, songs, { range: '3m', today });
    expect(u.totals).toEqual({ services: 3, songs: 2, newSongs: 1 });
    expect(u.songs.map(s => [s.title, s.plays])).toEqual([['Goodness of God', 3], ['Way Maker', 1]]);
    expect(u.songs[0].leaders).toEqual({ ana: 2, dan: 1 });
    expect(u.songs[0].keys).toEqual({ A: 2, Bb: 1 });
    expect(u.songs[0].last).toBe('2026-10-25');
  });
  it('a song first played inside the range is new; one played before is not', () => {
    const u = songUsage(setlists, songs, { range: '3m', today });
    expect(u.songs.find(s => s.songId === 'w')).toBeTruthy();
    expect(u.totals.newSongs).toBe(1); // Goodness of God; Way Maker was played in 2025
  });
  it('services are newest first, with the key each song was played in', () => {
    const u = songUsage(setlists, songs, { range: '3m', today });
    expect(u.services.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(u.services[0].songs).toEqual([{ songId: 'g', title: 'Goodness of God', key: 'A' }, { songId: 'w', title: 'Way Maker', key: 'F' }]);
  });
  it('filters by service and by leader', () => {
    expect(songUsage(setlists, songs, { range: '3m', service: 'Youth', today }).totals.services).toBe(1);
    expect(songUsage(setlists, songs, { range: '3m', leader: 'ana', today }).songs[0].plays).toBe(2);
  });
  it('all time reaches back, never into the future', () => {
    const u = songUsage(setlists, songs, { range: 'all', today });
    expect(u.totals.services).toBe(4);
    expect(u.serviceNames).toEqual(['Sunday Morning', 'Youth']);
  });
  it('helpers', () => {
    expect(rangeStart('1m', today)).toBe('2026-09-30');
    expect(rangeStart('all', today)).toBeNull();
    expect(leaderSplit({ ana: 2, dan: 3 }, id => ({ ana: 'Ana', dan: 'Daniel' })[id])).toBe('Daniel 3 · Ana 2');
    expect(usualKey({ A: 2, Bb: 1 })).toBe('A');
  });
});

describe('role groups', () => {
  it('admins are leaders; unknown roles are members', () => {
    expect(groupOf('admin')).toBe('leader');
    expect(groupOf('leader')).toBe('leader');
    expect(groupOf('editor')).toBe('editor');
    expect(groupOf(undefined)).toBe('member');
    expect(groupOf('weird')).toBe('member');
  });
});
