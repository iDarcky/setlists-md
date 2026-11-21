import { describe, it, expect } from 'vitest';
import { lineGroups } from '@/lib/plainLines';

const flat = (groups) => groups.map(g => g.map(t => `${t.chord ? `[${t.chord}]` : ''}${t.text}`).join(''));

describe('lineGroups (song page plain lyrics)', () => {
  it('splits a line into words, chord on its word', () => {
    const g = lineGroups('[G]Amazing [G7]grace, how [C]sweet');
    expect(flat(g)).toEqual(['[G]Amazing ', '[G7]grace, ', 'how ', '[C]sweet']);
  });
  it('keeps a chord inside a word in the same group', () => {
    const g = lineGroups('my fears re[D]lieved');
    expect(flat(g)).toEqual(['my ', 'fears ', 're[D]lieved']);
    expect(g[2]).toHaveLength(2);
  });
  it('handles a chords-only line', () => {
    const g = lineGroups('[G] [C] [D]');
    expect(g.flat().filter(t => t.chord).map(t => t.chord)).toEqual(['G', 'C', 'D']);
  });
  it('handles plain text and empty lines', () => {
    expect(flat(lineGroups('That saved a wretch'))).toEqual(['That ', 'saved ', 'a ', 'wretch']);
    expect(lineGroups('')).toEqual([]);
  });
});
