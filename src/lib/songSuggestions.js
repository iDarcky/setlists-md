import { semitonesBetween } from '@/music';

// Root note of a key, ignoring quality (e.g. "Am" -> "A", "Bbm7" -> "Bb").
function rootOf(key) {
  if (!key) return null;
  const m = String(key).match(/^[A-G][#b]?/);
  return m ? m[0] : null;
}

// How "compatible" two keys are for a smooth campfire transition, via the
// circle of fifths: same key > a fourth/fifth away > a third/sixth (relative).
function keyScore(a, b) {
  const ra = rootOf(a);
  const rb = rootOf(b);
  if (!ra || !rb) return 0;
  const d = semitonesBetween(ra, rb); // 0..11
  if (d === 0) return 3;                       // same root
  if (d === 5 || d === 7) return 2;            // perfect fourth / fifth
  if (d === 3 || d === 4 || d === 8 || d === 9) return 1; // third / sixth (relative-ish)
  return 0;
}

/**
 * Rank songs to play next after `current`, by key compatibility + shared
 * tags/themes + tempo proximity. Scoped to whatever `songs` you pass (caller
 * passes the active workspace's library). Falls back to other library songs
 * when nothing scores, so there's always something to continue with.
 *
 * @returns {object[]} up to `limit` songs, best first.
 */
export function suggestNextSongs(current, songs, { excludeIds = [], limit = 3 } = {}) {
  if (!current || !Array.isArray(songs)) return [];
  const exclude = new Set([current.id, ...excludeIds]);
  const curTags = new Set((current.tags || []).map((t) => String(t).toLowerCase()));

  const candidates = songs.filter((s) => s && s.id && !exclude.has(s.id));
  const scored = candidates
    .map((s) => {
      let score = keyScore(current.key, s.key);
      const shared = (s.tags || []).map((t) => String(t).toLowerCase()).filter((t) => curTags.has(t)).length;
      score += Math.min(shared, 3);
      if (current.tempo && s.tempo && Math.abs(Number(current.tempo) - Number(s.tempo)) <= 12) score += 1;
      return { song: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.song.title).localeCompare(String(b.song.title)));

  if (scored.length) return scored.slice(0, limit).map((x) => x.song);
  // Nothing matched — offer a few other songs so the set can keep going.
  return candidates.slice(0, limit);
}
