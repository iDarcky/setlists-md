// ── Element 19 — the capo, and whose it is ──────────────────────────────────
//
// A capo is NOT a property of the song and NOT a property of the setlist. Two
// guitarists in the same band play the same song at different capos, and the
// moment one of them writes a capo onto shared data it changes what everybody
// else reads. That is exactly what the old shared `items[i].capo` did: the
// setlist builder wrote it, and `PerformanceView` / `PracticeView` /
// `SetlistPlayer` all subtracted it from the displayed transpose — so a
// guitarist setting capo 2 silently rewrote the chart for the bass player and
// the keys player too (owner, 2026-08-10: *"it sets the capo for everyone, not
// only for the guitar player, which is a huge red flag"*).
//
// So a capo is ONE NUMBER, PER SONG, PER PERSON. It lives in the user's own
// settings (`settings.songCapos`), follows the account through
// `PORTABLE_PREF_KEYS`, and is never written to a song or a setlist by anything
// in this file or its callers.
//
// What it does to the chart: the chart shows SHAPES. A song sounding in A with
// a capo on 2 is played with G shapes, so the chords render two semitones DOWN
// while the key pill keeps saying A — what the band is in — and the capo chip
// says how you get there. Both facts on screen at once; neither one lies.

import { transposeKey, semitonesBetween } from '@/music';

// The frets a capo can sensibly go on. Above 7 you are past the guitar's
// comfortable range and the shapes stop being the easy ones you wanted.
export const MAX_CAPO = 7;

// The open-chord families a guitarist actually wants to be in. Ordered by how
// common they are to play in, so ties resolve to the friendlier shape.
const OPEN_SHAPE_KEYS = ['G', 'C', 'D', 'A', 'E'];

/**
 * Where a capo would put you.
 *
 * `soundingKey` is what the band plays; the return is what you FINGER. Minor
 * keys keep their quality — a capo moves pitch, not mode.
 */
export function shapeKeyFor(soundingKey, capo) {
  if (!soundingKey || !capo) return soundingKey || null;
  return transposeKey(soundingKey, -capo);
}

/**
 * The capo this song wants, or null when it is already an easy key.
 *
 * Deliberately a SUGGESTION and not a mode. Auto-computing it outright was
 * considered and dropped (owner: *"I don't know if I'd want auto-computed, I
 * feel like it can be annoying"*) — it offers, you choose, and what you choose
 * is what sticks even if the leader later moves the key.
 *
 * Returns `{ capo, shapeKey }` for the smallest capo that lands on an open
 * shape family, or null when the sounding key IS one (capo 0 already works).
 */
export function suggestCapo(soundingKey, writtenCapo = 0) {
  if (!soundingKey) return null;
  // ⚠ The writer's own capo wins, when there is one. `arrangement.capo` is the
  // person who charted the song saying "this was played with a capo on 2", and
  // that is better information than any arithmetic — it is what the recording
  // does. It was also, until now, a field NOTHING read: the editor collected it
  // and its hint promised *"Shows capo shapes for guitarists alongside the real
  // chords"*, which was false (owner, 2026-08-10, on whether to delete it —
  // repurposing it makes an existing field true instead of throwing the writer's
  // knowledge away).
  const written = Number(writtenCapo);
  if (Number.isFinite(written) && written >= 1 && written <= MAX_CAPO) {
    return { capo: written, shapeKey: shapeKeyFor(soundingKey, written), from: 'song' };
  }
  for (let capo = 0; capo <= MAX_CAPO; capo += 1) {
    const shape = shapeKeyFor(soundingKey, capo);
    // Compare ROOTS, so Am suggests the same capo as A — the shape family is
    // about the fingering, and the quality rides along.
    const hit = OPEN_SHAPE_KEYS.some(k => semitonesBetween(k, shape) === 0);
    if (hit) return capo === 0 ? null : { capo, shapeKey: shape, from: 'shapes' };
  }
  return null;
}

/** This user's capo for this song. Never reads the song or the setlist. */
export function capoFor(settings, songId) {
  if (!songId) return 0;
  const n = settings?.songCapos?.[songId];
  return Number.isFinite(n) && n > 0 && n <= MAX_CAPO ? n : 0;
}

/**
 * The settings patch that sets (or clears) a capo.
 *
 * Clearing REMOVES the key rather than storing a 0. The map is a portable
 * preference synced to the account, and a library of 108 songs each carrying an
 * explicit `0` is 108 entries saying nothing.
 */
export function withCapo(settings, songId, capo) {
  const next = { ...(settings?.songCapos || {}) };
  if (!capo) delete next[songId];
  else next[songId] = Math.max(1, Math.min(MAX_CAPO, Math.round(capo)));
  return next;
}
