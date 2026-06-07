import { describe, it, expect } from 'vitest';
import { isValidSong, isValidSetlist, migrateSongShape } from '../storage';

const validArrangement = (overrides = {}) => ({
  id: 'arr_1', name: 'Main Arrangement', sections: [], ...overrides,
});

describe('isValidSong', () => {
  it('accepts a minimal valid v2 song', () => {
    expect(isValidSong({
      id: 'abc', title: 'T', artist: 'A',
      arrangements: [validArrangement()],
    })).toBe(true);
  });

  it('rejects null / non-objects', () => {
    expect(isValidSong(null)).toBe(false);
    expect(isValidSong(undefined)).toBe(false);
    expect(isValidSong('string')).toBe(false);
    expect(isValidSong(42)).toBe(false);
  });

  it('rejects missing or non-string id', () => {
    expect(isValidSong({ title: 'T', artist: 'A', arrangements: [validArrangement()] })).toBe(false);
    expect(isValidSong({ id: '', title: 'T', artist: 'A', arrangements: [validArrangement()] })).toBe(false);
    expect(isValidSong({ id: 123, title: 'T', artist: 'A', arrangements: [validArrangement()] })).toBe(false);
  });

  it('rejects missing artist or arrangements', () => {
    expect(isValidSong({ id: 'a' })).toBe(false);
    expect(isValidSong({ id: 'a', title: 'T' })).toBe(false);
    expect(isValidSong({ id: 'a', title: 'T', artist: 'A' })).toBe(false);
    expect(isValidSong({ id: 'a', title: 'T', artist: 'A', arrangements: [] })).toBe(false);
  });

  it('rejects malformed arrangements', () => {
    expect(isValidSong({ id: 'a', title: 'T', artist: 'A', arrangements: [{ id: 'x', name: 'M' }] })).toBe(false);
    expect(isValidSong({ id: 'a', title: 'T', artist: 'A', arrangements: [{ name: 'M', sections: [] }] })).toBe(false);
  });
});

describe('migrateSongShape', () => {
  const v1Song = {
    id: 'old_1',
    title: 'Old Song',
    artist: 'Old Artist',
    key: 'D',
    tempo: 100,
    time: '3/4',
    capo: 1,
    notes: 'some notes',
    structure: ['Verse'],
    sections: [{ name: 'Verse', lines: ['[D]Hello'] }],
    ccli: '555',
    tags: ['slow'],
    updatedAt: 9000,
  };

  it('returns null / non-objects unchanged', () => {
    expect(migrateSongShape(null)).toBe(null);
    expect(migrateSongShape(undefined)).toBe(undefined);
    expect(migrateSongShape('string')).toBe('string');
  });

  it('wraps a v1 flat song into a v2 song with one arrangement', () => {
    const v2 = migrateSongShape(v1Song);
    expect(Array.isArray(v2.arrangements)).toBe(true);
    expect(v2.arrangements).toHaveLength(1);
  });

  it('copies flat musical fields into the arrangement', () => {
    const v2 = migrateSongShape(v1Song);
    const arr = v2.arrangements[0];
    expect(arr.key).toBe('D');
    expect(arr.tempo).toBe(100);
    expect(arr.time).toBe('3/4');
    expect(arr.capo).toBe(1);
    expect(arr.notes).toBe('some notes');
    expect(arr.structure).toEqual(['Verse']);
    expect(arr.sections).toEqual([{ name: 'Verse', lines: ['[D]Hello'] }]);
  });

  it('preserves top-level identity fields', () => {
    const v2 = migrateSongShape(v1Song);
    expect(v2.id).toBe('old_1');
    expect(v2.title).toBe('Old Song');
    expect(v2.artist).toBe('Old Artist');
    expect(v2.ccli).toBe('555');
    expect(v2.tags).toEqual(['slow']);
  });

  it('sets defaultArrangementId pointing to the created arrangement', () => {
    const v2 = migrateSongShape(v1Song);
    expect(v2.defaultArrangementId).toBe(v2.arrangements[0].id);
  });

  it('fills safe defaults for absent optional fields', () => {
    const bare = { id: 'x', title: 'T', artist: 'A' };
    const v2 = migrateSongShape(bare);
    const arr = v2.arrangements[0];
    expect(arr.key).toBe('C');
    expect(arr.capo).toBe(0);
    expect(arr.notes).toBe('');
    expect(arr.structure).toEqual([]);
    expect(arr.sections).toEqual([]);
    expect(v2.tags).toEqual([]);
    expect(v2.ccli).toBe('');
  });

  it('returns a v2 song unchanged when arrangements is already populated', () => {
    const v2 = {
      id: 's1', title: 'T', artist: 'A',
      defaultArrangementId: 'arr_1',
      arrangements: [{ id: 'arr_1', name: 'Main', sections: [] }],
    };
    expect(migrateSongShape(v2)).toBe(v2);
  });

  it('fixes a v2 song whose defaultArrangementId is missing or broken', () => {
    const broken = {
      id: 's1', title: 'T', artist: 'A',
      defaultArrangementId: 'arr_gone',
      arrangements: [{ id: 'arr_1', name: 'Main', sections: [] }],
    };
    const fixed = migrateSongShape(broken);
    expect(fixed.defaultArrangementId).toBe('arr_1');
  });

  it('leaves a v2 song with a valid defaultArrangementId untouched', () => {
    const good = {
      id: 's1', title: 'T', artist: 'A',
      defaultArrangementId: 'arr_1',
      arrangements: [{ id: 'arr_1', name: 'Main', sections: [] }],
    };
    expect(migrateSongShape(good)).toBe(good);
  });
});

describe('isValidSetlist', () => {
  it('accepts a minimal valid setlist', () => {
    expect(isValidSetlist({ id: 'abc', name: 'Sunday', items: [] })).toBe(true);
  });

  it('rejects null / non-objects', () => {
    expect(isValidSetlist(null)).toBe(false);
    expect(isValidSetlist('string')).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(isValidSetlist({ id: 'a', items: [] })).toBe(false);
    expect(isValidSetlist({ id: 'a', name: 'x' })).toBe(false);
    expect(isValidSetlist({ name: 'x', items: [] })).toBe(false);
  });

  it('requires items to be an array', () => {
    expect(isValidSetlist({ id: 'a', name: 'x', items: {} })).toBe(false);
    expect(isValidSetlist({ id: 'a', name: 'x', items: null })).toBe(false);
  });
});
