import { describe, expect, it } from 'vitest';
import { lineGroups, ordinal, playName, splitChord, viewLine } from './lines';
import { songPlays, structureBoxes } from './plays';
import type { SongView } from './types';
import { applyFollowMsg, leaderAlive, LEADER_TIMEOUT_MS, yieldsTo, type FollowMsg, type FollowState } from './follow';

describe('viewLine', () => {
  it('keeps a chord with its word', () => {
    const v = viewLine('[G]Amazing [G7]grace');
    expect(v.kind).toBe('lyrics');
    if (v.kind !== 'lyrics') return;
    expect(v.hasChords).toBe(true);
    expect(v.groups.map(g => g.map(t => t.text).join(''))).toEqual(['Amazing ', 'grace']);
    expect(v.groups[1][0].chord).toBe('G7');
  });

  it('draws a chords-only line as bars', () => {
    expect(viewLine('[G] [G/B] [C] [G]')).toEqual({ kind: 'bars', chords: ['G', 'G/B', 'C', 'G'], notes: [] });
  });

  it('reads an empty line as a gap and skips modulate objects', () => {
    expect(viewLine('').kind).toBe('gap');
    expect(viewLine({ type: 'modulate', semitones: 2 }).kind).toBe('skip');
  });

  it('a word split by a chord stays one group', () => {
    expect(lineGroups('swe[C]et')).toHaveLength(1);
  });
});

describe('chord and names', () => {
  it('raises the extension, not the minor or the bass', () => {
    expect(splitChord('G7')).toEqual(['G', '7', '']);
    expect(splitChord('Am7')).toEqual(['Am', '7', '']);
    expect(splitChord('Dsus4/F#')).toEqual(['D', 'sus4', '/F#']);
    expect(splitChord('Cmaj7')).toEqual(['C', 'maj7', '']);
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st']);
  });
});

describe('songPlays', () => {
  const song: SongView = {
    id: 's', title: 'Test', key: 'G',
    sections: [
      { type: 'Verse 1', lines: ['[G]One'] },
      { type: 'Chorus', lines: ['[C]Two'] },
      { type: 'Tag', lines: ['[D]Three'] },
    ],
    structure: ['Verse 1', 'Chorus', 'Chorus', 'Tag', 'Tag'],
  };

  it('writes every play out and names the second time', () => {
    const plays = songPlays(song);
    expect(plays.map(playName)).toEqual(['Verse 1', 'Chorus', 'Chorus · 2nd time', 'Tag', 'Tag · 2nd time']);
    expect(plays[3].runCount).toBe(2);
  });

  it('one structure box per run', () => {
    const boxes = structureBoxes(songPlays(song));
    expect(boxes.map(b => [b.type, b.count])).toEqual([['Verse 1', 1], ['Chorus', 2], ['Tag', 2]]);
  });
});

describe('live follow', () => {
  const empty: FollowState = { leader: null, pos: null };
  const pos = (from: string, since: number, idx = 0, slot = 0): FollowMsg => ({ type: 'pos', from, name: from, at: since, since, pos: { idx, slot } });

  it('ignores its own messages', () => {
    expect(applyFollowMsg(empty, pos('me', 1), 'me')).toBe(empty);
  });
  it('takes the first leader and their position', () => {
    const s = applyFollowMsg(empty, pos('dana', 10, 2, 3), 'me');
    expect(s.leader?.name).toBe('dana');
    expect(s.pos).toEqual({ idx: 2, slot: 3 });
  });
  it('a newer leader takes over; an older message does not', () => {
    const a = applyFollowMsg(empty, pos('dana', 10), 'me');
    expect(applyFollowMsg(a, pos('sam', 5), 'me')).toBe(a);
    expect(applyFollowMsg(a, pos('sam', 20), 'me').leader?.id).toBe('sam');
  });
  it('stop from the leader clears it; stop from someone else does not', () => {
    const a = applyFollowMsg(empty, pos('dana', 10), 'me');
    expect(applyFollowMsg(a, { type: 'stop', from: 'sam', at: 11 }, 'me')).toBe(a);
    expect(applyFollowMsg(a, { type: 'stop', from: 'dana', at: 11 }, 'me').leader).toBeNull();
  });
  it('a silent leader times out', () => {
    const a = applyFollowMsg(empty, pos('dana', 1000), 'me');
    const seen = a.leader!.seen;
    expect(leaderAlive(a, seen + LEADER_TIMEOUT_MS - 1)).toBe(true);
    expect(leaderAlive(a, seen + LEADER_TIMEOUT_MS)).toBe(false);
  });
  it('a leader hands over only to a later Lead tap', () => {
    expect(yieldsTo(100, pos('sam', 50), 'me')).toBe(false);
    expect(yieldsTo(100, pos('sam', 150), 'me')).toBe(true);
    expect(yieldsTo(100, { type: 'stop', from: 'sam', at: 200 }, 'me')).toBe(false);
  });
});
