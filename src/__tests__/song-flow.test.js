import { describe, it, expect } from 'vitest';
import { orderSections, sectionModOffsets, repeatFirstIndex, buildSongFlow } from '@/lib/songFlow';

const sec = (type, lines = ['a']) => ({ type, lines });
const mod = n => ({ type: 'modulate', semitones: n });

describe('orderSections', () => {
  it('follows the structure, repeats included', () => {
    const song = {
      sections: [sec('Verse 1'), sec('Chorus')],
      structure: ['Verse 1', 'Chorus', 'Verse 1', 'Chorus'],
    };
    expect(orderSections(song).map(s => s.type)).toEqual(['Verse 1', 'Chorus', 'Verse 1', 'Chorus']);
  });

  it('falls back to document order when the structure does not resolve', () => {
    // "Bridge" does not exist — showing 2 of 3 named sections would silently
    // hide part of the song, which is worse on stage than ignoring structure.
    const song = {
      sections: [sec('Verse 1'), sec('Chorus')],
      structure: ['Verse 1', 'Bridge', 'Chorus'],
    };
    expect(orderSections(song).map(s => s.type)).toEqual(['Verse 1', 'Chorus']);
  });

  it('respects structureMode: doc', () => {
    const song = {
      sections: [sec('Verse 1'), sec('Chorus')],
      structure: ['Chorus', 'Verse 1'],
      structureMode: 'doc',
    };
    expect(orderSections(song).map(s => s.type)).toEqual(['Verse 1', 'Chorus']);
  });

  it('survives a missing structure and a missing song', () => {
    expect(orderSections({ sections: [sec('Verse 1')] }).length).toBe(1);
    expect(orderSections({}).length).toBe(0);
    expect(orderSections(undefined).length).toBe(0);
  });
});

describe('sectionModOffsets', () => {
  it('is zero without modulate markers', () => {
    expect(sectionModOffsets([sec('Verse 1'), sec('Chorus')])).toEqual([0, 0]);
  });

  it('stacks markers across the playback order', () => {
    const ordered = [
      sec('Verse 1'),
      sec('Chorus', ['a', mod(2), 'b']),
      sec('Verse 2'),
      sec('Bridge', [mod(1)]),
      sec('Tag'),
    ];
    // Offset is what a section is entered with, so the marker's own section
    // still starts at the previous offset.
    expect(sectionModOffsets(ordered)).toEqual([0, 0, 2, 2, 3]);
  });

  it('handles a section with no lines', () => {
    expect(sectionModOffsets([{ type: 'Verse 1' }])).toEqual([0]);
  });
});

describe('repeatFirstIndex', () => {
  it('marks a plain repeat', () => {
    const ordered = [sec('Verse 1'), sec('Chorus'), sec('Verse 2'), sec('Chorus')];
    const offsets = sectionModOffsets(ordered);
    expect(repeatFirstIndex(ordered, offsets)).toEqual([-1, -1, -1, 1]);
  });

  it('does NOT condense a repeat that follows a key change', () => {
    // The second chorus is +2 — different chords, so it must render in full.
    const chorus = sec('Chorus');
    const ordered = [chorus, sec('Verse', ['a', mod(2), 'b']), chorus];
    const offsets = sectionModOffsets(ordered);
    expect(offsets).toEqual([0, 0, 2]);
    expect(repeatFirstIndex(ordered, offsets)).toEqual([-1, -1, -1]);
  });

  it('points every later repeat at the first occurrence', () => {
    const c = sec('Chorus');
    const ordered = [c, c, c];
    expect(repeatFirstIndex(ordered, sectionModOffsets(ordered))).toEqual([-1, 0, 0]);
  });

  it('prefers a stable id over the type name', () => {
    const a = { id: 'x1', type: 'Chorus', lines: ['a'] };
    const b = { id: 'x2', type: 'Chorus', lines: ['b'] };
    // Same displayed name, different sections — not a repeat.
    expect(repeatFirstIndex([a, b], [0, 0])).toEqual([-1, -1]);
  });
});

describe('buildSongFlow', () => {
  it('returns all three in agreement', () => {
    const song = {
      sections: [sec('Verse 1'), sec('Chorus', ['a', mod(2)])],
      structure: ['Verse 1', 'Chorus', 'Verse 1'],
    };
    const { ordered, offsets, repeats } = buildSongFlow(song);
    expect(ordered.map(s => s.type)).toEqual(['Verse 1', 'Chorus', 'Verse 1']);
    expect(offsets).toEqual([0, 0, 2]);
    // The repeated Verse 1 is now +2, so it is not a condensable repeat.
    expect(repeats).toEqual([-1, -1, -1]);
  });
});
