import { describe, it, expect } from 'vitest';
import { transposeTab, transposeTabLine } from '@/lib/tabTranspose';
import { getRomanNumeral, notateChord } from '@/music';

const strings = (...contents) =>
  ['e', 'B', 'G', 'D', 'A', 'E'].map((note, i) => ({ note, content: contents[i] ?? '---' }));

describe('transposeTabLine', () => {
  it('shifts every fret and leaves the layout alone', () => {
    expect(transposeTabLine('--3--5--7--', 2)).toBe('--5--7--9--');
  });

  it('keeps technique markers untouched', () => {
    expect(transposeTabLine('--3h5p3--', 2)).toBe('--5h7p5--');
  });

  it('handles two-digit frets', () => {
    expect(transposeTabLine('--10--12--', 2)).toBe('--12--14--');
  });

  it('refuses when a fret would go below the nut', () => {
    // Fret 0 is an open string; there is nothing below it to play.
    expect(transposeTabLine('--0--3--', -2)).toBeNull();
  });

  it('refuses when a fret would run off the neck', () => {
    expect(transposeTabLine('--21--', 5)).toBeNull();
  });

  it('is a no-op at zero', () => {
    expect(transposeTabLine('--3--', 0)).toBe('--3--');
  });
});

describe('transposeTab', () => {
  it('does nothing, and flags nothing, in the written key', () => {
    const r = transposeTab(strings('--3--'), 0);
    expect(r.transposed).toBe(false);
    expect(r.flagged).toBe(false);
  });

  it('transposes a small shift silently', () => {
    const r = transposeTab(strings('--3--5--'), 2);
    expect(r.transposed).toBe(true);
    expect(r.flagged).toBe(false);
    expect(r.strings[0].content).toBe('--5--7--');
  });

  it('refuses ALL strings when any single one cannot move', () => {
    // A half-transposed tab is worse than an honestly-labelled original.
    const r = transposeTab(strings('--3--5--', '--0--2--'), -2);
    expect(r.transposed).toBe(false);
    expect(r.flagged).toBe(true);
    expect(r.reason).toBe('out-of-range');
    expect(r.strings[0].content).toBe('--3--5--');   // untouched
  });

  it('transposes a large shift but flags the fingering', () => {
    const r = transposeTab(strings('--3--5--'), 5);
    expect(r.transposed).toBe(true);
    expect(r.flagged).toBe(true);
    expect(r.reason).toBe('large-shift');
    expect(r.strings[0].content).toBe('--8--10--');
  });

  it('survives no strings at all', () => {
    expect(transposeTab(undefined, 2).strings).toEqual([]);
  });
});

// Roman numerals — the fourth `notation` mode (element 28, 2026-08-04).
describe('Roman numerals', () => {
  it('carries the chord QUALITY in the case, which is the whole point', () => {
    // Nashville prints "6" whether the chord is major or minor and lets the
    // suffix say so; Roman numerals put it in the numeral.
    expect(getRomanNumeral('C', 'C')).toBe('I');
    expect(getRomanNumeral('F', 'C')).toBe('IV');
    expect(getRomanNumeral('G', 'C')).toBe('V');
    expect(getRomanNumeral('Am', 'C')).toBe('vi');
    expect(getRomanNumeral('Dm', 'C')).toBe('ii');
    expect(getRomanNumeral('Bdim', 'C')).toBe('vii°');
  });

  it('consumes the minor suffix rather than printing it twice', () => {
    // "vim" would say minor twice; the lowercase already said it.
    expect(getRomanNumeral('Am7', 'C')).toBe('vi7');
    expect(getRomanNumeral('Dm9', 'C')).toBe('ii9');
  });

  it('does not read maj7 as minor', () => {
    // The narrow `m(?!aj)` test: `maj` must not trip the minor branch.
    expect(getRomanNumeral('Cmaj7', 'C')).toBe('Imaj7');
  });

  it('handles slash chords and accidentals', () => {
    expect(getRomanNumeral('G/B', 'C')).toBe('V/VII');
    expect(getRomanNumeral('Bb', 'C')).toBe('bVII');
  });

  it('routes through notateChord like every other notation', () => {
    expect(notateChord('Am', { key: 'C', notation: 'roman' })).toBe('vi');
  });
});
