// Recommends "next song" candidates for the setlist builder.
// Pure function — no React, easy to unit test.
//
// Scoring (fixed weights, intentionally simple — see plan):
//   - Key compatibility (40%): circle-of-fifths distance from the last
//     song's resolved key to each candidate's suggested key.
//   - Tempo proximity (20%): gaussian on BPM delta.
//   - Theme overlap (20%): how much of a candidate's tags/themes are already
//     represented in the set (keeps a set thematically coherent — e.g. an
//     "advent" set surfaces more advent songs). Zero when the set has no
//     themes yet, so early picks stay key/tempo/freshness driven.
//   - Freshness (20%): least-played songs are favoured (prevents the same
//     three picks dominating every set).
//
// suggestedKey for a candidate is its mostPlayedKey (when known) else its
// default arrangement's source key. We score against that key, but the UI
// layer is free to honour or override it. Each recommendation also carries a
// short human `reason` string the panel can show ("Shared theme: grace", …).

import { keyCompatibilityScore, tempoProximityScore, transposeKey } from './music.js';
import { getArrangement } from './arrangements.js';
import { mostPlayedKey, totalPlays } from './keyHistory.js';
import { splitMulti } from './lib/songFacets.js';

const DEFAULT_WEIGHTS = { key: 0.4, tempo: 0.2, theme: 0.2, freshness: 0.2 };

// A song's "theme tokens": its tags + theme/genre metadata, original-cased for
// display but compared case-insensitively.
function songThemeTokens(song) {
  return splitMulti(song?.tags, song?.themes, song?.genres);
}

export function recommendNextSongs(songs, setlist, opts = {}) {
  const { limit = 3, weights = DEFAULT_WEIGHTS } = opts;
  const items = setlist?.items || [];
  // Exclude songs already on the setlist so we don't recommend duplicates.
  const includedIds = new Set(items.filter(i => i?.songId).map(i => i.songId));
  const lastItem = [...items].reverse().find(i => i && i.type !== 'break' && i.songId);

  // Theme tokens already present in the set (lowercased set for matching).
  const setThemeLower = new Set();
  for (const s of songs || []) {
    if (!includedIds.has(s.id)) continue;
    for (const t of songThemeTokens(s)) setThemeLower.add(t.toLowerCase());
  }

  // Theme overlap for a candidate: fraction of its tokens already in the set,
  // plus the first matching token (original case) for the reason string.
  function themeMatch(song) {
    const tokens = songThemeTokens(song);
    if (tokens.length === 0 || setThemeLower.size === 0) return { score: 0, shared: null };
    let hits = 0;
    let shared = null;
    for (const t of tokens) {
      if (setThemeLower.has(t.toLowerCase())) {
        hits += 1;
        if (!shared) shared = t;
      }
    }
    return { score: hits / tokens.length, shared };
  }

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
          reason: plays === 0 ? 'Fresh pick' : 'Rarely played lately',
          breakdown: { keyScore: null, tempoScore: null, themeScore: null, freshness },
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
      const { score: themeScore, shared } = themeMatch(s);
      const plays = totalPlays(s.keyHistory);
      const freshness = 1 / (1 + plays);
      const score = (weights.key * keyScore)
        + (weights.tempo * tempoScore)
        + (weights.theme * themeScore)
        + (weights.freshness * freshness);
      // Pick the strongest human-readable reason.
      let reason;
      if (shared) reason = `Shared theme: ${shared}`;
      else if (keyScore >= 0.8) reason = `Pairs with your ${lastKey} set`;
      else if (tempoScore >= 0.8) reason = 'Similar tempo';
      else if (plays === 0) reason = 'Fresh pick';
      else reason = 'Good all-round fit';
      return {
        song: s,
        arrangement: arr,
        suggestedKey,
        score,
        reason,
        breakdown: { keyScore, tempoScore, themeScore, freshness },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
