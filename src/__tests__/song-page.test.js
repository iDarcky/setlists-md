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
