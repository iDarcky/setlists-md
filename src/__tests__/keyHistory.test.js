import { describe, it, expect } from 'vitest';
import {
  isPastSetlist,
  computeKeyHistories,
  applyKeyHistories,
  incrementForSetlistDiff,
  mostPlayedKey,
  totalPlays,
} from '@/keyHistory';
import { songFromFlat } from '@/arrangements';

const today = new Date('2026-05-10T10:00:00Z');

function v2Song({ id, key = 'G' } = {}) {
  return songFromFlat({ id, title: id, artist: 'A', key, tempo: 120, time: '4/4', sections: [] });
}

describe('isPastSetlist', () => {
  it('returns true for past dates', () => {
    expect(isPastSetlist({ date: '2026-05-09' }, today)).toBe(true);
    expect(isPastSetlist({ date: '2025-01-01' }, today)).toBe(true);
  });
  it('returns true for today', () => {
    expect(isPastSetlist({ date: '2026-05-10' }, today)).toBe(true);
  });
  it('returns false for future dates', () => {
    expect(isPastSetlist({ date: '2026-05-11' }, today)).toBe(false);
  });
  it('returns false for undated setlists', () => {
    expect(isPastSetlist({}, today)).toBe(false);
    expect(isPastSetlist({ date: null }, today)).toBe(false);
  });
});

describe('computeKeyHistories', () => {
  it('counts the resolved key per song across past setlists', () => {
    const songs = [v2Song({ id: 's1', key: 'G' })];
    const setlists = [
      { id: 'sl1', date: '2026-05-09', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 2 }] },
      { id: 'sl2', date: '2026-05-08', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 2 }] },
      { id: 'sl3', date: '2026-05-07', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    ];
    const histories = computeKeyHistories(songs, setlists, today);
    expect(histories.s1).toEqual({ A: 2, G: 1 });
  });

  it('ignores future setlists', () => {
    const songs = [v2Song({ id: 's1' })];
    const setlists = [
      { id: 'sl1', date: '2027-01-01', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    ];
    expect(computeKeyHistories(songs, setlists, today)).toEqual({});
  });

  it('skips break items', () => {
    const songs = [v2Song({ id: 's1' })];
    const setlists = [
      { id: 'sl1', date: '2026-05-09', items: [{ type: 'break', label: 'Prayer' }] },
    ];
    expect(computeKeyHistories(songs, setlists, today)).toEqual({});
  });
});

describe('applyKeyHistories', () => {
  it('attaches histories to each song by id, defaulting to {}', () => {
    const songs = [v2Song({ id: 'a' }), v2Song({ id: 'b' })];
    const out = applyKeyHistories(songs, { a: { G: 3 } });
    expect(out[0].keyHistory).toEqual({ G: 3 });
    expect(out[1].keyHistory).toEqual({});
  });
});

describe('incrementForSetlistDiff', () => {
  it('adds counts when a new past setlist is created', () => {
    let songs = [{ ...v2Song({ id: 's1' }), keyHistory: {} }];
    songs = incrementForSetlistDiff(
      songs,
      null,
      { id: 'sl', date: '2026-05-09', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
      today,
    );
    expect(songs[0].keyHistory).toEqual({ G: 1 });
  });

  it('subtracts the previous and adds the next when a past setlist is edited', () => {
    let songs = [{ ...v2Song({ id: 's1' }), keyHistory: { G: 2 } }];
    const prev = { id: 'sl', date: '2026-05-09', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] };
    const next = { id: 'sl', date: '2026-05-09', items: [{ songId: 's1', arrangementId: songs[0].defaultArrangementId, transpose: 2 }] };
    songs = incrementForSetlistDiff(songs, prev, next, today);
    expect(songs[0].keyHistory).toEqual({ G: 1, A: 1 });
  });

  it('is a no-op when both snapshots are future-dated', () => {
    let songs = [{ ...v2Song({ id: 's1' }), keyHistory: { G: 5 } }];
    const out = incrementForSetlistDiff(
      songs,
      { id: 'sl', date: '2027-01-01', items: [{ songId: 's1', transpose: 0 }] },
      { id: 'sl', date: '2027-02-01', items: [{ songId: 's1', transpose: 2 }] },
      today,
    );
    expect(out).toBe(songs);
  });
});

describe('mostPlayedKey + totalPlays', () => {
  it('mostPlayedKey returns the key with the highest count', () => {
    expect(mostPlayedKey({ G: 1, A: 5, Bb: 2 })).toBe('A');
    expect(mostPlayedKey({})).toBe(null);
    expect(mostPlayedKey(null)).toBe(null);
  });
  it('totalPlays sums the values', () => {
    expect(totalPlays({ G: 2, A: 3 })).toBe(5);
    expect(totalPlays({})).toBe(0);
    expect(totalPlays(null)).toBe(0);
  });
});
