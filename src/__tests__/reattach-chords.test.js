import { describe, it, expect } from 'vitest';
import { reattachChords } from '@/lib/reattachChords';

// INS-82: the chart's Lyrics box put chords back by LINE NUMBER, so a chord-only
// line (it looks empty in the box) slid every chord after it onto the wrong line.
describe('reattachChords', () => {
  const base = ['[G]   [C]', 'Amazing [D]grace', 'How [Em]sweet'];

  it('changes nothing when nothing changed', () => {
    expect(reattachChords(base, ['   ', 'Amazing grace', 'How sweet'])).toEqual(base);
  });

  it('keeps chords on their lines when an empty-looking chord line is deleted', () => {
    expect(reattachChords(base, ['Amazing grace', 'How sweet'])).toEqual(['Amazing [D]grace', 'How [Em]sweet']);
  });

  it('keeps chords on their lines when an empty line is added', () => {
    expect(reattachChords(base, ['   ', '', 'Amazing grace', 'How sweet']))
      .toEqual(['[G]   [C]', '', 'Amazing [D]grace', 'How [Em]sweet']);
  });

  it('keeps chords on a line whose words were edited in place, nudged to fit', () => {
    expect(reattachChords(base, ['   ', 'Amazing grace!', 'How'])).toEqual(['[G]   [C]', 'Amazing [D]grace!', 'How[Em]']);
  });

  it('keeps a bare chord-only line', () => {
    expect(reattachChords(['[G]', 'Hello [C]you'], ['', 'Hello you'])).toEqual(['[G]', 'Hello [C]you']);
  });

  it('gives a new line no chords', () => {
    expect(reattachChords(['[C]my hope'], ['my hope', 'is built'])).toEqual(['[C]my hope', 'is built']);
  });
});

describe('reattachChords, a chord line deleted while the words change', () => {
  it('pairs words with words, never a chord line with words', () => {
    expect(reattachChords(['[G]  [D]', '[C]my hope'], ['my hope is built'])).toEqual(['[C]my hope is built']);
  });
});
