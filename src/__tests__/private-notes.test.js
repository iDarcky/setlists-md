import { describe, it, expect } from 'vitest';
import { scopeKey } from '../notes/usePrivateNotes';

// The scope key is the identity of a private note. These cases pin down the
// three scopes (song / setlist-item / section) so they never collide and stay
// stable as the schema's '' defaults imply.
describe('private notes scopeKey', () => {
  it('distinguishes the three scopes', () => {
    const song = scopeKey({ songId: 's1' });
    const item = scopeKey({ setlistId: 'set1', songId: 's1' });
    const section = scopeKey({ songId: 's1', sectionKey: 'idx-2' });
    expect(new Set([song, item, section]).size).toBe(3);
  });

  it('treats missing scope parts as empty (matches NOT NULL "" columns)', () => {
    expect(scopeKey({ songId: 's1' })).toBe('s1||');
    expect(scopeKey({ setlistId: 'set1', songId: 's1' })).toBe('s1|set1|');
    expect(scopeKey({ songId: 's1', sectionKey: 'v1' })).toBe('s1||v1');
    expect(scopeKey()).toBe('||');
  });

  it('is stable for the same scope regardless of key order', () => {
    expect(scopeKey({ songId: 'a', setlistId: 'b' })).toBe(scopeKey({ setlistId: 'b', songId: 'a' }));
  });
});
