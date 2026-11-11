import { describe, it, expect } from 'vitest';
import { pastedLines } from '@/lib/songEdit';

describe('pastedLines — a paste into a section keeps its chords', () => {
  it('turns a chord line over a lyric line into inline chords', () => {
    expect(pastedLines('G       D\nAmazing grace how sweet')).toEqual(['[G]Amazing [D]grace how sweet']);
  });
  it('keeps a chord-only line (an instrumental bar)', () => {
    expect(pastedLines('G       D\nAmazing grace\n\nEm  C\n')).toEqual(['[G]Amazing [D]grace', '', '[Em]  [C]']);
  });
  it('keeps [G] inline chords as they are', () => {
    expect(pastedLines('[G]Amazing [D]grace\nhow sweet')).toEqual(['[G]Amazing [D]grace', 'how sweet']);
  });
  it('mixes both forms', () => {
    expect(pastedLines('[G]Doamne\nC\nTu ești')).toEqual(['[G]Doamne', '[C]Tu ești']);
  });
  it('leaves plain words to the browser (null)', () => {
    expect(pastedLines('Just words\nmore words')).toBeNull();
    expect(pastedLines('[Refren]\nCânt')).toBeNull();
  });
});
