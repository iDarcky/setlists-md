import { describe, it, expect } from 'vitest';
import { orderSections, sectionModOffsets, repeatFirstIndex, repeatRuns, buildSongFlow } from '@/lib/songFlow';

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

describe('repeatRuns', () => {
  // Owner, 2026-08-06: four bridges drew a bridge and three identical tags,
  // *"they look ugly, can we unify them somehow?"* — collapsed the way the
  // ribbon already collapses chips: CONSECUTIVE ONLY, never a global tally.
  const runs = (repeats) => repeatRuns(repeats.map(() => ({})), repeats);

  it('collapses a back-to-back run into one pill', () => {
    // Bridge, then three more bridges.
    const r = runs([-1, 0, 0, 0]);
    expect(r[0]).toBeNull();
    expect(r[1]).toEqual({ lead: true, count: 3, slots: [1, 2, 3] });
    expect(r[2]).toEqual({ lead: false, of: 1 });
    expect(r[3]).toEqual({ lead: false, of: 1 });
  });

  it('does NOT collapse repeats that are apart in the song', () => {
    // Chorus · Verse 2 · Chorus — two separate moments, two separate tags.
    const r = runs([-1, -1, 0, -1, 0]);
    expect(r[2]).toEqual({ lead: true, count: 1, slots: [2] });
    expect(r[4]).toEqual({ lead: true, count: 1, slots: [4] });
  });

  it('keeps runs of different sections apart even when adjacent', () => {
    // …Chorus-repeat, Bridge-repeat: adjacent, but not the same section.
    const r = runs([-1, -1, 0, 1]);
    expect(r[2]).toEqual({ lead: true, count: 1, slots: [2] });
    expect(r[3]).toEqual({ lead: true, count: 1, slots: [3] });
  });

  it('rides along on buildSongFlow', () => {
    const song = {
      structureMode: 'doc',
      sections: [{ type: 'Chorus', lines: ['a'] }, { type: 'Chorus', lines: ['a'] }],
    };
    expect(buildSongFlow(song).runs[1]).toEqual({ lead: true, count: 1, slots: [1] });
  });

  it('re-groups when a repeat is opened in place', () => {
    // Owner, 2026-08-06: *"if I have 3 and I close the last one, I lose it
    // until I close the 2nd to last one then it appears as x2."* The runs were
    // computed from the song alone, so a closed slot whose run-lead was still
    // OPEN became a non-lead member — and a non-lead member draws nothing.
    const repeats = [-1, 0, 0, 0];
    const ordered = repeats.map(() => ({}));
    const open = (...idx) => repeatRuns(ordered, repeats, (i) => !idx.includes(i));

    // All three open: no pills at all.
    expect(open(1, 2, 3).every(r => r === null)).toBe(true);
    // Only the LAST closed: it is its own pill, not a lost member.
    expect(open(1, 2)[3]).toEqual({ lead: true, count: 1, slots: [3] });
    // Two closed and adjacent: one pill for both.
    expect(open(1)[2]).toEqual({ lead: true, count: 2, slots: [2, 3] });
    expect(open(1)[3]).toEqual({ lead: false, of: 2 });
    // None open: back to one pill for the whole run.
    expect(open()[1]).toEqual({ lead: true, count: 3, slots: [1, 2, 3] });
  });
});
