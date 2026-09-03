import { describe, it, expect } from 'vitest';
import {
  normalizeTempo,
  resolvedTempoForItem,
  computeTempoHistories,
  applyTempoHistories,
  incrementTempoForSetlistDiff,
  mostPlayedTempo,
  totalTempoPlays,
  rankedTempos,
  tempoHistoryIsInteresting,
} from '@/tempoHistory';
import { songFromFlat, resolveSongView } from '@/arrangements';
import { migrateSongShape } from '@/storage';

const today = new Date('2026-05-10T10:00:00Z');

function v2Song({ id, tempo = 120 } = {}) {
  return songFromFlat({ id, title: id, artist: 'A', key: 'G', tempo, time: '4/4', sections: [] });
}

const at = (song, tempo) => ({
  songId: song.id,
  arrangementId: song.defaultArrangementId,
  ...(tempo === undefined ? null : { tempo }),
});

describe('normalizeTempo', () => {
  it('accepts positive numbers and numeric strings', () => {
    expect(normalizeTempo(72)).toBe(72);
    expect(normalizeTempo('76')).toBe(76);
    expect(normalizeTempo(72.4)).toBe(72);
  });
  it('rejects everything that is not a tempo', () => {
    for (const v of [null, undefined, 0, -80, '', '  ', 'fast', NaN]) {
      expect(normalizeTempo(v)).toBe(null);
    }
  });
});

describe('resolvedTempoForItem', () => {
  it('prefers the item override over the arrangement tempo', () => {
    const song = v2Song({ id: 's1', tempo: 120 });
    expect(resolvedTempoForItem(at(song, 72), song)).toBe('72');
  });
  it('falls back to the arrangement tempo when the item has no override', () => {
    const song = v2Song({ id: 's1', tempo: 120 });
    expect(resolvedTempoForItem(at(song), song)).toBe('120');
    expect(resolvedTempoForItem(at(song, null), song)).toBe('120');
  });
  it('is null when neither the item nor the arrangement has a tempo', () => {
    const song = v2Song({ id: 's1', tempo: null });
    expect(resolvedTempoForItem(at(song), song)).toBe(null);
    expect(resolvedTempoForItem(null, song)).toBe(null);
    expect(resolvedTempoForItem(at(song), null)).toBe(null);
  });
});

describe('computeTempoHistories', () => {
  it('counts the resolved tempo per song across past setlists', () => {
    const songs = [v2Song({ id: 's1', tempo: 120 })];
    const s1 = songs[0];
    const setlists = [
      { id: 'sl1', date: '2026-05-09', items: [at(s1, 72)] },
      { id: 'sl2', date: '2026-05-08', items: [at(s1, 72)] },
      { id: 'sl3', date: '2026-05-07', items: [at(s1)] },
    ];
    expect(computeTempoHistories(songs, setlists, today).s1).toEqual({ 72: 2, 120: 1 });
  });

  it('ignores future setlists', () => {
    const songs = [v2Song({ id: 's1' })];
    const setlists = [{ id: 'sl1', date: '2027-01-01', items: [at(songs[0], 72)] }];
    expect(computeTempoHistories(songs, setlists, today)).toEqual({});
  });

  it('skips break items and songs with no tempo anywhere', () => {
    const songs = [v2Song({ id: 's1', tempo: null })];
    const setlists = [{
      id: 'sl1',
      date: '2026-05-09',
      items: [{ type: 'break', label: 'Prayer' }, at(songs[0])],
    }];
    expect(computeTempoHistories(songs, setlists, today)).toEqual({});
  });

  it('never records a zero tempo', () => {
    const songs = [v2Song({ id: 's1', tempo: 120 })];
    const setlists = [{ id: 'sl1', date: '2026-05-09', items: [at(songs[0], 0)] }];
    // 0 is not an override — it falls through to the arrangement's own tempo.
    expect(computeTempoHistories(songs, setlists, today).s1).toEqual({ 120: 1 });
  });
});

describe('applyTempoHistories', () => {
  it('attaches histories to each song by id, defaulting to {}', () => {
    const songs = [v2Song({ id: 'a' }), v2Song({ id: 'b' })];
    const out = applyTempoHistories(songs, { a: { 72: 3 } });
    expect(out[0].tempoHistory).toEqual({ 72: 3 });
    expect(out[1].tempoHistory).toEqual({});
  });

  it('preserves object identity for songs whose history is unchanged', () => {
    const songs = [{ ...v2Song({ id: 'a' }), tempoHistory: { 72: 3 } }];
    expect(applyTempoHistories(songs, { a: { 72: 3 } })).toBe(songs);
    expect(applyTempoHistories(songs, { a: { 72: 3 } })[0]).toBe(songs[0]);
  });

  it('leaves untouched songs by reference when only one changed', () => {
    const songs = [
      { ...v2Song({ id: 'a' }), tempoHistory: { 72: 3 } },
      { ...v2Song({ id: 'b' }), tempoHistory: {} },
    ];
    const out = applyTempoHistories(songs, { a: { 72: 4 }, b: {} });
    expect(out).not.toBe(songs);
    expect(out[1]).toBe(songs[1]);
    expect(out[0].tempoHistory).toEqual({ 72: 4 });
  });
});

