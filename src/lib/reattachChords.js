// Put a section's chords back on its words after the words were edited as
// plain text (the chart's "Lyrics" box).
//
// The chords used to go back by LINE NUMBER: line 3's chords onto whatever is
// line 3 now. A line with only chords on it shows up in that box as an empty
// line, so adding or removing one line (an empty-looking one most of all) slid
// every chord after it onto the wrong line, and Source showed chords piled at
// the ends of lines (INS-82, 20 Nov 2026).
//
// Now the old and new lines are matched the way a diff matches them: a line
// whose words did not change keeps its own chords wherever it moved to; lines
// that were changed in place keep theirs in order (clamped to the new length,
// the editor's "nudged to fit"), words with words and chord-only lines with
// empty ones; a new line has none; a removed line takes its chords with it.

import { lineToPlacement, placementToLine } from '@/parser';

const clamp = (chords, plainText) => {
  const max = (plainText || '').length;
  return chords.map(c => ({ ...c, pos: Math.min(c.pos, max) }));
};

/**
 * @param {string[]} base  the lines as they were, chords included ("[G]Hello")
 * @param {string[]} words the edited lines, words only
 * @returns {string[]} the edited lines with the chords back on them
 */
export function reattachChords(base, words) {
  const old = base.map(l => lineToPlacement(typeof l === 'string' ? l : ''));
  const a = old.map(p => p.plainText);
  const b = words;
  const n = a.length;
  const m = b.length;
  // Longest common run of unchanged lines (sections are a few dozen lines).
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const from = new Array(m).fill(-1); // new line j takes its chords from old line from[j]
  let i = 0;
  let j = 0;
  let hunkOld = [];
  let hunkNew = [];
  // Inside a run of changed lines, pair old and new in order: a line edited in
  // place keeps its chords. Lines with words pair with lines with words, and
  // empty-looking (chord-only) lines with empty ones, so deleting a chord line
  // while also editing the words never moves its chords onto the words.
  const blank = (s) => !s.trim();
  const flush = () => {
    for (const isBlank of [true, false]) {
      const o = hunkOld.filter(x => blank(a[x]) === isBlank);
      const w = hunkNew.filter(x => blank(b[x]) === isBlank);
      for (let k = 0; k < Math.min(o.length, w.length); k++) from[w[k]] = o[k];
    }
    hunkOld = [];
    hunkNew = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); from[j] = i; i++; j++; }
    else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) { hunkNew.push(j); j++; }
    else { hunkOld.push(i); i++; }
  }
  flush();
  return b.map((plainText, k) => {
    const chords = from[k] < 0 ? [] : clamp(old[from[k]].chords, plainText);
    return chords.length ? placementToLine({ plainText, chords }) : plainText;
  });
}
