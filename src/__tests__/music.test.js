import { describe, it, expect } from 'vitest';
import {
  transposeChord,
  transposeKey,
  semitonesBetween,
  getNashvilleNumber,
  getSolfege,
  notateChord,
  getDiatonicChords,
  sectionStyle,
  compactLabel,
  ALL_KEYS,
  circleOfFifthsDistance,
  keyCompatibilityScore,
  tempoProximityScore,
} from '../music';

describe('transposeChord', () => {
  it('returns the input when semitones is 0', () => {
    expect(transposeChord('C', 0)).toBe('C');
    expect(transposeChord('Am', 0)).toBe('Am');
  });

  it('returns empty / falsy inputs unchanged', () => {
    expect(transposeChord('', 2)).toBe('');
    expect(transposeChord(null, 2)).toBe(null);
  });

  it('transposes major chords up by one semitone', () => {
    expect(transposeChord('C', 1)).toBe('Db');
    expect(transposeChord('G', 1)).toBe('Ab');
    expect(transposeChord('B', 1)).toBe('C');
  });

  it('transposes minor chords and preserves the suffix', () => {
    expect(transposeChord('Am', 2)).toBe('B' + 'm');
    expect(transposeChord('Dm7', 3)).toBe('F' + 'm7');
    expect(transposeChord('Gmaj7', 5)).toBe('C' + 'maj7');
  });

  it('transposes flat roots by normalising to sharps first', () => {
    // Bb -> C (up 2 semitones), Eb -> F (up 2 semitones)
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('Eb', 2)).toBe('F');
  });

  it('transposes slash chords on both sides', () => {
    expect(transposeChord('D/F#', 2)).toBe('E/Ab');
    expect(transposeChord('C/E', 5)).toBe('F/A');
  });

  it('handles negative semitones correctly', () => {
    expect(transposeChord('C', -1)).toBe('B');
    expect(transposeChord('A', -2)).toBe('G');
  });

  it('is cyclical at ±12 semitones (enharmonically equal)', () => {
    // semitones=0 short-circuits (returns input unchanged), so we compare to
    // the normalized output at ±12 rather than the raw input.
    const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'Eb'];
    for (const r of roots) {
      const up = transposeChord(r, 12);
      const down = transposeChord(r, -12);
      expect(up).toBe(down);
      // round-trip: transpose up 5 then down 5 lands back on same representation
      expect(transposeChord(transposeChord(r, 5), -5)).toBe(up);
    }
  });

  it('prefers flats in the output (e.g. A# -> Bb)', () => {
    expect(transposeChord('A', 1)).toBe('Bb');
    expect(transposeChord('D', 1)).toBe('Eb');
  });

  it('covers all 12 target keys when transposing C upward', () => {
    const outputs = new Set();
    for (let s = 0; s < 12; s++) outputs.add(transposeChord('C', s));
    expect(outputs.size).toBe(12);
  });
});

describe('transposeKey', () => {
  it('mirrors transposeChord on plain key roots', () => {
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('F#', 1)).toBe('G');
  });
});

describe('semitonesBetween', () => {
  it('returns 0 for identical keys', () => {
    expect(semitonesBetween('C', 'C')).toBe(0);
    expect(semitonesBetween('Bb', 'Bb')).toBe(0);
  });

  it('counts semitones modulo 12 going forward', () => {
    expect(semitonesBetween('C', 'D')).toBe(2);
    expect(semitonesBetween('C', 'G')).toBe(7);
    expect(semitonesBetween('G', 'C')).toBe(5); // 7 up, not 5 down
  });

  it('handles flat → flat and flat → sharp equivalents', () => {
    expect(semitonesBetween('Bb', 'C')).toBe(2);
    expect(semitonesBetween('Eb', 'F#')).toBe(3);
  });
});

describe('getNashvilleNumber', () => {
  it('returns 1 for tonic in major key', () => {
    expect(getNashvilleNumber('C', 'C')).toBe('1');
    expect(getNashvilleNumber('G', 'G')).toBe('1');
  });

  it('maps standard diatonic chords in C', () => {
    expect(getNashvilleNumber('Dm', 'C')).toBe('2m');
    expect(getNashvilleNumber('F', 'C')).toBe('4');
    expect(getNashvilleNumber('G', 'C')).toBe('5');
    expect(getNashvilleNumber('Am', 'C')).toBe('6m');
  });

  it('preserves suffix on slash chords', () => {
    expect(getNashvilleNumber('C/E', 'C')).toBe('1/3');
  });
});

describe('getSolfege (fixed-do)', () => {
  it('maps each letter to its fixed-do syllable, B→Si', () => {
    expect(getSolfege('C')).toBe('Do');
    expect(getSolfege('D')).toBe('Re');
    expect(getSolfege('E')).toBe('Mi');
    expect(getSolfege('F')).toBe('Fa');
    expect(getSolfege('G')).toBe('Sol');
    expect(getSolfege('A')).toBe('La');
    expect(getSolfege('B')).toBe('Si');
  });

  it('preserves accidentals and suffixes', () => {
    expect(getSolfege('Bb')).toBe('Sib');
    expect(getSolfege('F#m7')).toBe('Fa#m7');
    expect(getSolfege('Am')).toBe('Lam');
  });

  it('handles slash chords', () => {
    expect(getSolfege('C/E')).toBe('Do/Mi');
    expect(getSolfege('G/B')).toBe('Sol/Si');
  });
});

