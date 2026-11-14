// Copy verse 1's chords onto the verses that have none.
//
// Romanian charts (Melodia.ro above all) print chords on the first verse only:
// the verses share a melody and players are expected to carry the chords
// across. A reader showing verse 3 bare is useless on a stage, so on import
// the chords can be carried across for them.
//
// A chord is placed by WORD: the chord on verse 1's third word goes on the
// third word of every other verse, at the word's start. Users asked for this
// (2026-11-13): an earlier version counted syllables, which landed chords in
// the middle of words and drifted whenever a verse had a different number of
// syllables. Words are easy to check by eye and easy to fix by hand.
//
// A chord in the middle of a word ("a[Eb]cum") counts as that word; a chord
// after the last word stays at the end of the line. A line with fewer words
// puts the extra chords on its last word, in order, rather than dropping any.
// It is a guess, so it is opt-in and the leader can still fix a chord by hand.

const CHORD = /\[([^\]]+)\]/g;
const LETTER = /[\p{L}\p{N}]/u;

const isVerse = (s) => /^verse\b/i.test(s?.type || '');
const textLines = (s) => (s?.lines || []).filter(l => typeof l === 'string');
const hasChords = (line) => /\[[^\]]+\]/.test(line);
const sectionHasChords = (s) => textLines(s).some(hasChords);
const isLyricLine = (line) => typeof line === 'string' && line.trim() && !line.trim().startsWith('>') && !line.trim().startsWith('{');

// Words of plain text: runs between spaces that hold at least one letter, so a
// lone "–" is not a word. "Mi-o" and "Și-atunci" stay one word each.
// `start` is where the word begins, `letter` where its first letter is (after
// an opening quote like „), `end` where it stops.
function words(text) {
  const out = [];
  for (const m of text.matchAll(/\S+/g)) {
    const off = m[0].search(LETTER);
    if (off === -1) continue;
    out.push({ start: m.index, letter: m.index + off, end: m.index + m[0].length });
  }
  return out;
}

// "[G]Isus îmi [C]spune" → { text: 'Isus îmi spune', marks: [{ at: 0, chord }, …] }
function splitChords(line) {
  const marks = [];
  let text = '';
  let last = 0;
  for (const m of line.matchAll(CHORD)) {
    text += line.slice(last, m.index);
    marks.push({ at: text.length, chord: m[1] });
    last = m.index + m[0].length;
  }
  text += line.slice(last);
  return { text, marks };
}

// Chords of a source line as word slots: `word` is the index of the word the
// chord sits on (or the next word, for a chord in the gap before it); a chord
// after the last word is `end`, kept at the end of the line.
function chordSlots(line) {
  const { text, marks } = splitChords(line);
  const ws = words(text);
  return marks.map(({ at, chord }) => {
    const word = ws.findIndex(w => at < w.end);
    return word === -1 ? { chord, end: true } : { chord, word };
  });
}

function placeChords(line, slots) {
  // An end-of-line chord gets a space before it, so "dos[A]" reads "dos [A]".
  if (slots.some(s => s.end) && !/\s$/.test(line)) line = `${line} `;
  const ws = words(line);
  const marks = slots.map(s => (s.end || !ws.length)
    ? { at: line.length, chord: s.chord }
    : { at: ws[Math.min(s.word, ws.length - 1)].letter, chord: s.chord });
  // Insert from the back so earlier positions stay valid; a stable reverse
  // keeps chords that share a word in their original order.
  let out = line;
  for (const m of [...marks].reverse()) out = `${out.slice(0, m.at)}[${m.chord}]${out.slice(m.at)}`;
  return out;
}

/** The verse whose chords would be copied, or null. */
function sourceVerse(sections) {
  return sections.find(s => isVerse(s) && sectionHasChords(s)) || null;
}

/** True when at least one verse could receive chords from another. */
export function canFillVerseChords(sections = []) {
  const src = sourceVerse(sections);
  return !!src && sections.some(s => s !== src && isVerse(s) && !sectionHasChords(s) && textLines(s).some(isLyricLine));
}

/**
 * New sections array with chordless verses given the first chorded verse's
 * chords, line by line and word by word. Verses that already have any
 * chord are left alone, as is everything that is not a verse. Returns the
 * same array when there is nothing to do.
 */
export function fillVerseChords(sections = []) {
  if (!canFillVerseChords(sections)) return sections;
  const src = sourceVerse(sections);
  const slots = src.lines.filter(isLyricLine).map(chordSlots);
  return sections.map(s => {
    if (s === src || !isVerse(s) || sectionHasChords(s)) return s;
    let n = 0;
    const lines = s.lines.map(line => {
      if (!isLyricLine(line)) return line;
      const i = n++;
      return i < slots.length && slots[i].length ? placeChords(line, slots[i]) : line;
    });
    return { ...s, lines };
  });
}

/** Apply to every arrangement of a v2 song. Returns the same song when unchanged. */
export function fillSongVerseChords(song) {
  if (!song?.arrangements) return song;
  let changed = false;
  const arrangements = song.arrangements.map(a => {
    const sections = fillVerseChords(a.sections || []);
    if (sections === a.sections) return a;
    changed = true;
    return { ...a, sections };
  });
  return changed ? { ...song, arrangements } : song;
}
