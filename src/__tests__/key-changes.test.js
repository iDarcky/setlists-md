// Element 8 — the key-change overlay.
//
// The case that started it, and the one every other test here exists to
// protect: **"Chorus in C, Verse 2, Chorus in D"**. It was declared
// unrepresentable in `READER.md`, and it was — with `{modulate}` in a section
// body, both choruses are the SAME OBJECT, so anything you write into one you
// write into both. `once` gives C then C; `every` climbs Verse 2 as well.
//
// The overlay says it in one entry, because an anchor names a SLOT.
import { describe, it, expect } from 'vitest';
import {
  normalizeKeyChanges, resolveKeyChanges, fromBodyMarkers,
  remapForInsert, remapForRemove, remapForMove,
} from '@/lib/keyChanges';

// A play order where slots 0 and 2 are literally the same object, which is what
// `orderSections` produces for a repeated section — and the reason a body
// marker can never tell them apart.
const chorus = { type: 'Chorus', lines: ['[C]a', '[F]b', '[G]c'] };
const verse = { type: 'Verse 2', lines: ['[Am]d', '[F]e'] };
const ordered = [chorus, verse, chorus];

describe('the case element 8 could not say', () => {
  it('lifts the SECOND chorus and leaves the first alone', () => {
    const { slotOffsets } = resolveKeyChanges(ordered, [{ slot: 2, line: 0, semitones: 2 }]);
    expect(slotOffsets).toEqual([0, 0, 0]);
    // Slot 2's own entry fires at its line 0, so every line of it is shifted.
    const { slotMarks } = resolveKeyChanges(ordered, [{ slot: 2, line: 0, semitones: 2 }]);
    expect(slotMarks[0]).toEqual([]);
    expect(slotMarks[2]).toEqual([{ line: 0, semitones: 2, offset: 2 }]);
  });

  it('a body marker cannot — the two choruses are one object', () => {
    // Proving the premise rather than trusting it. The same marker is in slot 0
    // AND slot 2 because there is only one array of lines between them.
    const withMarker = { ...chorus, lines: [{ type: 'modulate', semitones: 2 }, ...chorus.lines] };
    const sameTwice = [withMarker, verse, withMarker];
    const entries = fromBodyMarkers(sameTwice);
    // Fires on the first occurrence only — so it is the FIRST chorus that
    // lifts, which is the opposite of what was wanted.
    expect(entries).toEqual([{ slot: 0, line: 1, semitones: 2 }]);
  });
});

describe('mid-section changes', () => {
  // The owner's objection to putting the marker in `structure`: *"What if a
  // song modulates in the middle of the chorus?"* An entry between slots cannot
  // say it; an entry anchored to a line can.
  it('shifts from a line, not from a section boundary', () => {
    const { slotOffsets, slotMarks } = resolveKeyChanges(ordered, [{ slot: 0, line: 2, semitones: 1 }]);
    // Slot 0 starts unshifted...
    expect(slotOffsets[0]).toBe(0);
    // ...lifts at its third line...
    expect(slotMarks[0]).toEqual([{ line: 2, semitones: 1, offset: 1 }]);
    // ...and everything after it inherits the lift.
    expect(slotOffsets[1]).toBe(1);
    expect(slotOffsets[2]).toBe(1);
  });

  it('stacks, and everything after carries the total', () => {
    const { slotOffsets } = resolveKeyChanges(ordered, [
      { slot: 0, line: 1, semitones: 2 },
      { slot: 1, line: 0, semitones: 1 },
    ]);
    expect(slotOffsets).toEqual([0, 2, 3]);
  });
});

