import { describe, it, expect } from 'vitest';
import { suggestNextSongs } from '../lib/songSuggestions';

const mk = (id, title, key, tempo, tags = []) => ({ id, title, key, tempo, tags });

describe('suggestNextSongs', () => {
  const current = mk('cur', 'Current', 'C', 72, ['grace', 'easter']);

  it('excludes the current song and any excludeIds', () => {
    const songs = [current, mk('a', 'A', 'G', 72), mk('b', 'B', 'F', 72)];
    const out = suggestNextSongs(current, songs, { excludeIds: ['b'] });
    const ids = out.map((s) => s.id);
    expect(ids).not.toContain('cur');
    expect(ids).not.toContain('b');
  });

  it('ranks key-compatible songs above unrelated ones', () => {
    const fifth = mk('fifth', 'Fifth', 'G', 200);   // perfect fifth from C
    const tritone = mk('tt', 'Tritone', 'F#', 200);  // dissonant, no key score
    const out = suggestNextSongs(current, [current, tritone, fifth], { limit: 2 });
    expect(out[0].id).toBe('fifth');
  });

  it('boosts shared tags and close tempo', () => {
    const sameTags = mk('tags', 'Tags', 'B', 72, ['grace']); // no key match, shared tag + tempo
    const nothing = mk('none', 'None', 'B', 200, []);
    const out = suggestNextSongs(current, [current, nothing, sameTags], { limit: 1 });
    expect(out[0].id).toBe('tags');
  });

  it('handles minor keys via the root note', () => {
    const rel = mk('am', 'Am song', 'Am', 200); // A is a sixth/third from C -> small score
    const out = suggestNextSongs(current, [current, rel], { limit: 1 });
    expect(out[0].id).toBe('am');
  });

  it('falls back to other songs when nothing scores', () => {
    const a = mk('a', 'A', 'F#', 200, ['x']); // no key/tag/tempo overlap
    const out = suggestNextSongs(current, [current, a], { limit: 3 });
    expect(out.map((s) => s.id)).toContain('a');
  });
});
