import { describe, it, expect } from 'vitest';
import { mergeLyrics, alignChords, lyricsOnly } from '@/features/editor/arrangeHelpers';

describe('mergeLyrics chord preservation (edit-lyrics)', () => {
  const original = ['[F]Are we weak and[Bb] heavy laden,[F]'];

  it('strips chords for the words-only view', () => {
    expect(lyricsOnly(original)).toBe('Are we weak and heavy laden,');
  });

  it('keeps all chords when a space is deleted', () => {
    const words = lyricsOnly(original);
    const del = words.slice(0, 6) + words.slice(7); // delete a space
    const merged = mergeLyrics(original, del);
    expect((merged.match(/\[/g) || []).length).toBe(3);
  });

  it('keeps all chords when a trailing char is deleted', () => {
    const words = lyricsOnly(original);
    const merged = mergeLyrics(original, words.slice(0, -1));
    expect((merged.match(/\[/g) || []).length).toBe(3);
  });
});

describe('alignChords', () => {
  it('shifts a chord right on insertion', () => {
    expect(alignChords('abcdef', 'abXcdef', [{ chord: 'C', pos: 3 }])[0].pos).toBe(4);
  });
  it('shifts a chord left on deletion', () => {
    expect(alignChords('abcdef', 'abdef', [{ chord: 'C', pos: 4 }])[0].pos).toBe(3);
  });
  it('leaves a chord before the edit untouched', () => {
    expect(alignChords('abcdef', 'abXcdef', [{ chord: 'C', pos: 1 }])[0].pos).toBe(1);
  });
});
