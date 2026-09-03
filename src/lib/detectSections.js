// Infer a song's sections when the source didn't label them.
//
// Copying from a lyrics site gives you blank-line-separated blocks and nothing
// else — no "Verse 1", no "Chorus". Position can't tell you which is which:
// plenty of songs open on the chorus. But REPETITION can. A block of lyrics
// that appears more than once is the chorus (or a refrain), whatever order it
// happens to arrive in. Everything else is a verse, numbered as it appears.
//
// Where repetition says nothing — a sheet that writes the chorus out only once
// — every block becomes a verse and the user relabels. Guessing beyond the
// evidence would just be confidently wrong.

const HEADER = /^##\s+/;

/** Compare lyric content only: chords, punctuation, case and diacritics are
 *  noise when asking "is this the same block of words again?" */
function fingerprint(lines) {
  return lines
    .join(' ')
    .replace(/\[[^\]]*\]/g, ' ')       // inline [chords]
    .replace(/\{[^}]*\}/g, ' ')        // {directives}
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Split into blank-line-separated blocks of non-empty lines. */
export function splitBlocks(text) {
  const blocks = [];
  let current = [];
  for (const line of String(text ?? '').split('\n')) {
    if (line.trim() === '') {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * Label unlabelled blocks.
 * @returns {Array<{ lines: string[], type: string, confident: boolean }>}
 *   `confident` marks a label repetition actually supports, so the UI can show
 *   a guess differently from a deduction.
 */
export function inferSections(text) {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) return [];

  const counts = new Map();
  const prints = blocks.map(b => {
    const p = fingerprint(b);
    counts.set(p, (counts.get(p) || 0) + 1);
    return p;
  });

  // A block that comes back is the chorus. If several different blocks repeat,
  // the one that repeats most is the chorus and the rest are refrain-ish — call
  // them Chorus too rather than inventing names we can't justify.
  const repeated = new Set([...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p));

  let verseNo = 0;
  return blocks.map((lines, i) => {
    const { lines: clean, repeat } = stripRepeatMarks(lines);
    // `rawLines` keeps the marks for callers with nowhere to record a repeat —
    // stripping "//:" without storing "×2" would quietly lose the instruction.
    const isChorus = repeated.has(prints[i]) && prints[i] !== '';
    if (isChorus) return { lines: clean, rawLines: lines, type: 'Chorus', confident: true, repeat };
    verseNo += 1;
    return { lines: clean, rawLines: lines, type: `Verse ${verseNo}`, confident: false, repeat };
  });
}

/**
 * Give a headerless body some sections.
 *
 * A body with lyrics but no `## ` header parses to ZERO sections — parseSongMd
 * drops everything before the first header — so converting an unlabelled paste
 * and saving it lost the whole song. Anything that reaches the editor must
 * carry at least one section.
 */
export function ensureSections(body) {
  const text = String(body ?? '');
  if (!text.trim()) return text;
  if (text.split('\n').some(l => HEADER.test(l))) return text; // already labelled

  const sections = inferSections(text);
  if (sections.length === 0) return text;
  // Raw lines here: this path only adds headings, and has no frontmatter to
  // write a play order into. The review screen is where a repeat mark becomes
  // structure; anywhere else the mark stays visible rather than vanishing.
  return `${sections.map(s => `## ${s.type}\n${(s.rawLines || s.lines).join('\n')}`).join('\n\n')}\n`;
}

// ─── Repeat marks ────────────────────────────────────────────────────────
//
// Romanian and German songbooks bracket a repeated passage with the ASCII form
// of the repeat barlines 𝄆 𝄇:
//
//   //: Aleluia! Isus m-a eliberat! ://      → sing it twice
//   |: Slavă Ție :|3                         → three times
//
// Imported literally they're just punctuation stuck to the lyrics. Read
// properly they're structure: one section, played N times — which is how the
// play order already works.

const OPEN_MARK = /^\s*(?:\/\/:|\|:|\[:|𝄆)\s*/;
// A closing mark, optionally followed by a count: "://3", ":| x2", ":|(4x)".
const CLOSE_MARK = /\s*(?::\/\/|:\||:\]|𝄇)\s*(?:[x×(]?\s*(\d+)\s*[x×)]?)?\s*$/;

/**
 * Pull repeat marks off a block of lines.
 * @param {string[]} lines
 * @returns {{ lines: string[], repeat: number }} `repeat` is 1 when unmarked.
 */
export function stripRepeatMarks(lines) {
  const src = (lines || []).map(l => String(l ?? ''));
  if (src.length === 0) return { lines: src, repeat: 1 };

  let repeat = 1;
  let sawOpen = false;
  const out = src.map(line => line);

  // Opening mark: on the first non-empty line.
  const firstIdx = out.findIndex(l => l.trim() !== '');
  if (firstIdx >= 0 && OPEN_MARK.test(out[firstIdx])) {
    out[firstIdx] = out[firstIdx].replace(OPEN_MARK, '');
    sawOpen = true;
  }

  // Closing mark: on the last non-empty line, which may be the same line.
  let lastIdx = -1;
  for (let i = out.length - 1; i >= 0; i--) if (out[i].trim() !== '') { lastIdx = i; break; }
  if (lastIdx >= 0) {
    const m = out[lastIdx].match(CLOSE_MARK);
    if (m) {
      out[lastIdx] = out[lastIdx].replace(CLOSE_MARK, '');
      repeat = m[1] ? Math.max(2, Math.min(9, parseInt(m[1], 10))) : 2;
    } else if (sawOpen) {
      // An opening mark with no closing one still means "repeat this".
      repeat = 2;
    }
  }

  // A mark on its own line leaves an empty line behind; drop those.
  return { lines: out.filter((l, i) => l.trim() !== '' || src[i].trim() !== ''), repeat };
}
