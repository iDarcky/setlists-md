// Repair text copied out of a web page before anything tries to parse it.
//
// Copying a chord sheet from a website drags along characters the page used for
// layout, not for meaning: zero-width spaces from a CMS, soft hyphens from
// justified text, non-breaking spaces from an HTML table, and words broken
// across a line wrap. Left alone they show up as "random spaces in the middle of
// a word", and they also break chord detection — `isChordToken('G ')` is
// false, so a whole chord row can silently become lyrics.

// Invisible characters that carry no text meaning at all.
const ZERO_WIDTH = /[​‌‍⁠﻿]/g;
// Soft hyphen: a *hint* that a word may break here. Copied text keeps it even
// though the break is gone.
const SOFT_HYPHEN = /­/g;
// Spaces that aren't the ASCII space: NBSP, the whole en-quad..hair-space run,
// narrow NBSP, and the ideographic space.
const ODD_SPACE = /[   -   　]/g;
// Windows-1252 smart punctuation, normalised so chord and lyric matching sees
// plain ASCII (a curly apostrophe in "n-am" is fine, but a prime in "D'" is not).
const SMART_QUOTES = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[–—]/g, '-'],
  [/…/g, '...'],
];

/**
 * Was a word split across a line break by the page's layout?
 *
 * Two shapes, both common in copied web text:
 *   "cu-\nvânt"  → hyphenated wrap        → rejoin without the hyphen
 *   "cuvâ\nnt"   → wrapped mid-word       → rejoin with nothing
 *
 * The second is only safe when the next line starts lowercase and the current
 * line ends with a letter — otherwise we'd weld two real words together, and a
 * chord sheet's short lines make false positives likely. When in doubt, leave
 * it: a stray space is a nuisance, a welded lyric is a corruption.
 */
function rejoinWrappedWords(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const hyphenWrap = /\p{L}-$/u.test(line) && next && /^\p{Ll}/u.test(next.trimStart());
    if (hyphenWrap) {
      out.push(line.replace(/-$/, '') + next.trimStart());
      i++; // consumed
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Clean text pasted from a web page (or anywhere else).
 *
 * Layout-only characters are removed; the text itself — including every
 * diacritic — is untouched. Trailing whitespace goes, but leading whitespace
 * stays: in a chord sheet, leading spaces position the chords.
 *
 * @param {string} text
 * @param {{ rejoinHyphens?: boolean }} [opts]
 * @returns {string}
 */
export function cleanPastedText(text, { rejoinHyphens = true } = {}) {
  if (!text) return '';
  let s = String(text)
    .replace(/\r\n?/g, '\n')
    .replace(ZERO_WIDTH, '')
    .replace(SOFT_HYPHEN, '')
    .replace(ODD_SPACE, ' ');
  for (const [re, to] of SMART_QUOTES) s = s.replace(re, to);

  let lines = s.split('\n').map(l => l.replace(/[ \t]+$/, ''));
  if (rejoinHyphens) lines = rejoinWrappedWords(lines);

  // Collapse runs of 3+ blank lines — pages love padding — but keep single
  // blanks, which separate sections.
  const collapsed = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === '') {
      blanks++;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    collapsed.push(l);
  }
  return collapsed.join('\n').replace(/^\n+/, '').replace(/\n+$/, '\n');
}
