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
import { CHORD_SHAPES, enharmonicName, toRelativeFrets } from '@/data/chordShapes';
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

// ⚠ THE DOTS WERE OFF THE BOTTOM OF THE BOX. The shapes store ABSOLUTE fret
// numbers; svguitar reads them RELATIVE to `position`. `Ab` is a barre at fret
// 4 with `position: 4` and fingers up to fret 6, so it was drawn as "fret 6 of
// a window starting at 4" — three frets below a four-fret box, which is what
// the owner photographed. In every affected shape the barre's fret EQUALS the
// position, which is what proves the stored numbers are absolute.
//
// ⚠ The list is DERIVED, not typed. A first pass at this test hand-listed seven
// shapes and there are eleven — `Abm`, `Dbm`, `Ebm` and `Gbm` are written
// without a space after the colon and a regex missed them. Trap 29 again: an
// invariant over every shape, not a list somebody keeps in step.
const ABOVE_NUT = Object.entries(CHORD_SHAPES)
  .filter(([, s]) => (s.position || 1) > 1)
  .map(([name]) => name);

describe('a barred shape is drawn inside its own window', () => {
  it('finds every shape that starts above the nut', () => {
    // If this number moves, a shape was added — the rules below cover it too.
    expect(ABOVE_NUT.length).toBeGreaterThanOrEqual(11);
  });

  it('lands every one of them in the first four frets once converted', () => {
    for (const name of ABOVE_NUT) {
      const rel = toRelativeFrets(CHORD_SHAPES[name]);
      const frets = rel.fingers.map(([, f]) => f).filter(f => f > 0);
      expect({ name, min: Math.min(...frets) }).toEqual({ name, min: 1 });
      expect({ name, max: Math.max(...frets) })
        .toEqual({ name, max: Math.min(4, Math.max(...frets)) });
    }
  });

  it('puts the barre on the first fret of the window — that IS the position', () => {
    for (const name of ABOVE_NUT) {
      const rel = toRelativeFrets(CHORD_SHAPES[name]);
      if (!rel.barres.length) continue;
      expect({ name, barre: rel.barres[0].fret }).toEqual({ name, barre: 1 });
    }
  });

  it('Ab comes out as the E-shape barre at the 4th fret', () => {
    const rel = toRelativeFrets(CHORD_SHAPES['Ab']);
    expect(rel.fingers).toEqual([[1, 1], [2, 1], [3, 2], [4, 3], [5, 3], [6, 1]]);
    expect(rel.position).toBe(4);
  });

  it('leaves open and muted strings alone, and shapes at the nut untouched', () => {
    const bm = toRelativeFrets(CHORD_SHAPES['Bm']);
    expect(bm.fingers.find(([s]) => s === 6)[1]).toBe(-1);   // still muted
    expect(toRelativeFrets(CHORD_SHAPES['G'])).toBe(CHORD_SHAPES['G']);
    const c = toRelativeFrets(CHORD_SHAPES['C']);
    expect(c.fingers.some(([, f]) => f === 0)).toBe(true);   // open strings survive
  });
});
