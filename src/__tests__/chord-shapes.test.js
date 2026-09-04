// Element 11's shape table, on the one thing that is not about fingering:
// **which spelling of a chord can find it.**
//
// ⚠ Which spelling the chart shows is not this table's business. The same
// chord prints as `Gbm` or `F#m` depending on the key and the reader's own
// `accidentals` setting, and the popover looks the shape up by whatever is
// PRINTED. The aliases used to be eight lines written by hand, and they were
// already incomplete — `A#` and `D#` were missing while `Bb` and `Eb` were in
// the table — which is what a hand-maintained exception list does. They are
// derived now, so this file states the rule rather than the list.
import { describe, it, expect } from 'vitest';
import { CHORD_SHAPES, enharmonicName } from '@/data/chordShapes';
import { notateChord } from '@/music';

describe('enharmonicName', () => {
  it('respells the root, keeping whatever follows it', () => {
    expect(enharmonicName('Gbm')).toBe('F#m');
    expect(enharmonicName('Bb')).toBe('A#');
    expect(enharmonicName('Ebm')).toBe('D#m');
    expect(enharmonicName('Abmaj7')).toBe('G#maj7');
  });

  it('respells the bass of a slash chord too', () => {
    expect(enharmonicName('D/F#')).toBe('D/Gb');
    expect(enharmonicName('A/C#')).toBe('A/Db');
  });

  it('is null for a chord with nothing to respell', () => {
    expect(enharmonicName('G')).toBe(null);
    expect(enharmonicName('Am7')).toBe(null);
    expect(enharmonicName('G/B')).toBe(null);
  });
});

describe('every shape answers to both its names', () => {
  it('has no shape reachable by only one spelling', () => {
    const oneSided = Object.keys(CHORD_SHAPES).filter(name => {
      const twin = enharmonicName(name);
      return twin && !CHORD_SHAPES[twin];
    });
    expect(oneSided).toEqual([]);
  });

  // The two the hand-written list had actually missed.
  it('finds the ones the hand-written list forgot', () => {
    expect(CHORD_SHAPES['A#']).toBe(CHORD_SHAPES['Bb']);
    expect(CHORD_SHAPES['D#']).toBe(CHORD_SHAPES['Eb']);
  });

  // ⚠ A derived alias must never overwrite a voicing somebody chose. `D/F#`
  // is written out with its own fingering; `D/Gb` is the one that gets filled
  // in, not the other way round.
  it('never overwrites a shape that was written on purpose', () => {
    expect(CHORD_SHAPES['F#m']).toBe(CHORD_SHAPES['Gbm']);
    expect(CHORD_SHAPES['D/F#'].fingers).toBeTruthy();
  });
});

// The end the user actually meets: a chart in a sharp key, asking the table
// for what it printed.
describe('what a chart in a sharp key asks for', () => {
  const displayed = (chord, key, accidentals) =>
    notateChord(chord, { key, notation: 'letters', transpose: 0, accidentals });

  it('answers for A major under every accidental setting', () => {
    for (const acc of ['auto', 'sharps', 'flats']) {
      for (const c of ['A', 'Bm', 'C#m', 'D', 'E', 'F#m']) {
        const shown = displayed(c, 'A', acc);
        expect({ acc, shown, known: !!CHORD_SHAPES[shown] })
          .toEqual({ acc, shown, known: true });
      }
    }
  });

  it('answers for E and Eb major too — the sharp and flat sides of the same question', () => {
    for (const [key, chords] of [['E', ['E', 'F#m', 'G#m', 'A', 'B', 'C#m']],
                                 ['Eb', ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm']]]) {
      for (const c of chords) {
        for (const acc of ['auto', 'sharps', 'flats']) {
          const shown = displayed(c, key, acc);
          expect({ key, shown, known: !!CHORD_SHAPES[shown] })
            .toEqual({ key, shown, known: true });
        }
      }
    }
  });
});
