/**
 * Transposing guitar tab — safely, or not at all.
 *
 * Chords follow a key change; tab historically did not, so a song played a
 * step up showed the right chords over the wrong frets. Shifting every fret
 * number by N is musically correct, but two things break it:
 *
 *  - **Open strings.** Fret 0 shifted down goes negative. That note is below
 *    the string's pitch and cannot be played there at all.
 *  - **Playability.** A riff at frets 0–3 shifted up 5 is technically right
 *    and physically a different piece: different hand position, no open
 *    strings ringing, probably a capo decision the arranger already made.
 *
 * So: transpose when it is safe, and flag when it is not. Never silently show
 * a tab that cannot be played.
 */

// Beyond this the fingering is a real judgement call, not arithmetic.
export const LARGE_SHIFT = 4;
// Past this the notes are off the end of a typical neck.
const MAX_FRET = 22;

/** Shift every fret number in one tab line, or return null if it cannot. */
export function transposeTabLine(content, semitones) {
  if (!semitones) return content;
  let failed = false;
  const out = String(content).replace(/\d+/g, (m) => {
    const n = Number(m) + semitones;
    if (n < 0 || n > MAX_FRET) { failed = true; return m; }
    return String(n);
  });
  return failed ? null : out;
}

/**
 * @returns {{
 *   strings: Array<{note:string, content:string}>,
 *   transposed: boolean,   // did the frets actually move?
 *   flagged: boolean,      // should the UI say what key it is written in?
 *   reason: 'none'|'out-of-range'|'large-shift'
 * }}
 */
export function transposeTab(strings, semitones) {
  const src = strings || [];
  if (!semitones) {
    return { strings: src, transposed: false, flagged: false, reason: 'none' };
  }

  const shifted = src.map(s => ({ ...s, content: transposeTabLine(s.content, semitones) }));

  // If ANY string could not move, none of them do — a half-transposed tab is
  // worse than an honestly-labelled original.
  if (shifted.some(s => s.content === null)) {
    return { strings: src, transposed: false, flagged: true, reason: 'out-of-range' };
  }

  // It moved, but far enough that the fingering is now the player's call.
  if (Math.abs(semitones) > LARGE_SHIFT) {
    return { strings: shifted, transposed: true, flagged: true, reason: 'large-shift' };
  }

  return { strings: shifted, transposed: true, flagged: false, reason: 'none' };
}
