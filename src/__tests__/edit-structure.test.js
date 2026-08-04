// Edit mode's play-order arithmetic.
//
// These exist because a structure edit that lands on the wrong slot is
// INVISIBLE: it re-orders somebody's song and nothing on screen says so until
// they play it.
import { describe, it, expect } from 'vitest';
import {
  materialiseStructure, moveSlot, removeSlot, addSlotAfter, moveRun, appendSection,
  snapshotEditable, isDirty, entryName,
  replaceChordInLine, withEditedLine,
} from '@/lib/editStructure';

const sections = [
  { type: 'Verse 1', lines: ['a'] },
  { type: 'Chorus', lines: ['b'] },
  { type: 'Verse 2', lines: ['c'] },
];

describe('materialiseStructure', () => {
  it('writes down the implied order when a song has none', () => {
    // A song played in document order has no `structure`. Without writing the
    // implied order down, the first edit lands on an empty array, orderSections
    // keeps falling back to `sections`, and the tap appears to do nothing.
    const song = { sections, structure: [] };
    expect(materialiseStructure(song, sections)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('writes it down for an explicit document-order song too', () => {
    const song = { sections, structure: ['Chorus'], structureMode: 'doc' };
    expect(materialiseStructure(song, sections)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('keeps a real structure as it is', () => {
    const song = { sections, structure: ['Verse 1', 'Chorus', 'Chorus'], structureMode: 'custom' };
    expect(materialiseStructure(song, [sections[0], sections[1], sections[1]]))
      .toEqual(['Verse 1', 'Chorus', 'Chorus']);
  });

  it('rebuilds when the stored structure does not resolve', () => {
    // A typo or a deleted section makes `orderSections` fall back to document
    // order — so the indices we are about to edit refer to a list nobody is
    // reading, and editing it would move the wrong slot.
    const song = { sections, structure: ['Verse 1', 'Ghost'], structureMode: 'custom' };
    expect(materialiseStructure(song, sections)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });
});

describe('moveSlot', () => {
  const st = ['Verse 1', 'Chorus', 'Verse 2'];

  it('swaps with the neighbour', () => {
    expect(moveSlot(st, 1, -1)).toEqual(['Chorus', 'Verse 1', 'Verse 2']);
    expect(moveSlot(st, 1, 1)).toEqual(['Verse 1', 'Verse 2', 'Chorus']);
  });

  it('returns the SAME array at the ends, so a no-op writes nothing', () => {
    expect(moveSlot(st, 0, -1)).toBe(st);
    expect(moveSlot(st, 2, 1)).toBe(st);
    expect(moveSlot(st, 9, 1)).toBe(st);
  });

  it('moves one repeat without touching the others', () => {
    // The same name appears three times; moving the second must not disturb
    // the first or the third.
    const rep = ['Chorus', 'Verse 1', 'Chorus', 'Bridge', 'Chorus'];
    expect(moveSlot(rep, 2, 1)).toEqual(['Chorus', 'Verse 1', 'Bridge', 'Chorus', 'Chorus']);
  });
});

describe('removeSlot', () => {
  it('takes one slot out and leaves the rest', () => {
    expect(removeSlot(['Verse 1', 'Chorus', 'Verse 2'], 1)).toEqual(['Verse 1', 'Verse 2']);
  });

  it('removes ONE repeat, not every slot with that name', () => {
    // The whole point: the chorus is sung three times and you are cutting the
    // last one. The section body is shared, so anything that removed by NAME
    // would silently take out all three.
    const rep = ['Chorus', 'Verse 1', 'Chorus'];
    expect(removeSlot(rep, 2)).toEqual(['Chorus', 'Verse 1']);
  });

  it('refuses to empty the play order', () => {
    // An empty structure sends `orderSections` back to document order, so the
    // removal would appear to undo itself.
    const one = ['Chorus'];
    expect(removeSlot(one, 0)).toBe(one);
  });

  it('returns the same array for an out-of-range index', () => {
    const st = ['A', 'B'];
    expect(removeSlot(st, 5)).toBe(st);
    expect(removeSlot(st, -1)).toBe(st);
  });
});

describe('the edit snapshot', () => {
  const song = { key: 'G', tempo: 72, time: '4/4', capo: 0, notes: '', structure: ['A'], structureMode: 'custom', sections, title: 'X' };

  it('captures only what edit mode can change', () => {
    const snap = snapshotEditable(song);
    expect(snap.key).toBe('G');
    expect(snap.structure).toEqual(['A']);
    // Not an editable field — the fork must not put a title back.
    expect('title' in snap).toBe(false);
  });

  it('is clean until something actually changes', () => {
    expect(isDirty(snapshotEditable(song), song)).toBe(false);
    expect(isDirty(snapshotEditable(song), { ...song, tempo: 80 })).toBe(true);
    // Deep, not by reference: a re-rendered song with equal values is clean, or
    // "Save as new arrangement" would offer itself on every render.
    expect(isDirty(snapshotEditable(song), { ...song, structure: ['A'] })).toBe(false);
  });
});

describe('entryName', () => {
  it('reads both shapes a structure entry can take', () => {
    expect(entryName('Chorus')).toBe('Chorus');
    expect(entryName({ type: 'Chorus' })).toBe('Chorus');
    expect(entryName(null)).toBe('');
  });
});

// ── Chord editing ───────────────────────────────────────────────────────────
// Same reason as the play order: an edit that lands on the wrong chord is
// invisible until somebody plays it.
describe('replaceChordInLine', () => {
  it('replaces the Nth chord and nothing else', () => {
    const line = '[G]Amazing [C]grace how [G]sweet';
    expect(replaceChordInLine(line, 1, 'Am')).toBe('[G]Amazing [Am]grace how [G]sweet');
  });

  it('picks the RIGHT one when the same chord appears three times', () => {
    // The whole point of carrying an ordinal: "which G did you tap?"
    const line = '[G]a [G]b [G]c';
    expect(replaceChordInLine(line, 0, 'D')).toBe('[D]a [G]b [G]c');
    expect(replaceChordInLine(line, 2, 'D')).toBe('[G]a [G]b [D]c');
  });

  it('leaves lyrics and spacing byte-exact', () => {
    // The .md line is the source of truth, not a re-serialised parse: a chart
    // that reflows because someone fixed one chord is a chart nobody trusts.
    const line = '[G]Amazing   grace,   how [C]sweet   the sound';
    expect(replaceChordInLine(line, 0, 'G/B')).toBe('[G/B]Amazing   grace,   how [C]sweet   the sound');
  });

  it('does not mistake an inline note for a chord', () => {
    // Notes are {!…}, chords are […] — but this is the kind of thing that goes
    // wrong quietly.
    const line = '[G]sing {!softly} [C]now';
    expect(replaceChordInLine(line, 1, 'F')).toBe('[G]sing {!softly} [F]now');
  });

  it('returns the ORIGINAL string when the index is out of range', () => {
    // Identity, so the caller can tell nothing happened and skip the write.
    const line = '[G]a';
    expect(replaceChordInLine(line, 4, 'D')).toBe(line);
    expect(replaceChordInLine(line, -1, 'D')).toBe(line);
    expect(replaceChordInLine(null, 0, 'D')).toBe(null);
  });
});

describe('withEditedLine', () => {
  const sections = [
    { type: 'Verse 1', lines: ['[G]a', '[C]b'] },
    { type: 'Chorus', lines: ['[D]c'] },
  ];

  it('writes one line of one section and leaves the rest alone', () => {
    const next = withEditedLine(sections, 0, 1, '[Am]b');
    expect(next[0].lines).toEqual(['[G]a', '[Am]b']);
    expect(next[1]).toBe(sections[1]);          // untouched section keeps identity
    expect(sections[0].lines[1]).toBe('[C]b');  // and the input is not mutated
  });

  it('returns the same array when nothing would change', () => {
    // So a no-op never dirties the song or pushes an undo step.
    expect(withEditedLine(sections, 0, 0, '[G]a')).toBe(sections);
  });

  it('is indexed into song.sections, not the play order', () => {
    // A section sung three times is ONE body. Editing it changes every repeat,
    // which is correct — and is why the index must be into `sections`.
    const next = withEditedLine(sections, 1, 0, '[Bm]c');
    expect(next[1].lines).toEqual(['[Bm]c']);
  });

  it('shrugs off an out-of-range section or line', () => {
    expect(withEditedLine(sections, 9, 0, 'x')).toBe(sections);
    expect(withEditedLine(null, 0, 0, 'x')).toBe(null);
  });
});

describe('addSlotAfter', () => {
  it('plays that section once more, right after itself', () => {
    expect(addSlotAfter(['Verse 1', 'Chorus', 'Verse 2'], 1))
      .toEqual(['Verse 1', 'Chorus', 'Chorus', 'Verse 2']);
  });

  it('lands INSIDE an existing run, so the chip ticks up rather than splitting', () => {
    // The ribbon collapses consecutive duplicates. Adding after the run's LAST
    // slot keeps them adjacent, so `C ×2` becomes `C ×3` instead of a second
    // chip appearing beside the first.
    const st = ['Chorus', 'Chorus', 'Verse 2'];
    expect(addSlotAfter(st, 1)).toEqual(['Chorus', 'Chorus', 'Chorus', 'Verse 2']);
  });

  it('appends at the end', () => {
    expect(addSlotAfter(['Verse 1', 'Chorus'], 1)).toEqual(['Verse 1', 'Chorus', 'Chorus']);
  });

  it('returns the same array for an out-of-range index', () => {
    const st = ['A'];
    expect(addSlotAfter(st, 3)).toBe(st);
    expect(addSlotAfter(st, -1)).toBe(st);
    expect(addSlotAfter(null, 0)).toBe(null);
  });
});

describe('moveRun', () => {
  it('moves a whole run, not one slot out of it', () => {
    // The ribbon shows `C ×3` as ONE chip, so dragging it must move all three —
    // moving one would split the chip in two, which is not what was dragged.
    const st = ['Verse 1', 'Chorus', 'Chorus', 'Chorus', 'Verse 2'];
    expect(moveRun(st, 1, 3, 0)).toEqual(['Chorus', 'Chorus', 'Chorus', 'Verse 1', 'Verse 2']);
  });

  it('accounts for its own removal when moving later', () => {
    // Removing the run first shifts every later index down by `count`; getting
    // this wrong lands it one slot short of where it was dropped.
    const st = ['A', 'B', 'C', 'D'];
    expect(moveRun(st, 0, 1, 3)).toEqual(['B', 'C', 'A', 'D']);
    expect(moveRun(st, 0, 1, 4)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('is a no-op when dropped on itself', () => {
    const st = ['A', 'B', 'B', 'C'];
    expect(moveRun(st, 1, 2, 1)).toBe(st);
    expect(moveRun(st, 1, 2, 2)).toBe(st);
  });

  it('shrugs off nonsense', () => {
    const st = ['A', 'B'];
    expect(moveRun(st, 5, 1, 0)).toBe(st);
    expect(moveRun(st, 0, 1, 9)).toBe(st);
    expect(moveRun(null, 0, 1, 0)).toBe(null);
  });
});

describe('appendSection', () => {
  it('adds to the end of the play order', () => {
    expect(appendSection(['A', 'B'], 'Bridge')).toEqual(['A', 'B', 'Bridge']);
  });

  it('ignores an empty name', () => {
    const st = ['A'];
    expect(appendSection(st, '')).toBe(st);
    expect(appendSection(null, 'B')).toBe(null);
  });
});
