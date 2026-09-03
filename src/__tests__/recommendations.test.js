import { describe, it, expect } from 'vitest';
import { recommendNextSongs } from '@/recommendations';
import { songFromFlat } from '@/arrangements';

function v2Song({ id, key = 'G', tempo = 120, keyHistory = {}, tags, themes }) {
  const s = songFromFlat({ id, title: id, artist: 'A', key, tempo, time: '4/4', sections: [] });
  s.keyHistory = keyHistory;
  if (tags) s.tags = tags;
  if (themes) s.themes = themes;
  return s;
}

describe('recommendNextSongs', () => {
  it('returns least-played songs when the setlist is empty', () => {
    const songs = [
      v2Song({ id: 'common', keyHistory: { G: 10 } }),
      v2Song({ id: 'fresh',  keyHistory: {} }),
      v2Song({ id: 'mid',    keyHistory: { G: 2 } }),
    ];
    const recs = recommendNextSongs(songs, { items: [] });
    expect(recs[0].song.id).toBe('fresh');
    expect(recs.length).toBe(3);
  });

  it('excludes songs already on the setlist', () => {
    const songs = [v2Song({ id: 'a' }), v2Song({ id: 'b' })];
    const recs = recommendNextSongs(
      songs,
      { items: [{ songId: 'a', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    );
    expect(recs.map(r => r.song.id)).toEqual(['b']);
  });

  it('prefers candidates with compatible keys', () => {
    // Last song in C; closer in fifths: G (1 step), F (1 step). Far: F# (6 steps).
    const songs = [
      v2Song({ id: 'last',   key: 'C' }),
      v2Song({ id: 'close1', key: 'G' }),
      v2Song({ id: 'far',    key: 'F#' }),
    ];
    const recs = recommendNextSongs(
      songs,
      { items: [{ songId: 'last', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    );
    expect(recs[0].song.id).toBe('close1');
    expect(recs[1].song.id).toBe('far');
  });

  it('considers transpose when computing the last key', () => {
    const songs = [
      v2Song({ id: 'last', key: 'C' }),     // transposed +7 → G
      v2Song({ id: 'g',    key: 'G' }),     // distance 0
      v2Song({ id: 'f',    key: 'F' }),     // distance 1 from G
    ];
    const recs = recommendNextSongs(
      songs,
      { items: [{ songId: 'last', arrangementId: songs[0].defaultArrangementId, transpose: 7 }] },
    );
    expect(recs[0].song.id).toBe('g');
  });

  it('honours the limit option', () => {
    const songs = Array.from({ length: 10 }, (_, i) => v2Song({ id: `s${i}` }));
    const recs = recommendNextSongs(songs, { items: [] }, { limit: 2 });
    expect(recs.length).toBe(2);
  });

  it('boosts candidates sharing a theme with the set, and reports it', () => {
    // Both candidates equally far in key/tempo from the last song; the one that
    // shares the set's "advent" theme should win and carry a reason.
    const songs = [
      v2Song({ id: 'last', key: 'C', tags: ['advent'] }),
      v2Song({ id: 'onTheme',  key: 'F#', tags: ['advent'] }),
      v2Song({ id: 'offTheme', key: 'F#', tags: ['praise'] }),
    ];
    const recs = recommendNextSongs(
      songs,
      { items: [{ songId: 'last', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    );
    expect(recs[0].song.id).toBe('onTheme');
    expect(recs[0].reason).toBe('Shared theme: advent');
    expect(recs[0].breakdown.themeScore).toBeGreaterThan(0);
    expect(recs.find(r => r.song.id === 'offTheme').breakdown.themeScore).toBe(0);
  });

  it('returns suggestedKey from keyHistory when available', () => {
    const songs = [
      v2Song({ id: 'last', key: 'C' }),
      v2Song({ id: 's1',   key: 'G', keyHistory: { A: 5 } }),
    ];
    const recs = recommendNextSongs(
      songs,
      { items: [{ songId: 'last', arrangementId: songs[0].defaultArrangementId, transpose: 0 }] },
    );
    expect(recs[0].suggestedKey).toBe('A');
  });
});
