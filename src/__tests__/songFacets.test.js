import { describe, it, expect } from 'vitest';
import {
  tempoBucket,
  songFacetValues,
  buildFacetOptions,
  matchesFacets,
  countActiveFacets,
} from '@/lib/songFacets';

// v2-shaped song with a default arrangement + song-level extended metadata.
function song(id, { key = 'C', tempo = null, ...meta } = {}) {
  return {
    id,
    title: meta.title || id,
    ...meta,
    arrangements: [{ id: 'a_' + id, name: 'Main', key, tempo }],
    defaultArrangementId: 'a_' + id,
  };
}

describe('tempoBucket', () => {
  it('buckets by BPM', () => {
    expect(tempoBucket(70)).toBe('Slow');
    expect(tempoBucket(100)).toBe('Mid');
    expect(tempoBucket(140)).toBe('Fast');
    expect(tempoBucket(null)).toBe(null);
    expect(tempoBucket(0)).toBe(null);
  });
});

describe('songFacetValues', () => {
  it('reads key/tempo from the default arrangement', () => {
    const s = song('1', { key: 'G', tempo: 75 });
    expect(songFacetValues(s, 'key')).toEqual(['G']);
    expect(songFacetValues(s, 'tempo')).toEqual(['Slow']);
  });
  it('splits multi-value metadata (theme merges themes + genres)', () => {
    const s = song('1', { themes: 'grace, redemption', genres: 'hymn' });
    expect(songFacetValues(s, 'theme').sort()).toEqual(['grace', 'hymn', 'redemption']);
  });
  it('reads scripture, language, moment, year', () => {
    const s = song('1', { scripture: 'John 3:16; Psalm 23', language: 'Romanian', moment: 'Communion', year: 1779 });
    expect(songFacetValues(s, 'scripture')).toEqual(['John 3:16', 'Psalm 23']);
    expect(songFacetValues(s, 'language')).toEqual(['Romanian']);
    expect(songFacetValues(s, 'moment')).toEqual(['Communion']);
    expect(songFacetValues(s, 'year')).toEqual(['1779']);
  });
});

describe('buildFacetOptions', () => {
  const songs = [
    song('1', { key: 'G', tempo: 70, themes: 'grace', language: 'English' }),
    song('2', { key: 'C', tempo: 130, themes: 'grace, advent' }),
    song('3', { key: 'G', tempo: 95 }),
  ];

  it('counts values and omits empty facets', () => {
    const opts = buildFacetOptions(songs);
    expect(opts.key).toEqual([
      { value: 'C', count: 1 },
      { value: 'G', count: 2 },
    ]); // sorted by musical root order (C before G)
    expect(opts.theme.find(o => o.value === 'grace').count).toBe(2);
    expect(opts.tempo).toEqual([
      { value: 'Slow', count: 1 },
      { value: 'Mid', count: 1 },
      { value: 'Fast', count: 1 },
    ]);
    expect(opts.scripture).toBeUndefined(); // no scripture on any song
  });
});

describe('matchesFacets', () => {
  const s = song('1', { key: 'G', tempo: 70, themes: 'grace, advent', language: 'English' });

  it('returns true when nothing selected', () => {
    expect(matchesFacets(s, {})).toBe(true);
    expect(matchesFacets(s, null)).toBe(true);
  });
  it('OR within a facet', () => {
    expect(matchesFacets(s, { key: ['C', 'G'] })).toBe(true);
    expect(matchesFacets(s, { key: ['C', 'D'] })).toBe(false);
  });
  it('AND across facets', () => {
    expect(matchesFacets(s, { key: ['G'], tempo: ['Slow'] })).toBe(true);
    expect(matchesFacets(s, { key: ['G'], tempo: ['Fast'] })).toBe(false);
  });
  it('matches one of several theme values', () => {
    expect(matchesFacets(s, { theme: ['advent'] })).toBe(true);
  });
});

describe('countActiveFacets', () => {
  it('sums selected values across facets', () => {
    expect(countActiveFacets({ key: ['C', 'G'], tempo: ['Fast'] })).toBe(3);
    expect(countActiveFacets({})).toBe(0);
    expect(countActiveFacets(null)).toBe(0);
  });
});
