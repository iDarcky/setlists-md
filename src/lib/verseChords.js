// Copy verse 1's chords onto the verses that have none.
//
// Romanian charts (Melodia.ro above all) print chords on the first verse only:
// the verses share a melody and players are expected to carry the chords
// across. A reader showing verse 3 bare is useless on a stage, so on import
// the chords can be carried across for them.
//
// A chord is placed by LOCATION: a chord a third of the way along verse 1's
// line goes a third of the way along the other verse's line, on the nearest
// letter. That needs no idea of words or syllables, so it works the same in
// any language (owner, 2026-11-14).
//
// Tested against a Melodia chart that prints chords on every verse ("Când
// moartea-i înfrânt-o", 36 chords on verses 2-4): by location 28 land on the
// right word, by syllable 29, by word 20. The syllable count it replaces only
// understood Romanian.
//
// A chord after the last letter stays at the end of the line. It is a guess,
// so it is opt-in and the leader can still fix a chord by hand.

const CHORD = /\[([^\]]+)\]/g;
const LETTER = /[\p{L}\p{N}]/u;

const isVerse = (s) => /^verse\b/i.test(s?.type || '');
const textLines = (s) => (s?.lines || []).filter(l => typeof l === 'string');
const hasChords = (line) => /\[[^\]]+\]/.test(line);
const sectionHasChords = (s) => textLines(s).some(hasChords);
const isLyricLine = (line) => typeof line === 'string' && line.trim() && !line.trim().startsWith('>') && !line.trim().startsWith('{');

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

// Chords of a source line as fractions of its length (0 = start, 1 = end); a
// chord after the last letter is `end`.
function chordSlots(line) {
  const { text, marks } = splitChords(line);
  const len = text.trimEnd().length;
  return marks.map(({ at, chord }) => (at >= len || !len)
    ? { chord, end: true }
    : { chord, frac: at / len });
}

// The letter nearest to `x`, so a chord never sits on a space or a comma.
function nearestLetter(text, x) {
  for (let d = 0; d < text.length; d++) {
    if (LETTER.test(text[x + d] || '')) return x + d;
    if (LETTER.test(text[x - d] || '')) return x - d;
  }
  return x;
}

function placeChords(line, slots) {
  // An end-of-line chord gets a space before it, so "dos[A]" reads "dos [A]".
  if (slots.some(s => s.end) && !/\s$/.test(line)) line = `${line} `;
  const len = line.trimEnd().length;
  const marks = slots.map(s => (s.end || !len)
    ? { at: line.length, chord: s.chord }
    : { at: nearestLetter(line, Math.min(len - 1, Math.round(s.frac * len))), chord: s.chord });
  // Insert from the back so earlier positions stay valid; chords that land on
  // the same letter keep their order.
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
 * chords, line by line, each at the same place along its line. Verses that already have any
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
