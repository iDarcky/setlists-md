import { describe, it, expect } from 'vitest';
import { normalizeText, searchSongs, searchSetlists } from '../lib/search';

// Minimal v2-shaped song. Extended metadata keys are stored lowercase
// (see EXTRA_META_FIELDS in parser.js): originaltitle, writers, album, …
function song(id, fields = {}) {
  const { key = 'C', name = 'Main', ...top } = fields;
  return {
    id,
    title: top.title || 'Untitled',
    artist: top.artist || '',
    tags: top.tags || [],
    ccli: top.ccli || '',
    originaltitle: top.originaltitle || '',
    writers: top.writers || '',
    album: top.album || '',
    themes: top.themes || '',
    arrangements: [{ id: 'a_' + id, name, key }],
  };
}

const ids = (list) => list.map(s => s.id);

// ─── normalizeText ────────────────────────────────────────────────────────────

describe('normalizeText — diacritic folding', () => {
  it('folds Romanian/Hungarian/Spanish accents and lowercases', () => {
    expect(normalizeText('Laudă')).toBe('lauda');
    expect(normalizeText('José')).toBe('jose');
    expect(normalizeText('Țară')).toBe('tara');
    expect(normalizeText('  Świętość ')).toBe('swietosc');
  });
  it('handles null/undefined/number safely', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(2024)).toBe('2024');
  });
});

// ─── searchSongs: diacritics + empty query ────────────────────────────────────

describe('searchSongs — diacritic-insensitive', () => {
  const songs = [song('1', { title: 'Laudă Domnului' }), song('2', { title: 'Amazing Grace' })];

  it('finds an accented title from an un-accented query', () => {
    expect(ids(searchSongs(songs, 'lauda'))).toEqual(['1']);
  });
  it('finds it from the accented query too', () => {
    expect(ids(searchSongs(songs, 'Laudă'))).toEqual(['1']);
  });
  it('empty query returns the input unchanged', () => {
    expect(searchSongs(songs, '')).toBe(songs);
    expect(searchSongs(songs, '   ')).toBe(songs);
  });
});

// ─── searchSongs: multi-field ─────────────────────────────────────────────────

describe('searchSongs — searches all metadata fields', () => {
  const songs = [
    song('1', { title: 'Amazing Grace', artist: 'Chris Tomlin', writers: 'John Newton', album: 'See the Morning' }),
    song('2', { title: 'How Great', originaltitle: 'Wie groß bist du' }),
    song('3', { title: 'Other', themes: 'grace, redemption' }),
  ];

  it('matches by writer', () => {
    expect(ids(searchSongs(songs, 'newton'))).toEqual(['1']);
  });
  it('matches by original title', () => {
    expect(ids(searchSongs(songs, 'gross'))).toEqual(['2']); // diacritic-folded groß → gross
  });
  it('matches by album', () => {
    expect(ids(searchSongs(songs, 'morning'))).toEqual(['1']);
  });
  it('matches by theme', () => {
    expect(ids(searchSongs(songs, 'redemption'))).toEqual(['3']);
  });
});

// ─── searchSongs: ranking ─────────────────────────────────────────────────────

describe('searchSongs — relevance ranking', () => {
  it('ranks a title hit above an album-only hit for the same term', () => {
    const songs = [
      song('album', { title: 'Unrelated', album: 'Grace Abounds' }),
      song('title', { title: 'Grace' }),
    ];
    expect(ids(searchSongs(songs, 'grace'))[0]).toBe('title');
  });
});

// ─── searchSongs: multi-token AND across fields ───────────────────────────────

describe('searchSongs — multi-token AND', () => {
  const songs = [
    song('1', { title: 'Amazing Grace', writers: 'John Newton' }),
    song('2', { title: 'Amazing Love' }),
  ];
  it('requires every token to appear somewhere (across fields)', () => {
    expect(ids(searchSongs(songs, 'grace newton'))).toEqual(['1']);
    expect(ids(searchSongs(songs, 'amazing newton'))).toEqual(['1']);
    expect(searchSongs(songs, 'amazing missing')).toEqual([]);
  });
});

// ─── searchSongs: fuzzy fallback + short-query guard ──────────────────────────

describe('searchSongs — fuzzy fallback', () => {
  const songs = [song('1', { title: 'Amazing Grace' }), song('2', { title: 'Build My Life' })];

  it('catches a typo via the fuzzy fallback', () => {
    expect(ids(searchSongs(songs, 'amazin grce'))).toContain('1');
  });
  it('does not fuzzy-match a 2-char query (short-query guard)', () => {
    // "zz" is no exact substring; too short to trigger fuzzy → no results.
    expect(searchSongs(songs, 'zz')).toEqual([]);
  });
});

// ─── searchSongs: limit ───────────────────────────────────────────────────────

describe('searchSongs — limit option', () => {
  it('caps the number of results', () => {
    const songs = [
      song('1', { title: 'Grace One' }),
      song('2', { title: 'Grace Two' }),
      song('3', { title: 'Grace Three' }),
    ];
    expect(searchSongs(songs, 'grace', { limit: 2 })).toHaveLength(2);
  });
});

// ─── searchSetlists ───────────────────────────────────────────────────────────

describe('searchSetlists', () => {
  const setlists = [
    { id: 's1', name: 'Duminică Dimineața', service: 'Sunday AM', tags: ['live'] },
    { id: 's2', name: 'Rehearsal', service: 'Practice', tags: ['band'] },
  ];

  it('folds diacritics in the name', () => {
    expect(ids(searchSetlists(setlists, 'duminica'))).toEqual(['s1']);
  });
  it('matches service and tags', () => {
    expect(ids(searchSetlists(setlists, 'practice'))).toEqual(['s2']);
    expect(ids(searchSetlists(setlists, 'live'))).toEqual(['s1']);
  });
});
