import { describe, it, expect } from 'vitest';
import { moveItem } from '@/features/setlist/useDragReorder';
import { suggestSongs, keysFlow } from '@/lib/suggestSongs';

const song = (id, key, tempo) => ({ id, title: id, arrangements: [{ id: `${id}-a`, key, tempo, sections: [] }], defaultArrangementId: `${id}-a` });

describe('moveItem', () => {
  it('moves down and up, and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    const xs = ['a'];
    expect(moveItem(xs, 0, 3)).toBe(xs);
  });
});

describe('suggestSongs', () => {
  it('keysFlow: fifths and the same key flow, a tritone does not', () => {
    expect(keysFlow('G', 'D')).toBe(true);
    expect(keysFlow('G', 'G')).toBe(true);
    expect(keysFlow('G', 'C#')).toBe(false);
  });

  it('skips songs in the set and played last week, gives a reason, allows one new song', () => {
    const songs = [song('a', 'G', 72), song('b', 'D', 120), song('c', 'C#', 70), song('d', 'D', 74), song('e', 'A', 74)];
    const setlist = { id: 's', date: '2026-11-08', items: [{ songId: 'a', arrangementId: 'a-a' }] };
    const setlists = [
      { id: 'p1', date: '2026-11-01', items: [{ songId: 'c' }] },          // last week
      { id: 'p2', date: '2026-06-01', items: [{ songId: 'a' }, { songId: 'b' }, { songId: 'd' }] },
    ];
    const out = suggestSongs({ songs, setlist, setlists, at: 1, now: new Date('2026-11-02').getTime() });
    const ids = out.map(x => x.song.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('c');
    expect(out.every(x => x.why)).toBe(true);
    expect(ids).toContain('b');
  });
});