describe('an overlay that has outlived its song', () => {
  // The full editor rewrites sections wholesale, so an anchor CAN end up
  // pointing past the end. The two honest failures are "gone" and "at the end";
  // a crash or a silent shift of the wrong half of the song are not.
  it('drops an entry anchored past the play order', () => {
    const { slotOffsets } = resolveKeyChanges(ordered, [{ slot: 9, line: 0, semitones: 2 }]);
    expect(slotOffsets).toEqual([0, 0, 0]);
  });

  it('clamps an entry anchored past the end of its section', () => {
    const { slotMarks } = resolveKeyChanges(ordered, [{ slot: 1, line: 99, semitones: 2 }]);
    expect(slotMarks[1]).toEqual([{ line: 1, semitones: 2, offset: 2 }]);
  });
});

describe('normalizing', () => {
  it('sums two changes at one anchor into one chip', () => {
    expect(normalizeKeyChanges([
      { slot: 1, line: 0, semitones: 2 },
      { slot: 1, line: 0, semitones: 2 },
    ])).toEqual([{ slot: 1, line: 0, semitones: 4 }]);
  });

  it('drops a change that cancels itself out', () => {
    expect(normalizeKeyChanges([
      { slot: 1, line: 0, semitones: 2 },
      { slot: 1, line: 0, semitones: -2 },
    ])).toEqual([]);
  });

  it('drops nonsense rather than rendering it', () => {
    expect(normalizeKeyChanges([
      null, {}, { slot: -1, semitones: 2 }, { slot: 0, semitones: 0 }, { slot: 0, semitones: 'x' },
    ])).toEqual([]);
  });
});

// ── The failure mode this module exists for ─────────────────────────────────
// An anchor is an INDEX, and every edit to the play order moves indices. These
// enumerate the reader's structure ops; adding a new one means adding it here,
// or a key change will quietly start pointing at a different section.
describe('anchors survive edits to the play order', () => {
  const entries = [
    { slot: 0, line: 1, semitones: 1 },
    { slot: 2, line: 0, semitones: 2 },
  ];

  it('an inserted slot pushes later anchors along', () => {
    expect(remapForInsert(entries, 1)).toEqual([
      { slot: 0, line: 1, semitones: 1 },
      { slot: 3, line: 0, semitones: 2 },
    ]);
  });

  it('appending changes nothing', () => {
    expect(remapForInsert(entries, 3)).toEqual(entries);
  });

  it('a removed slot pulls later anchors back', () => {
    expect(remapForRemove(entries, 1)).toEqual([
      { slot: 0, line: 1, semitones: 1 },
      { slot: 1, line: 0, semitones: 2 },
    ]);
  });

  // ⚠ The change belonged to THAT occurrence. Re-homing it onto whatever slid
  // into the same index would move a key change the user never touched.
  it('removing the slot a change lives on removes the change', () => {
    expect(remapForRemove(entries, 2)).toEqual([{ slot: 0, line: 1, semitones: 1 }]);
  });

  it('a moved run carries its own changes with it', () => {
    // Move slot 2 (which carries the +2) to the front.
    expect(remapForMove(entries, 2, 1, 0)).toEqual([
      { slot: 0, line: 0, semitones: 2 },
      { slot: 1, line: 1, semitones: 1 },
    ]);
  });

  it('a moved run pushes the slots it lands among', () => {
    // Move slot 0 (which carries the +1) to the end.
    expect(remapForMove(entries, 0, 1, 2)).toEqual([
      { slot: 1, line: 0, semitones: 2 },
      { slot: 2, line: 1, semitones: 1 },
    ]);
  });

  it('a move that changes nothing changes nothing', () => {
    expect(remapForMove(entries, 0, 1, 0)).toEqual(entries);
  });
});

