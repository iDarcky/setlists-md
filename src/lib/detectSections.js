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
    const isChorus = repeated.has(prints[i]) && prints[i] !== '';
    if (isChorus) return { lines, type: 'Chorus', confident: true };
    verseNo += 1;
    return { lines, type: `Verse ${verseNo}`, confident: false };
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
  return `${sections.map(s => `## ${s.type}\n${s.lines.join('\n')}`).join('\n\n')}\n`;
}