describe('notateChord', () => {
  it('transposes letter chords (letters notation)', () => {
    expect(notateChord('C', { key: 'C', notation: 'letters', transpose: 2 })).toBe('D');
    expect(notateChord('C', { key: 'C' })).toBe('C'); // defaults to letters, no transpose
  });

  it('renders Nashville numbers relative to key, ignoring transpose', () => {
    expect(notateChord('G', { key: 'C', notation: 'nashville', transpose: 5 })).toBe('5');
  });

  it('renders fixed-do solfège that follows transpose like letters', () => {
    expect(notateChord('G', { notation: 'solfege', transpose: 0 })).toBe('Sol');
    expect(notateChord('G', { notation: 'solfege', transpose: 2 })).toBe('La'); // G+2 = A
    expect(notateChord('G', { notation: 'solfege', transpose: 5 })).toBe('Do'); // G+5 = C
  });

  it('handles slash chords across notations', () => {
    expect(notateChord('C/E', { key: 'C', notation: 'nashville' })).toBe('1/3');
    expect(notateChord('C/E', { key: 'C', notation: 'solfege' })).toBe('Do/Mi');
  });
});

describe('getDiatonicChords', () => {
  it('produces 7 chords for C major', () => {
    const diatonic = getDiatonicChords('C');
    expect(diatonic).toHaveLength(7);
    expect(diatonic[0]).toBe('C');
    expect(diatonic[3]).toBe('F');
    expect(diatonic[4]).toBe('G');
  });

  it('shifts appropriately for G', () => {
    const diatonic = getDiatonicChords('G');
    expect(diatonic[0]).toBe('G');
    expect(diatonic[3]).toBe('C');
    expect(diatonic[4]).toBe('D');
  });

  it('returns a fallback when no key is given', () => {
    expect(getDiatonicChords('')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  });
});

describe('sectionStyle & compactLabel', () => {
  it('matches by stripped base (e.g. Verse 1 → Verse)', () => {
    const s1 = sectionStyle('Verse 1');
    const s2 = sectionStyle('Verse');
    expect(s1.l).toBe(s2.l);
  });

  it('returns a default style for unknown section types', () => {
    expect(sectionStyle('Zonk').l).toBe('?');
  });

  it('compactLabel appends trailing numbers', () => {
    expect(compactLabel('Chorus 2')).toBe('C2');
    expect(compactLabel('Pre Chorus')).toBe('Pc');
    expect(compactLabel('Intro')).toBe('I');
  });
});

describe('ALL_KEYS', () => {
  it('has 12 unique keys', () => {
    expect(ALL_KEYS).toHaveLength(12);
    expect(new Set(ALL_KEYS).size).toBe(12);
  });
});

describe('circleOfFifthsDistance', () => {
  it('returns 0 for identical major keys', () => {
    expect(circleOfFifthsDistance('C', 'C')).toBe(0);
    expect(circleOfFifthsDistance('G', 'G')).toBe(0);
  });

  it('treats relative minor as same slot', () => {
    // Am ↔ C, Em ↔ G
    expect(circleOfFifthsDistance('Am', 'C')).toBe(0);
    expect(circleOfFifthsDistance('Em', 'G')).toBe(0);
  });

  it('returns 1 for perfect 5th and perfect 4th', () => {
    expect(circleOfFifthsDistance('C', 'G')).toBe(1);  // 5th
    expect(circleOfFifthsDistance('C', 'F')).toBe(1);  // 4th
  });

  it('returns 6 for tritone-distant keys', () => {
    expect(circleOfFifthsDistance('C', 'F#')).toBe(6);
  });

  it('returns null for unknown keys', () => {
    expect(circleOfFifthsDistance('Q', 'C')).toBe(null);
  });
});

describe('keyCompatibilityScore', () => {
  it('returns 1 for identical keys', () => {
    expect(keyCompatibilityScore('C', 'C')).toBe(1);
  });
  it('decays linearly with distance', () => {
    expect(keyCompatibilityScore('C', 'G')).toBeCloseTo(1 - 1 / 6, 5); // 1 step
    expect(keyCompatibilityScore('C', 'F#')).toBeCloseTo(0, 5);        // 6 steps
  });
});

describe('tempoProximityScore', () => {
  it('returns 1 at zero delta', () => {
    expect(tempoProximityScore(120, 120)).toBe(1);
  });
  it('decays for larger BPM gaps', () => {
    const close = tempoProximityScore(120, 125);
    const far = tempoProximityScore(120, 150);
    expect(close).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(0.5);
  });
  it('handles missing tempos by defaulting to 0.5', () => {
    expect(tempoProximityScore(undefined, undefined)).toBe(0.5);
  });
});
