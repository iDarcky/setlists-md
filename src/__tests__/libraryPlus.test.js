import { describe, it, expect } from 'vitest';
import {
  buildSongUsage,
  duplicateTitleIds,
  matchesDataQuality,
  setlistDurationSeconds,
  searchSetlistsPlus,
  songColumnValue,
} from '@/lib/libraryPlus';

const songs = [
  { id: 's1', title: 'Amazing Grace', artist: 'Newton', arrangements: [{ id: 'a', key: 'G', tempo: 72, duration: '3:00' }], defaultArrangementId: 'a', tags: ['hymn'] },
  { id: 's2', title: 'Amazing Grace', artist: 'Tomlin', arrangements: [{ id: 'b', key: 'D', tempo: 0, duration: '4:00' }], defaultArrangementId: 'b' },
  { id: 's3', title: 'Oceans', artist: 'Hillsong', key: 'D', tempo: 60, tags: [] },
];

const setlists = [
  { id: 'sl1', name: 'Sunday AM', items: [{ songId: 's1' }, { songId: 's3' }, { type: 'break' }] },
  { id: 'sl2', name: 'Evening', items: [{ songId: 's1' }] },
];

describe('buildSongUsage', () => {
  it('counts how many setlists reference each song', () => {
    const u = buildSongUsage(setlists);
    expect(u.get('s1')).toBe(2);
    expect(u.get('s3')).toBe(1);
    expect(u.get('s2')).toBeUndefined();
  });
});

describe('duplicateTitleIds', () => {
  it('flags songs that share a normalized title', () => {
    const d = duplicateTitleIds(songs);
    expect(d.has('s1')).toBe(true);
    expect(d.has('s2')).toBe(true);
    expect(d.has('s3')).toBe(false);
  });
});

describe('matchesDataQuality', () => {
  it('untagged matches only songs without tags', () => {
    expect(matchesDataQuality(songs[0], ['untagged'])).toBe(false); // has 'hymn'
    expect(matchesDataQuality(songs[1], ['untagged'])).toBe(true);  // no tags
  });
  it('noTempo matches a 0/absent tempo', () => {
    expect(matchesDataQuality(songs[1], ['noTempo'])).toBe(true);
    expect(matchesDataQuality(songs[0], ['noTempo'])).toBe(false);
  });
  it('AND across multiple chips', () => {
    expect(matchesDataQuality(songs[1], ['untagged', 'noTempo'])).toBe(true);
    expect(matchesDataQuality(songs[0], ['untagged', 'noTempo'])).toBe(false);
  });
});

describe('setlistDurationSeconds', () => {
  it('sums the default-arrangement duration of referenced songs', () => {
    const map = new Map(songs.map(s => [s.id, s]));
    // sl1: s1 3:00 (180) + s3 no duration (0) = 180
    expect(setlistDurationSeconds(setlists[0], map)).toBe(180);
  });
});

describe('searchSetlistsPlus', () => {
  it('returns setlists that contain a matching song, not just name matches', () => {
    const res = searchSetlistsPlus(setlists, songs, 'oceans');
    expect(res.map(s => s.id)).toContain('sl1'); // sl1 contains Oceans
  });
  it('still returns name matches', () => {
    const res = searchSetlistsPlus(setlists, songs, 'evening');
    expect(res.map(s => s.id)).toEqual(['sl2']);
  });
});

describe('songColumnValue', () => {
  it('reads arrangement + song fields', () => {
    expect(songColumnValue(songs[0], 'duration')).toBe('3:00');
    expect(songColumnValue(songs[0], 'arrangements')).toBe(1);
  });
});
