// `{modulate}` on a repeated section — once by default, `every` to climb.
//
// The bug this encodes was reported the moment the feature was used: a
// `{modulate}` lives in the section BODY, so replaying the section replayed the
// shift. Owner, 2026-08-11: *"I have C1 and I wanted to add another C1 but
// because C1 already had the modulate it modulated again."*
//
// Both behaviours are real music — "modulate then repeat in the new key" and "a
// chorus that climbs every time" — and the format could only say the second.
import { describe, it, expect } from 'vitest';
import { sectionModPlan, buildSongFlow } from '@/lib/songFlow';
import { parseSongMd, songToMd } from '@/parser';

const chorus = (marker) => ({ type: 'Chorus', lines: ['[C]one', marker, '[C]two'] });

describe('a repeated section and its modulate', () => {
  it('fires once: the repeat holds the new key', () => {
    const c = chorus({ type: 'modulate', semitones: 2 });
    // The SAME object twice — `orderSections` resolves repeats by reference,
    // which is what "first time" is measured against.
    const { offsets, fires } = sectionModPlan([c, c]);
    expect(offsets).toEqual([0, 2]);
    expect(fires).toEqual([true, false]);
  });

  it('`every` climbs on each repeat', () => {
    const c = chorus({ type: 'modulate', semitones: 2, every: true });
    const { offsets, fires } = sectionModPlan([c, c]);
    expect(offsets).toEqual([0, 2]);
    expect(fires).toEqual([true, true]);
    // Third time through is +4 going in, which is the climbing chorus.
    expect(sectionModPlan([c, c, c]).offsets).toEqual([0, 2, 4]);
  });

  it('a once-marker still shifts everything AFTER it', () => {
    // Firing once is not the same as firing never: the sections that follow
    // stay in the new key.
    const c = chorus({ type: 'modulate', semitones: 2 });
    const bridge = { type: 'Bridge', lines: ['[C]three'] };
    expect(sectionModPlan([c, c, bridge]).offsets).toEqual([0, 2, 2]);
  });

  it('two different sections each fire their own', () => {
    const c = chorus({ type: 'modulate', semitones: 2 });
    const b = { type: 'Bridge', lines: [{ type: 'modulate', semitones: 1 }, '[C]x'] };
    expect(sectionModPlan([c, b, c]).offsets).toEqual([0, 2, 3]);
  });

  it('buildSongFlow carries `fires` through', () => {
    const song = {
      structure: ['Chorus', 'Chorus'],
      sections: [{ type: 'Chorus', lines: ['[C]one', { type: 'modulate', semitones: 2 }] }],
    };
    const flow = buildSongFlow(song);
    expect(flow.fires).toEqual([true, false]);
  });
});

describe('the .md format', () => {
  const md = (body) => `---\ntitle: T\nartist: A\nkey: C\n---\n\n## Chorus\n${body}\n`;

  it('parses a bare marker with no `every` key at all', () => {
    const song = parseSongMd(md('{modulate: +2}'));
    const marker = song.sections[0].lines.find(l => l?.type === 'modulate');
    expect(marker.semitones).toBe(2);
    // ABSENT, not false. The sync engines hash these objects; a new
    // always-present key would make every stored song look changed.
    expect('every' in marker).toBe(false);
  });

  it('parses `every`', () => {
    const song = parseSongMd(md('{modulate: +2, every}'));
    expect(song.sections[0].lines.find(l => l?.type === 'modulate').every).toBe(true);
  });

  it('round-trips both, byte-exact', () => {
    for (const line of ['{modulate: +2}', '{modulate: +2, every}', '{modulate: -3}']) {
      const out = songToMd(parseSongMd(md(line)));
      expect(out).toContain(line);
    }
  });

  it('still reads a negative and a spaced variant', () => {
    expect(parseSongMd(md('{modulate: -2}')).sections[0].lines
      .find(l => l?.type === 'modulate').semitones).toBe(-2);
    expect(parseSongMd(md('{modulate: +2 , every}')).sections[0].lines
      .find(l => l?.type === 'modulate').every).toBe(true);
  });
});
