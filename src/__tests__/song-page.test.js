import { describe, it, expect } from 'vitest';
import { transposeArrangement } from '@/lib/transposeArrangement';
import { songFacts, flowCodes } from '@/lib/songPage';

describe('transposeArrangement', () => {
  const arr = {
    key: 'G',
    sections: [{ type: 'Verse 1', lines: ['[G]Amazing [G7]grace, how [C/E]sweet', '[x2] [Intro]', { type: 'tab', raw: [] }, { type: 'modulate', semitones: 2 }] }],
  };
  it('moves the key and every chord together', () => {
    const out = transposeArrangement(arr, 2);
    expect(out.key).toBe('A');
    expect(out.sections[0].lines[0]).toBe('[A]Amazing [A7]grace, how [D/F#]sweet');
  });
  it('leaves non-chords, tabs and modulate markers alone', () => {
    const out = transposeArrangement(arr, 2);
    expect(out.sections[0].lines[1]).toBe('[x2] [Intro]');
    expect(out.sections[0].lines[2]).toBe(arr.sections[0].lines[2]);
    expect(out.sections[0].lines[3]).toBe(arr.sections[0].lines[3]);
  });
  it('is a no-op at zero', () => {
    expect(transposeArrangement(arr, 0)).toBe(arr);
  });
});

describe('songFacts', () => {
  const now = new Date('2026-10-28T12:00:00').getTime();
  const setlists = [
    { id: 'a', date: '2026-10-18', items: [{ songId: 's' }] },
    { id: 'b', date: '2026-10-25', items: [{ songId: 's' }, { songId: 's' }] },
    { id: 'c', date: '2026-11-01', time: '10:00', name: 'Sunday Morning', items: [{ songId: 'x' }, { type: 'break' }, { songId: 'y' }, { songId: 's' }] },
  ];
  it('counts plays and finds the next service with the song position', () => {
    const f = songFacts({ id: 's' }, setlists, now);
    expect(f.plays).toBe(2);
    expect(f.last).toBe('25 Oct');
    expect(f.next.name).toBe('Sunday Morning');
    expect(f.next.position).toBe(3);
  });
  it('has no next service when the song is not planned', () => {
    expect(songFacts({ id: 'z' }, setlists, now).next).toBeNull();
  });
});

describe('flowCodes', () => {
  it('shortens the play order', () => {
    expect(flowCodes([{ type: 'Intro' }, { type: 'Verse 1' }, { type: 'Chorus' }])).toEqual(['I', 'V1', 'C']);
  });
});

import { playOrder, renameSection, deleteSection, addSection, newSectionName, chordPalette, sectionToText, textToLines } from '@/lib/songEdit';

describe('songEdit', () => {
  const arr = { key: 'G', structureMode: 'custom', structure: ['Verse 1', 'Chorus', 'Verse 1'], sections: [{ type: 'Verse 1', lines: ['[G]Hi [C]there'] }, { type: 'Chorus', lines: ['[D]Yes', { type: 'modulate', semitones: 2 }] }] };
  it('renames everywhere the order names it', () => {
    expect(renameSection(arr, 0, 'Verse').structure).toEqual(['Verse', 'Chorus', 'Verse']);
  });
  it('deletes a section and its places in the order', () => {
    expect(deleteSection(arr, 0).structure).toEqual(['Chorus']);
  });
  it('adds a numbered section into a custom order', () => {
    const { arr: out, index } = addSection(arr, 0, 'Verse');
    expect(index).toBe(1);
    expect(out.sections[1].type).toBe('Verse 2');
    expect(newSectionName([{ type: 'Verse 1' }, { type: 'Verse 2' }], 'Verse')).toBe('Verse 3');
    expect(out.structure.at(-1)).toBe('Verse 2');
  });
  it('follows the sections when there is no custom order', () => {
    expect(playOrder({ structureMode: 'auto', structure: ['X'], sections: [{ type: 'A' }] })).toEqual(['A']);
    expect(playOrder(arr)).toEqual(arr.structure);
  });
  it('offers the chords the song uses first', () => {
    expect(chordPalette(arr).slice(0, 3)).toEqual(['G', 'C', 'D']);
  });
  it('round-trips a section through text', () => {
    expect(textToLines(sectionToText(arr.sections[1]))).toEqual(arr.sections[1].lines);
  });
});