describe('reading the old format', () => {
  const modChorus = {
    type: 'Chorus',
    lines: ['[C]a', { type: 'modulate', semitones: 2 }, '[C]b'],
  };
  const everyChorus = {
    type: 'Chorus',
    lines: ['[C]a', { type: 'modulate', semitones: 2, every: true }, '[C]b'],
  };

  it('a bare marker fires on the first occurrence only', () => {
    expect(fromBodyMarkers([modChorus, verse, modChorus]))
      .toEqual([{ slot: 0, line: 2, semitones: 2 }]);
  });

  it('an `every` marker fires on each occurrence — the climbing chorus', () => {
    expect(fromBodyMarkers([everyChorus, verse, everyChorus])).toEqual([
      { slot: 0, line: 2, semitones: 2 },
      { slot: 2, line: 2, semitones: 2 },
    ]);
  });

  // The marker is its own line, so what it shifts starts at the NEXT one —
  // otherwise the line the marker sits on would render a bar early.
  it('anchors to the line after the marker', () => {
    expect(fromBodyMarkers([modChorus])[0].line).toBe(2);
  });

  it('says nothing about a song with no markers', () => {
    expect(fromBodyMarkers(ordered)).toEqual([]);
  });
});

// ── The capo bug, 2026-08-21 ────────────────────────────────────────────────
// The chip's whole job is to say "we're in D now", and with a capo on it said
// the wrong letter. `SectionBlock` computed the arrival key from the CHART's
// transpose, which already has the capo subtracted so the chords render as
// shapes — so a song in C with a capo on 2 and a `{modulate: +2}` showed:
//
//   key pill  C     (sounding — what the band is in)
//   chip      ↗ C   (shapes — what your fingers do)
//   reality   D     (where the song actually arrives)
//
// Two different keys under one letter, at the one moment the whole band has to
// hit together. The fix is a separate `keyTranspose` prop carrying the sounding
// transpose; this pins the arithmetic behind it so the two can never merge back.
describe('a key change names the key the BAND is in, not the shape', () => {
  const arrival = ({ transpose, capo, shift }) => {
    // What `Reader` hands down: the chart renders from `transpose - capo`, and
    // the chip must compute from `transpose`.
    const chartTranspose = transpose - capo;
    return { chart: chartTranspose + shift, chip: transpose + shift };
  };

  it('agrees with the chart when there is no capo', () => {
    const { chart, chip } = arrival({ transpose: 0, capo: 0, shift: 2 });
    expect(chip).toBe(chart);
  });

  it('differs from the chart by exactly the capo', () => {
    const { chart, chip } = arrival({ transpose: 0, capo: 2, shift: 2 });
    expect(chip - chart).toBe(2);
    // Song in C: the chip is +2 from C (D, sounding) while the chart is 0 from
    // C (C shapes). Before the fix both were 0 and the chip said C.
    expect(chip).toBe(2);
    expect(chart).toBe(0);
  });

  it('still tracks a user transpose on top of the capo', () => {
    // Sounding A (C transposed -3), capo 2 → G shapes, lifting +2 → sounding B.
    const { chart, chip } = arrival({ transpose: -3, capo: 2, shift: 2 });
    expect(chip).toBe(-1);   // C -1 = B, sounding
    expect(chart).toBe(-3);  // C -3 = A, shapes
  });
});

// ── What makes two plays of a section the SAME play ─────────────────────────
// `repeatFirstIndex` collapses a repeat only when both plays are in the same
// key, and it compares ONE value per slot. The incoming offset is the wrong
// one: a mark anchored at line 0 fires inside the slot, so a lifted chorus
// still reports an incoming 0 and matches the unlifted one — collapsing the
// second chorus into a tag announcing a repeat a step higher. The case element
// 8 exists for, hidden by the feature that implements it.
describe('slot signatures', () => {
  it('separate two plays that differ only by a change at their first line', () => {
    const { slotSignatures } = resolveKeyChanges(ordered, [{ slot: 2, line: 0, semitones: 2 }]);
    expect(slotSignatures[0]).not.toBe(slotSignatures[2]);
  });

  it('match two plays that really are the same', () => {
    const { slotSignatures } = resolveKeyChanges(ordered, []);
    expect(slotSignatures[0]).toBe(slotSignatures[2]);
  });

  it('separate two plays that differ only mid-section', () => {
    const { slotSignatures } = resolveKeyChanges(ordered, [{ slot: 2, line: 2, semitones: 1 }]);
    expect(slotSignatures[0]).not.toBe(slotSignatures[2]);
  });
});
