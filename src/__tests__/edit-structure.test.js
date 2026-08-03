// Edit mode's play-order arithmetic.
//
// These exist because a structure edit that lands on the wrong slot is
// INVISIBLE: it re-orders somebody's song and nothing on screen says so until
// they play it.
import { describe, it, expect } from 'vitest';
import {
  materialiseStructure, moveSlot, removeSlot, snapshotEditable, isDirty, entryName,
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