describe('incrementTempoForSetlistDiff', () => {
  it('adds counts when a new past setlist is created', () => {
    let songs = [{ ...v2Song({ id: 's1' }), tempoHistory: {} }];
    songs = incrementTempoForSetlistDiff(
      songs, null, { id: 'sl', date: '2026-05-09', items: [at(songs[0], 72)] }, today,
    );
    expect(songs[0].tempoHistory).toEqual({ 72: 1 });
  });

  it('subtracts the previous and adds the next when a past setlist is edited', () => {
    let songs = [{ ...v2Song({ id: 's1' }), tempoHistory: { 72: 2 } }];
    const prev = { id: 'sl', date: '2026-05-09', items: [at(songs[0], 72)] };
    const next = { id: 'sl', date: '2026-05-09', items: [at(songs[0], 76)] };
    songs = incrementTempoForSetlistDiff(songs, prev, next, today);
    expect(songs[0].tempoHistory).toEqual({ 72: 1, 76: 1 });
  });

  it('drops a tempo whose count falls to zero', () => {
    let songs = [{ ...v2Song({ id: 's1' }), tempoHistory: { 72: 1 } }];
    const prev = { id: 'sl', date: '2026-05-09', items: [at(songs[0], 72)] };
    songs = incrementTempoForSetlistDiff(songs, prev, null, today);
    expect(songs[0].tempoHistory).toEqual({});
  });

  it('is a no-op when both snapshots are future-dated', () => {
    const songs = [{ ...v2Song({ id: 's1' }), tempoHistory: { 72: 5 } }];
    const out = incrementTempoForSetlistDiff(
      songs,
      { id: 'sl', date: '2027-01-01', items: [at(songs[0], 72)] },
      { id: 'sl', date: '2027-02-01', items: [at(songs[0], 76)] },
      today,
    );
    expect(out).toBe(songs);
  });
});

describe('mostPlayedTempo + totalTempoPlays + rankedTempos', () => {
  it('mostPlayedTempo returns the BPM with the highest count, as a number', () => {
    expect(mostPlayedTempo({ 72: 1, 76: 5, 80: 2 })).toBe(76);
    expect(mostPlayedTempo({})).toBe(null);
    expect(mostPlayedTempo(null)).toBe(null);
  });
  it('totalTempoPlays sums the values', () => {
    expect(totalTempoPlays({ 72: 2, 76: 3 })).toBe(5);
    expect(totalTempoPlays(null)).toBe(0);
  });
  it('rankedTempos sorts by count, then by the slower tempo first', () => {
    expect(rankedTempos({ 80: 2, 72: 2, 76: 5 })).toEqual([[76, 5], [72, 2], [80, 2]]);
    expect(rankedTempos(null)).toEqual([]);
  });
});

// ⚠ Every display site reads a *resolved* view, not the stored song, and a
// legacy flat song is re-wrapped on load. A history that survives the compute
// but is dropped by one of these is READER.md's trap 23 — a control with
// nothing behind it — and it is invisible until someone squints at a chip that
// never appears.
describe('the history survives every shape the song is passed through', () => {
  it('rides on the resolved arrangement view the reader and hub read', () => {
    const song = { ...v2Song({ id: 's1' }), tempoHistory: { 72: 4 } };
    expect(resolveSongView(song, song.defaultArrangementId).tempoHistory).toEqual({ 72: 4 });
  });

  it('is carried through the legacy flat → v2 wrap', () => {
    expect(songFromFlat({ id: 's1', title: 'T', tempoHistory: { 72: 4 } }).tempoHistory)
      .toEqual({ 72: 4 });
  });

  it('defaults to {} for a song stored before the field existed', () => {
    expect(migrateSongShape({ id: 's1', title: 'T', key: 'G', sections: [] }).tempoHistory)
      .toEqual({});
  });
});

describe('tempoHistoryIsInteresting', () => {
  it('is false for an empty history', () => {
    expect(tempoHistoryIsInteresting({}, 120)).toBe(false);
    expect(tempoHistoryIsInteresting(null, 120)).toBe(false);
  });
  it('is false when the one recorded tempo is the song\'s own', () => {
    expect(tempoHistoryIsInteresting({ 120: 6 }, 120)).toBe(false);
    expect(tempoHistoryIsInteresting({ 120: 6 }, '120')).toBe(false);
  });
  it('is true when the band plays it at a different tempo than the chart says', () => {
    expect(tempoHistoryIsInteresting({ 72: 6 }, 120)).toBe(true);
  });
  it('is true as soon as there are two distinct tempos', () => {
    expect(tempoHistoryIsInteresting({ 120: 6, 124: 1 }, 120)).toBe(true);
  });
  it('is true when the song has no tempo of its own to compare against', () => {
    expect(tempoHistoryIsInteresting({ 72: 3 }, null)).toBe(true);
  });
});
