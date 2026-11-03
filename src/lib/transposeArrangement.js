import { transposeKey, transposeKeepingSpelling, keyPrefersSharps } from '@/music';

// "Everyone" on the song page's Key popover: the arrangement itself moves to
// the new key. Stored chords are always in the arrangement's own key, so the
// only honest way to change that key for everyone is to rewrite every [chord].
//
// Untouched on purpose: tab blocks (frets, not chord names), {modulate} markers
// and `keyChanges` (both are intervals, which survive a transpose).

const CHORD = /\[([^\]]+)\]/g;

function moveLine(line, semis, toKey) {
  if (typeof line !== 'string') return line;
  return line.replace(CHORD, (m, inner) => {
    // Only things that start like a chord; "[x2]" or "[Intro]" stay.
    if (!/^[A-G]/.test(inner.trim())) return m;
    return `[${inner.split(/\s+/).map(c => (/^[A-G]/.test(c) ? transposeKeepingSpelling(c, semis, toKey) : c)).join(' ')}]`;
  });
}

/** The arrangement `semis` semitones away, with key and chords moved together. */
export function transposeArrangement(arr, semis) {
  if (!arr || !semis) return arr;
  const toKey = transposeKey(arr.key || 'C', semis, keyPrefersSharps(transposeKey(arr.key || 'C', semis)));
  return {
    ...arr,
    key: toKey,
    sections: (arr.sections || []).map(sec => ({ ...sec, lines: (sec.lines || []).map(l => moveLine(l, semis, toKey)) })),
  };
}
