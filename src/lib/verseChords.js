// Copy verse 1's chords onto the verses that have none.
//
// Romanian charts (Melodia.ro above all) print chords on the first verse only:
// the verses share a melody and players are expected to carry the chords
// across. A reader showing verse 3 bare is useless on a stage, so on import
// the chords can be carried across for them.
//
// A chord is placed by SYLLABLE, not by character: verse 1 "[G]Isus îmi
// spune azi" and verse 2 "Isuse, eu acum" share a melody note-for-note, not
// letter-for-letter. Syllables are counted as vowel groups, which is close
// enough in Romanian (diphthongs like "ea", "oa", "ie" stay one group; a
// silent final "i" is skipped). Hiatus ("fi-u-le") undercounts now and then.
// It is a guess, so it is opt-in and the leader can still fix a chord by hand.

const CHORD = /\[([^\]]+)\]/g;
const VOWEL_RUN = /[aeiouăâîAEIOUĂÂÎ]+/g;
const LETTER = /[\p{L}]/u;

const isVerse = (s) => /^verse\b/i.test(s?.type || '');
const textLines = (s) => (s?.lines || []).filter(l => typeof l === 'string');
const hasChords = (line) => /\[[^\]]+\]/.test(line);
const sectionHasChords = (s) => textLines(s).some(hasChords);
const isLyricLine = (line) => typeof line === 'string' && line.trim() && !line.trim().startsWith('>') && !line.trim().startsWith('{');

// Positions where each syllable's vowel group starts, in plain text. A
// word-final "i" after a consonant is silent in Romanian ("veci", "ești",
// "pomi") and is not a syllable, unless it is the word's only vowel ("și").
function nuclei(text) {
  const out = [];
  for (const w of text.matchAll(/[\p{L}]+/gu)) {
    const groups = [...w[0].matchAll(VOWEL_RUN)];
    const last = groups[groups.length - 1];
    if (!last) continue;
    const silentI = groups.length > 1 && last[0].toLowerCase() === 'i'
      && last.index === w[0].length - 1 && !/[aeiouăâî]/i.test(w[0][last.index - 1]);
    // A clitic hooked on with a hyphen ("ce-mi", "s-a", "m-a") rides on its
    // neighbour's syllable when its only vowel is that silent "i".
    const clitic = groups.length === 1 && last[0].toLowerCase() === 'i' && text[w.index - 1] === '-'
      && last.index === w[0].length - 1 && last.index > 0;
    if (clitic) continue;
    for (const g of silentI ? groups.slice(0, -1) : groups) out.push(w.index + g.index);
  }
  return out;
}

// Where a syllable begins: its vowel, plus the consonants in front of it that
// belong to it — all of them at a word's start, otherwise one (V-CV split).
function onset(text, vowelAt) {
  let i = vowelAt;
  while (i > 0 && LETTER.test(text[i - 1]) && !/[aeiouăâî]/i.test(text[i - 1])) i--;
  const wordStart = i === 0 || !LETTER.test(text[i - 1]);
  if (wordStart) return i;
  // "ch" and "gh" are one sound: "Ge-nun-chii", not "Genunc-hii".
  if (vowelAt - i >= 2 && /^[cg]h$/i.test(text.slice(vowelAt - 2, vowelAt))) return vowelAt - 2;
  return Math.max(i, vowelAt - 1);
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

// Chords of a source line as syllable slots: `syl` is the index of the vowel
// group the chord sits on (a chord on "[C]mort" belongs to its "o"); a chord
// after the last vowel is `end`, kept at the end of the line.
function chordSlots(line) {
  const { text, marks } = splitChords(line);
  const vs = nuclei(text);
  return marks.map(({ at, chord }) => {
    const syl = vs.findIndex(v => v >= at || isInside(text, v, at));
    return syl === -1 ? { chord, end: true } : { chord, syl, of: vs.length };
  });
}

// A chord placed inside a vowel group ("me[Bb]a" splits "ea") belongs to that
// group, not the next one.
function isInside(text, v, at) {
  const run = text.slice(v).match(/^[aeiouăâî]+/i)?.[0].length || 0;
  return at > v && at < v + run;
}

function placeChords(line, slots) {
  const vs = nuclei(line);
  if (!vs.length) return slots.length ? `${line} ${slots.map(s => `[${s.chord}]`).join('')}`.trim() : line;
  const marks = slots.map(s => {
    if (s.end) return { at: line.length, chord: s.chord };
    // Same syllable count: same slot. Otherwise the miscount (a hiatus like
    // "fi-u-le" read as two) is spread over the line rather than shifting
    // every later chord, so a chord on the last syllable stays on the last.
    const k = s.of === vs.length || s.of < 2
      ? Math.min(s.syl, vs.length - 1)
      : Math.min(vs.length - 1, Math.round((s.syl * (vs.length - 1)) / (s.of - 1)));
    return { at: onset(line, vs[k]), chord: s.chord };
  });
  // A line with fewer syllables piles several chords on its last one; keep
  // them in order rather than dropping any.
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
 * chords, line by line and syllable by syllable. Verses that already have any
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
