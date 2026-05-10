// Recommends "next song" candidates for the setlist builder.
// Pure function — no React, easy to unit test.
//
// Scoring (fixed weights, intentionally simple — see plan):
//   - Key compatibility (50%): circle-of-fifths distance from the last
//     song's resolved key to each candidate's suggested key.
//   - Tempo proximity (25%): gaussian on BPM delta.
//   - Freshness (25%): least-played songs are favoured (prevents the same
//     three picks dominating every set).
//
// suggestedKey for a candidate is its mostPlayedKey (when known) else its
// default arrangement's source key. We score against that key, but the UI
// layer is free to honour or override it.

import { keyCompatibilityScore, tempoProximityScore, transposeKey } from './music.js';
import { getArrangement } from './arrangements.js';
import { mostPlayedKey, totalPlays } from './keyHistory.js';

const DEFAULT_WEIGHTS = { key: 0.5, tempo: 0.25, freshness: 0.25 };

export function recommendNextSongs(songs, setlist, opts = {}) {
  const { limit = 3, weights = DEFAULT_WEIGHTS } = opts;
  const items = setlist?.items || [];
  // Exclude songs already on the setlist so we don't recommend duplicates.
  const includedIds = new Set(items.filter(i => i?.songId).map(i => i.songId));
  const lastItem = [...items].reverse().find(i => i && i.type !== 'break' && i.songId);

  if (!lastItem) {
    // Empty setlist (or only breaks) → rank by freshness.
    return (songs || [])
      .filter(s => !includedIds.has(s.id))
      .map(s => {
        const arr = getArrangement(s);
        const plays = totalPlays(s.keyHistory);
        const freshness = 1 / (1 + plays);
        return {
          song: s,
          arrangement: arr,
          suggestedKey: mostPlayedKey(s.keyHistory) || arr?.key || 'C',
          score: freshness,
          breakdown: { keyScore: null, tempoScore: null, freshness },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  const lastSong = (songs || []).find(s => s.id === lastItem.songId);
  if (!lastSong) return [];
  const lastArr = getArrangement(lastSong, lastItem.arrangementId);
  const lastKey = transposeKey(lastArr?.key || 'C', lastItem.transpose || 0);
  const lastBpm = lastArr?.tempo || 120;

  return (songs || [])
    .filter(s => !includedIds.has(s.id))
    .map(s => {
      const arr = getArrangement(s);
      const suggestedKey = mostPlayedKey(s.keyHistory) || arr?.key || 'C';
      const keyScore = keyCompatibilityScore(lastKey, suggestedKey);
      const tempoScore = tempoProximityScore(lastBpm, arr?.tempo || 120);
      const plays = totalPlays(s.keyHistory);
      const freshness = 1 / (1 + plays);
      const score = (weights.key * keyScore)
        + (weights.tempo * tempoScore)
        + (weights.freshness * freshness);
      return {
        song: s,
        arrangement: arr,
        suggestedKey,
        score,
        breakdown: { keyScore, tempoScore, freshness },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
