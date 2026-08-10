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
  isMinorKey,
  keysInQualityOf,
  keyOptions,
  circleOfFifthsDistance,
  keyCompatibilityScore,
  tempoProximityScore,
  keyPrefersSharps,
} from '@/music';

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

describe('enharmonic spelling (keyPrefersSharps / preferSharps)', () => {
  it('picks sharp vs flat keys conventionally', () => {
    ['G', 'D', 'A', 'E', 'B', 'C', 'Em', 'Bm', 'Am'].forEach(k => expect(keyPrefersSharps(k)).toBe(true));
    ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm'].forEach(k => expect(keyPrefersSharps(k)).toBe(false));
  });
  it('honours an explicit accidental in the key spelling', () => {
    expect(keyPrefersSharps('F#')).toBe(true);
    expect(keyPrefersSharps('Gb')).toBe(false);
  });
  it('transposeChord defaults to flats (back-compat) but can prefer sharps', () => {
    expect(transposeChord('C', 6)).toBe('Gb');
    expect(transposeChord('C', 6, true)).toBe('F#');
    expect(transposeChord('C', 6, false)).toBe('Gb');
  });
  it('re-spells at 0 transpose when a preference is given', () => {
    expect(transposeChord('Gb', 0, true)).toBe('F#');
    expect(transposeChord('F#', 0, false)).toBe('Gb');
    expect(transposeChord('F#', 0)).toBe('F#'); // no preference → verbatim
  });
  it('spells slash chords consistently', () => {
    expect(transposeChord('D/F#', 0, false)).toBe('D/Gb');
    expect(transposeChord('D/Gb', 0, true)).toBe('D/F#');
  });
  // ⚠ REWRITTEN 2026-08-10. This used to assert that 'auto' spells the whole
  // chart by the KEY's convention — `Gb` in a G song displayed as `F#`. Two
  // things were wrong with it. At zero transpose it re-spelled a chord nobody
  // had moved, silently overriding what the leader typed. And "one key, one
  // accidental" is wrong on its own terms: in G major the flat six is `Eb`,
  // never `D#`, because real notation spells by FUNCTION and a chord symbol
  // carries none.
  //
  // The owner killed the obvious repair ("verbatim at rest, key convention when
  // moved") in one line: *"the user writes Ab to a song and then expects Ab to a
  // different song, not G# when he modulates."* So the preference travels with
  // the CHORD.
  it('auto keeps the spelling the writer chose, wherever the chord goes', () => {
    // At rest: verbatim, both ways, in either kind of key.
    expect(notateChord('Gb', { key: 'G', accidentals: 'auto' })).toBe('Gb');
    expect(notateChord('F#', { key: 'Db', accidentals: 'auto' })).toBe('F#');
    // The bug this replaces: a borrowed flat in a sharp-side song.
    expect(notateChord('Bb', { key: 'D', accidentals: 'auto' })).toBe('Bb');
    expect(notateChord('Eb', { key: 'G', accidentals: 'auto' })).toBe('Eb');
    // The owner's case, moving. Ab written -> flat side, always.
    expect(notateChord('Ab', { key: 'Eb', transpose: 2, accidentals: 'auto' })).toBe('Bb');
    expect(notateChord('Ab', { key: 'Eb', transpose: 5, accidentals: 'auto' })).toBe('Db');
    // …and a sharp-written chord stays sharp for the same reason.
    expect(notateChord('F#', { key: 'D', transpose: 2, accidentals: 'auto' })).toBe('G#');
  });

  it('asks the destination key only when the chord itself has no opinion', () => {
    // A natural root carries no signal, so it follows the key it is sounding in.
    // Landing on a black note that reads FLAT is not a quirk — it is the
    // convention: C major up a semitone is D♭ major, not C♯ major, and every
    // destination key here is spelled the way a musician would name it.
    expect(notateChord('C', { key: 'C', transpose: 1, accidentals: 'auto' })).toBe('Db');
    expect(notateChord('D', { key: 'C', transpose: 1, accidentals: 'auto' })).toBe('Eb');
    // A natural that stays natural is untouched either way.
    expect(notateChord('G', { key: 'C', transpose: 2, accidentals: 'auto' })).toBe('A');
    expect(notateChord('C', { key: 'C', transpose: 7, accidentals: 'auto' })).toBe('G');
  });

  it('asks each side of a slash chord separately', () => {
    // The bass note's spelling is its own business.
    expect(notateChord('Ab/C', { key: 'Eb', transpose: 1, accidentals: 'auto' })).toBe('A/C#');
    expect(notateChord('Gb/Bb', { key: 'Db', accidentals: 'auto' })).toBe('Gb/Bb');
  });

  it('still lets an explicit preference win — that is what it is for', () => {
    expect(notateChord('Gb', { key: 'G', accidentals: 'flats' })).toBe('Gb');
    expect(notateChord('F#', { key: 'Db', accidentals: 'sharps' })).toBe('F#');
    expect(notateChord('Ab', { key: 'Eb', accidentals: 'sharps' })).toBe('G#');
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

  it('spells diatonic roots with the key\'s accidentals (E → F#m, Eb → Fm)', () => {
    expect(getDiatonicChords('E')[1]).toBe('F#m'); // ii in a sharp key
    expect(getDiatonicChords('Eb')[1]).toBe('Fm');
    expect(getDiatonicChords('G')[6]).toBe('F#dim'); // vii° reads F#, not Gb
  });
});

describe('sectionStyle & compactLabel', () => {
  it('matches by stripped base (e.g. Verse 1 → Verse)', () => {
    const s1 = sectionStyle('Verse 1');
    const s2 = sectionStyle('Verse');
    expect(s1.l).toBe(s2.l);
  });

  it('returns a default style for unknown section types, with a real code', () => {
    // '?' is not an abbreviation — it is the ribbon saying it lost the section.
    // An unknown type gets initials instead (2026-08-06).
    expect(sectionStyle('Zonk').b).toBe('var(--ds-gray-700)');
    expect(sectionStyle('Zonk').l).toBe('Zo');
    expect(sectionStyle('Key Change').l).toBe('Kc');
  });

  it('reads a section type by its LETTERS, not its punctuation', () => {
    // The table's key is 'Pre Chorus'; charts write 'Pre-Chorus'. All four
    // spellings are one section, in the heading AND in the ribbon.
    for (const spelling of ['Pre Chorus', 'Pre-Chorus', 'PreChorus', 'prechorus']) {
      expect(sectionStyle(spelling).l).toBe('Pc');
      expect(compactLabel(spelling)).toBe('Pc');
    }
    // …and it must not swallow the types whose names start the same way.
    expect(sectionStyle('Interlude').l).toBe('Il');
    expect(sectionStyle('Instrumental').l).toBe('It');
    expect(sectionStyle('Intro').l).toBe('I');
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

describe('minor keys', () => {
  it('detects minor vs major (and ignores maj)', () => {
    expect(isMinorKey('Am')).toBe(true);
    expect(isMinorKey('Bbm')).toBe(true);
    expect(isMinorKey('A')).toBe(false);
    expect(isMinorKey('Cmaj7')).toBe(false);
  });

  it('computes semitones between minor keys by root', () => {
    expect(semitonesBetween('Am', 'Bm')).toBe(2);
    expect(semitonesBetween('Em', 'Gm')).toBe(3);
    expect(semitonesBetween('Bbm', 'Cm')).toBe(2);
  });

  it('transposes a minor key and preserves the quality', () => {
    expect(transposeKey('Am', 2)).toBe('Bm');
    expect(transposeKey('Em', 3)).toBe('Gm');
  });

  it('lists keys in the song quality', () => {
    expect(keysInQualityOf('C')).toEqual(ALL_KEYS);
    expect(keysInQualityOf('Am')).toEqual(ALL_KEYS.map(k => k + 'm'));
  });

  it('spells the key list with sharps when asked', () => {
    expect(keysInQualityOf('C', 'sharps')).toContain('F#');
    expect(keysInQualityOf('C', 'sharps')).not.toContain('Gb');
    expect(keysInQualityOf('C', 'flats')).toContain('Gb');
    expect(keysInQualityOf('Am', 'sharps')).toContain('F#m');
  });
});

describe('keyOptions', () => {
  it('returns 24 entries (12 major + 12 minor)', () => {
    expect(keyOptions('flats')).toHaveLength(24);
  });

  it('stores flats but labels both spellings for accidental keys', () => {
    const gb = keyOptions('flats').find(o => o.value === 'Gb');
    expect(gb.label).toBe('Gb/F#');
    const gbm = keyOptions('flats').find(o => o.value === 'Gbm');
    expect(gbm.label).toBe('Gbm/F#m');
  });

  it('stores sharps when the preference is sharps', () => {
    const fSharp = keyOptions('sharps').find(o => o.value === 'F#');
    expect(fSharp.label).toBe('F#/Gb');
    expect(keyOptions('sharps').some(o => o.value === 'Gb')).toBe(false);
  });

  it('labels natural keys with a single name', () => {
    expect(keyOptions('flats').find(o => o.value === 'C').label).toBe('C');
    expect(keyOptions('flats').find(o => o.value === 'Em').label).toBe('Em');
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
