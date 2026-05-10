import { describe, it, expect } from 'vitest';
import { isValidSong, isValidSetlist } from '../storage';

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
