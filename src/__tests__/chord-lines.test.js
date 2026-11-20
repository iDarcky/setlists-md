import { describe, it, expect } from 'vitest';
import { reattachChords } from '@/lib/reattachChords';
import { lineToPlacement, placementToLine } from '@/parser';
import { linesToWords, wordsToLines, setChordAt } from '@/lib/songEdit';

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

// INS-82, the owner's screenshot: an Intro of "[Am][G][C][C][F]" showed in
// Source as "[F][C][C][G][Am]". Chords that share a spot must keep their order.
describe('chords sharing one spot (a chord-only line)', () => {
  const line = '[Am][G][C][C][F]';

  it('round-trips in order through the placement model', () => {
    expect(placementToLine(lineToPlacement(line))).toBe(line);
    expect(placementToLine(lineToPlacement('[G]Hello [C][D]world'))).toBe('[G]Hello [C][D]world');
  });

  it('keeps all of them, in order, in the chart Lyrics box', () => {
    expect(reattachChords([line], [''])).toEqual([line]);
  });

  it('keeps all of them through the song editor Lyrics box', () => {
    const w = linesToWords([line, 'Hello']);
    expect(wordsToLines(w.text, w.marks)).toEqual([line, 'Hello']);
  });

  it('changes or removes one chord without wiping the rest', () => {
    expect(setChordAt(line, 0, 'Dm')).toBe('[Dm][G][C][C][F]');
    expect(setChordAt(line, 0, null)).toBe('[G][C][C][F]');
    expect(setChordAt('Hello', 2, 'G')).toBe('He[G]llo');
  });
});
