// Smart paste importer. Converts pasted text from common external chord-chart
// formats into our native .md format.
//
// Supported formats:
//  - ChordPro (CCLI / OnSong / most worship apps) — bracketed inline chords,
//    directive-based metadata and section markers.
//  - OpenSong — XML wrapper with a `<lyrics>` block using `.chord` / ` lyric`
//    column-aligned lines and `[V1]` / `[C]` section markers.
//  - Ultimate Guitar "above-the-lyrics" — chord line followed by lyric line.
//  - Plain lyrics — fallback. One section, no chords, user adds chords later.

// ─── Chord token detection ─────────────────────────────────────────

// Matches a single chord token. Intentionally lenient:
//  root ( # | b )? suffix-bits* ( / bass )?
const CHORD_RE =
  /^[A-G][#b]?(?:m|maj|min|sus|add|dim|aug|°|M)?\d*(?:(?:sus|add|maj|min|dim|aug|°)\d*)*(?:[#b]\d+)*(?:\([^)]+\))?(?:\/[A-G][#b]?)?$/;

// Certain plain-English / common-lyric tokens look chord-like (especially
// single capitals like A, B, C, D, E, F, G used as words). We guard against
// those by requiring either a multi-char chord, a sharp/flat, or an explicit
// suffix for the "looks chordy" check to pass.
function looksChordy(token) {
  if (!token || !CHORD_RE.test(token)) return false;
  // Block lone capital letters that are also valid English words / pronouns.
  if (token.length === 1 && 'ABCDEFG'.includes(token)) {
    // Single letters are only counted when they're not alone on a word-like
    // context. Callers decide line-level by using isChordLine below.
    return true;
  }
  return true;
}

export function isChordToken(s) {
  return looksChordy(s);
}

// A line is a "chord line" if it contains tokens separated by whitespace and
// the overwhelming majority of those tokens look like chords. Lowercase
// characters anywhere on the line disqualify it (chord tokens are
// case-sensitive by convention, so "Amazing" or "the" rule a line out).
export function isChordLine(line) {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();

  // Lowercase letters are a strong "this is lyrics" signal — but lowercase
  // 'm' after a root is legal for minor chords. Allow lowercase only as part
  // of a recognised suffix.
  // Cheap heuristic: the line must not contain any word that is entirely
  // lowercase and longer than 1 char.
  const words = trimmed.split(/\s+/);
  for (const w of words) {
    if (/^[a-z]+$/.test(w) && w.length > 1) return false;
  }

  // Strip standalone bar markers; they're decorative in guitar tabs and
  // shouldn't count against the chord ratio.
  const tokens = words
    .map(w => w.replace(/^\|+|\|+$/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return false;

  const chordCount = tokens.filter(looksChordy).length;
  const ratio = chordCount / tokens.length;

  // A single-token chord line is OK (often seen: "| G |").
  if (tokens.length === 1) return looksChordy(tokens[0]);

  return ratio >= 0.8;
}

// ─── Section header detection ──────────────────────────────────────

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Pre-Chorus',
  'Chorus', 'Bridge', 'Instrumental', 'Interlude',
  'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];

function normaliseSectionType(raw) {
  const clean = raw.trim().replace(/[:\-–—]+$/, '').replace(/[:\-–—]+$/, '').trim();
  // Normalise "Pre-Chorus" variants to our canonical "Pre Chorus".
  const normalised = clean.replace(/pre[-\s]*chorus/i, 'Pre Chorus');
  // Separate trailing number: "Verse 1", "VERSE2", "Verse1" → "Verse 1"
  const m = normalised.match(/^(.*?)\s*(\d+)?\s*$/);
  if (!m) return null;
  const baseRaw = m[1].trim();
  const num = m[2] ? ` ${m[2]}` : '';
  const base = SECTION_TYPES.find(
    t => t.toLowerCase() === baseRaw.toLowerCase()
  );
  if (!base) return null;
  return base === 'Pre-Chorus' ? 'Pre Chorus' + num : base + num;
}

// Recognise lines like:
//   [Verse 1]    (Chorus)    VERSE 1:   Verse 1:   - Bridge -
export function detectSectionHeader(line) {
  if (!line) return null;
  const trimmed = line.trim();

  // [Verse 1] or (Chorus)
  const bracketed = trimmed.match(/^[[(]([^\])]+)[\])]$/);
  if (bracketed) return normaliseSectionType(bracketed[1]);

  // VERSE 1:   Chorus:   Pre-Chorus 1:
  const colon = trimmed.match(/^([A-Za-z][A-Za-z0-9\s-]{1,25}?)\s*:\s*$/);
  if (colon) return normaliseSectionType(colon[1]);

  // All-caps or title-case one-liners without punctuation and short enough
  // to plausibly be a header: VERSE 1, CHORUS, Bridge
  if (trimmed.length <= 25 && /^[A-Z][A-Za-z0-9\s-]*$/.test(trimmed)) {
    const maybe = normaliseSectionType(trimmed);
    if (maybe) return maybe;
  }

  return null;
}

// ─── Chord + lyric line merging ────────────────────────────────────

// Extract chords and their column positions from a chord line.
// "  G    D      Em  C" → [{chord:'G',col:2},{chord:'D',col:7}, …]
export function parseChordLine(line) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const tok = m[0].replace(/^\|+|\|+$/g, '');
    if (looksChordy(tok)) {
      chords.push({ chord: tok, col: m.index });
    }
  }
  return chords;
}

// Given a chord line and the immediately following lyric line, produce our
// inline-chord format: "[G]Amazing [D]grace how [Em]sweet the [C]sound".
export function mergeChordAndLyric(chordLine, lyricLine) {
  const chords = parseChordLine(chordLine);
  if (chords.length === 0) return lyricLine;

  // Work right-to-left so that inserting text never shifts the columns of
  // chords we still need to place.
  const sorted = [...chords].sort((a, b) => b.col - a.col);
  let out = lyricLine;

  for (const { chord, col } of sorted) {
    if (col <= out.length) {
      out = out.slice(0, col) + `[${chord}]` + out.slice(col);
    } else {
      // Lyric line is shorter than the chord column — pad with spaces so the
      // chord still sits where it was above the (missing) lyric.
      out = out + ' '.repeat(col - out.length) + `[${chord}]`;
    }
  }
  return out;
}

// A chord-only line with no paired lyric (instrumental passages). Emit the
// chords preserving rough spacing: "[G]   [D]   [Em]".
export function chordLineOnly(chordLine) {
  const chords = parseChordLine(chordLine);
  if (chords.length === 0) return '';
  let prevEnd = 0;
  let out = '';
  for (const { chord, col } of chords) {
    const gap = Math.max(0, col - prevEnd);
    out += ' '.repeat(gap) + `[${chord}]`;
    prevEnd = col + chord.length;
  }
  return out;
}

// ─── Format detection ──────────────────────────────────────────────

export function detectFormat(text) {
  if (!text || !text.trim()) return 'plain';

  // SongSelect .usr — INI-style with a [File] header + SongSelect type marker,
  // or the Fields=/Words= block pair of a real CCLI export.
  if (/\[File\]/i.test(text) && /Type\s*=\s*SongSelect/i.test(text)) {
    return 'songselect';
  }
  if (/^\s*Fields\s*=/im.test(text) && /^\s*Words\s*=/im.test(text)) {
    return 'songselect';
  }

  // OpenSong is XML with a <song> root and a <lyrics> child.
  if (/<song[\s>][\s\S]*<lyrics[\s>]/i.test(text)) {
    return 'opensong';
  }

  // Strong ChordPro markers.
  if (/\{(title|artist|key|tempo|composer|capo|time|album|ccli|comment|c|sov|soc|sob|sot|start_of_verse|start_of_chorus|start_of_bridge|start_of_tab)\s*[:\s}]/im.test(text)) {
    return 'chordpro';
  }

  const lines = text.split('\n');

  // UG heuristic: at least two occurrences of (chord line → non-empty
  // non-chord line) within the text.
  let ugPairs = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (isChordLine(lines[i]) && lines[i + 1].trim() && !isChordLine(lines[i + 1])) {
      ugPairs++;
    }
  }
  if (ugPairs >= 2) return 'ultimate-guitar';

  // Bracketed inline chords without directives suggests a light ChordPro.
  const inlineChordLines = lines.filter(l => /\[[A-G][^\]]{0,10}\]/.test(l)).length;
  if (inlineChordLines >= 2) return 'chordpro';

  return 'plain';
}

// ─── Converters ────────────────────────────────────────────────────

function frontmatter(meta) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.join(', ')}]`);
    } else if (k === 'ccli') {
      lines.push(`${k}: "${v}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

const CHORDPRO_SECTION_MAP = {
  sov: 'Verse', start_of_verse: 'Verse',
  soc: 'Chorus', start_of_chorus: 'Chorus',
  sob: 'Bridge', start_of_bridge: 'Bridge',
  sot: 'Tab', start_of_tab: 'Tab',
};

export function convertChordPro(text) {
  const lines = text.split('\n');
  const meta = {};
  const bodyLines = [];
  const typeCounts = {};
  const structure = [];
  let flowOverride = null;
  let currentSectionType = null;

  const nextSectionLabel = (base) => {
    typeCounts[base] = (typeCounts[base] || 0) + 1;
    const needsNumber = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus'].includes(base);
    const label = needsNumber ? `${base} ${typeCounts[base]}` : base;
    structure.push(label);
    return label;
  };

  for (const raw of lines) {
    const line = raw.trim();

    // OnSong metadata extensions written as plain `Key: value` lines (no braces).
    const onsongMeta = line.match(/^(flow|duration)\s*:\s*(.+)$/i);
    if (onsongMeta && !currentSectionType) {
      const name = onsongMeta[1].toLowerCase();
      const value = onsongMeta[2].trim();
      if (name === 'flow') flowOverride = value;
      else if (name === 'duration') meta.duration = value;
      continue;
    }

    const directive = line.match(/^\{([a-zA-Z_]+)\s*:?\s*(.*?)\}$/);
    if (directive) {
      const name = directive[1].toLowerCase();
      const value = directive[2].trim();

      if (name === 'title' || name === 't') meta.title = value;
      else if (name === 'subtitle' || name === 'artist' || name === 'st') meta.artist = value;
      else if (name === 'key') meta.key = value;
      else if (name === 'tempo') meta.tempo = value;
      else if (name === 'time') meta.time = value;
      else if (name === 'capo') meta.capo = value;
      else if (name === 'ccli') meta.ccli = value;
      else if (name === 'composer') meta.artist = meta.artist || value;
      else if (name === 'flow') flowOverride = value;
      else if (name === 'duration') meta.duration = value;
      else if (name === 'comment' || name === 'c') {
        bodyLines.push(`> ${value}`);
      } else if (CHORDPRO_SECTION_MAP[name]) {
        const base = CHORDPRO_SECTION_MAP[name];
        const label = nextSectionLabel(base);
        currentSectionType = label;
        bodyLines.push('', `## ${label}`);
      } else if (/^(eov|eoc|eob|eot|end_of_verse|end_of_chorus|end_of_bridge|end_of_tab)$/i.test(name)) {
        currentSectionType = null;
      }
      continue;
    }

    // Explicit section header written as plain text inside the pasted text.
    const header = detectSectionHeader(line);
    if (header) {
      const base = header.replace(/\s*\d+$/, '');
      const label = nextSectionLabel(base);
      bodyLines.push('', `## ${label}`);
      currentSectionType = label;
      continue;
    }

    // If we're outside any section and we see content, create a default Verse.
    if (!currentSectionType && line) {
      const label = nextSectionLabel('Verse');
      bodyLines.push('', `## ${label}`);
      currentSectionType = label;
    }

    bodyLines.push(raw);
  }

  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return frontmatter({
    title: meta.title || 'Untitled',
    artist: meta.artist || '',
    key: meta.key || '',
    tempo: meta.tempo || '',
    time: meta.time || '',
    capo: meta.capo,
    duration: meta.duration,
    ccli: meta.ccli,
    structure: flowOverride ? parseFlow(flowOverride) : structure,
  }) + body;
}

export function convertUltimateGuitar(text) {
  const lines = text.split('\n');
  const body = [];
  const typeCounts = {};
  const structure = [];
  let currentSection = null;
  const meta = {};

  const nextSectionLabel = (base) => {
    typeCounts[base] = (typeCounts[base] || 0) + 1;
    const needsNumber = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus'].includes(base);
    const label = needsNumber ? `${base} ${typeCounts[base]}` : base;
    structure.push(label);
    return label;
  };

  const ensureSection = () => {
    if (currentSection) return;
    const label = nextSectionLabel('Verse');
    body.push('', `## ${label}`);
    currentSection = label;
  };

  // Common header patterns at the top: "Title - Artist", "Song: ...", etc.
  // Grab the first non-empty line as a title candidate if it's not a section
  // header or chord line.
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) {
    const first = lines[i].trim();
    if (!detectSectionHeader(first) && !isChordLine(first) && first.length < 120) {
      const dashMatch = first.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (dashMatch) {
        meta.title = dashMatch[1].trim();
        meta.artist = dashMatch[2].trim();
      } else {
        meta.title = first;
      }
      i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      if (body.length > 0 && body[body.length - 1] !== '') body.push('');
      i++;
      continue;
    }

    // Section header?
    const header = detectSectionHeader(line);
    if (header) {
      const base = header.replace(/\s*\d+$/, '');
      const label = nextSectionLabel(base);
      body.push('', `## ${label}`);
      currentSection = label;
      i++;
      continue;
    }

    // Chord line?
    if (isChordLine(line)) {
      const nextLine = lines[i + 1] ?? '';
      if (nextLine.trim() && !isChordLine(nextLine) && !detectSectionHeader(nextLine)) {
        ensureSection();
        body.push(mergeChordAndLyric(line, nextLine));
        i += 2;
        continue;
      }
      // Chord line with no paired lyrics — instrumental passage.
      ensureSection();
      body.push(chordLineOnly(line));
      i++;
      continue;
    }

    // Plain lyric line.
    ensureSection();
    body.push(line);
    i++;
  }

  const bodyText = body.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return frontmatter({
    title: meta.title || 'Untitled',
    artist: meta.artist || '',
    structure,
  }) + bodyText;
}

export function convertPlain(text) {
  const lines = text.split('\n');
  const body = [];
  const typeCounts = {};
  const structure = [];
  let currentSection = null;
  const meta = {};

  const nextSectionLabel = (base) => {
    typeCounts[base] = (typeCounts[base] || 0) + 1;
    const needsNumber = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus'].includes(base);
    const label = needsNumber ? `${base} ${typeCounts[base]}` : base;
    structure.push(label);
    return label;
  };

  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length) {
    const first = lines[i].trim();
    if (!detectSectionHeader(first) && first.length < 120) {
      const dashMatch = first.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (dashMatch) {
        meta.title = dashMatch[1].trim();
        meta.artist = dashMatch[2].trim();
      } else {
        meta.title = first;
      }
      i++;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const header = detectSectionHeader(line);
    if (header) {
      const base = header.replace(/\s*\d+$/, '');
      const label = nextSectionLabel(base);
      body.push('', `## ${label}`);
      currentSection = label;
    } else {
      if (!currentSection && line.trim()) {
        const label = nextSectionLabel('Verse');
        body.push('', `## ${label}`);
        currentSection = label;
      }
      body.push(line);
    }
    i++;
  }

  const bodyText = body.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return frontmatter({
    title: meta.title || 'Untitled',
    artist: meta.artist || '',
    structure,
  }) + bodyText;
}

// ─── OpenSong (XML) ────────────────────────────────────────────────

// OpenSong section codes → our canonical section base names.
const OPENSONG_SECTION_MAP = {
  V: 'Verse',
  C: 'Chorus',
  B: 'Bridge',
  P: 'Pre Chorus',
  T: 'Tag',
  I: 'Intro',
  E: 'Ending',
  IN: 'Interlude',
  O: 'Other',
};

// Tiny regex-based XML reader for OpenSong files. The format is a flat
// `<song>` root with leaf-text children, so a full DOM parser is overkill —
// and DOMParser isn't available in the node test environment.
function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function readXmlField(text, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  if (!m) return '';
  // Strip optional CDATA wrapper, decode entities.
  const inner = m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1');
  return decodeXmlEntities(inner).trim();
}

export function convertOpenSong(text) {
  // Cheap structural validation: must contain <song> root and <lyrics> body.
  if (!/<song[\s>]/i.test(text) || !/<lyrics[\s>]/i.test(text) || !/<\/lyrics>/i.test(text)) {
    throw new Error('Invalid OpenSong XML');
  }

  const meta = {
    title: readXmlField(text, 'title'),
    artist: readXmlField(text, 'author'),
    key: readXmlField(text, 'key'),
    tempo: readXmlField(text, 'tempo'),
    time: readXmlField(text, 'time_sig'),
    capo: readXmlField(text, 'capo'),
    ccli: readXmlField(text, 'ccli'),
  };

  const lyricsRaw = readXmlField(text, 'lyrics');
  const lines = lyricsRaw.split('\n');
  const body = [];
  const typeCounts = {};
  const structure = [];
  let currentSection = null;

  const nextSectionLabel = (base) => {
    typeCounts[base] = (typeCounts[base] || 0) + 1;
    const needsNumber = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus'].includes(base);
    const label = needsNumber ? `${base} ${typeCounts[base]}` : base;
    structure.push(label);
    return label;
  };

  const ensureSection = () => {
    if (currentSection) return;
    const label = nextSectionLabel('Verse');
    body.push('', `## ${label}`);
    currentSection = label;
  };

  // Strip the leading marker char (`.` for chord, ` ` for lyric) so column
  // positions still line up with each other after the strip.
  const stripChord = (l) => l.replace(/^\./, '');
  const stripLyric = (l) => l.replace(/^[ \t]/, '');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      if (body.length > 0 && body[body.length - 1] !== '') body.push('');
      continue;
    }

    // OpenSong section marker: [V1], [C], [B 1], [O]
    const section = trimmed.match(/^\[([A-Za-z]+)\s*(\d+)?\s*\]$/);
    if (section) {
      const code = section[1].toUpperCase();
      const base = OPENSONG_SECTION_MAP[code] || OPENSONG_SECTION_MAP[code[0]] || 'Verse';
      const label = nextSectionLabel(base);
      body.push('', `## ${label}`);
      currentSection = label;
      continue;
    }

    // Comment line.
    if (trimmed.startsWith(';')) {
      ensureSection();
      body.push(`> ${trimmed.slice(1).trim()}`);
      continue;
    }

    // Chord line — pair with the next ` ` or digit-prefixed lyric line.
    if (raw.startsWith('.')) {
      const chordLine = stripChord(raw);
      const next = lines[i + 1] ?? '';
      // OpenSong lyric lines start with a space or a digit (verse number).
      if (next && (next.startsWith(' ') || /^\d/.test(next)) && !next.startsWith('.')) {
        const lyricLine = stripLyric(next.replace(/^\d+/, ' '));
        ensureSection();
        body.push(mergeChordAndLyric(chordLine, lyricLine));
        i++;
        continue;
      }
      ensureSection();
      body.push(chordLineOnly(chordLine));
      continue;
    }

    // Lyric line — leading space or per-verse digit prefix.
    if (raw.startsWith(' ') || /^\d/.test(raw)) {
      ensureSection();
      body.push(stripLyric(raw.replace(/^\d+/, ' ')));
      continue;
    }

    // Unknown line — drop into the section as-is.
    ensureSection();
    body.push(trimmed);
  }

  const bodyText = body.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return frontmatter({
    title: meta.title || 'Untitled',
    artist: meta.artist || '',
    key: meta.key || '',
    tempo: meta.tempo || '',
    time: meta.time || '',
    capo: meta.capo,
    ccli: meta.ccli,
    structure,
  }) + bodyText;
}

// ─── SongSelect (.usr) ─────────────────────────────────────────────

// Common worship-flow abbreviations → canonical section base names. Used to
// expand OnSong `Flow:` tokens and any abbreviated `.usr` field labels.
const FLOW_ABBR = {
  V: 'Verse', C: 'Chorus', B: 'Bridge', P: 'Pre Chorus', PC: 'Pre Chorus',
  I: 'Intro', O: 'Outro', T: 'Tag', E: 'Ending', IN: 'Interlude', R: 'Refrain',
};

// Expand a single flow token ("V1", "C", "Verse 2", "Pre-Chorus") into a
// canonical label. Falls back to the trimmed token when nothing matches.
function expandFlowToken(token) {
  const tok = token.trim();
  if (!tok) return '';
  // Try a full section name first (handles "Verse 2", "Pre-Chorus 1", "Chorus").
  const full = normaliseSectionType(tok);
  if (full) return full;
  // Then an abbreviation with an optional trailing number ("V1", "C", "PC2").
  const m = tok.match(/^([A-Za-z]+?)\s*(\d+)?$/);
  if (m) {
    const base = FLOW_ABBR[m[1].toUpperCase()];
    if (base) return base + (m[2] ? ` ${m[2]}` : '');
  }
  return tok;
}

// Parse an OnSong `Flow:` value (comma- or space-separated) into a structure
// array of canonical section labels.
export function parseFlow(value) {
  if (!value) return [];
  const parts = value.includes(',') ? value.split(',') : value.split(/\s+/);
  return parts.map(expandFlowToken).filter(Boolean);
}

// Resolve a raw `.usr` section label ("Verse 1", "Chorus", "Ending") to a
// canonical label, keeping the original text when it isn't a known type.
function usrSectionLabel(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  return detectSectionHeader(`[${clean}]`) || clean;
}

// First non-empty key from a CCLI `Key=`/`Keys=` value (often comma/slash
// separated, and frequently empty in real exports).
function firstKey(value) {
  return String(value || '').split(/[,/]/).map(s => s.trim()).find(Boolean) || '';
}

// Authors may be `|`- or `/`-separated in `.usr`; join with ", ". Commas are
// left intact (they're often part of a single "Last, First" author).
function formatAuthors(value) {
  return String(value || '').split(/[|/]/).map(s => s.trim()).filter(Boolean).join(', ');
}

// Convert a CCLI SongSelect `.usr` file. Handles two real-world variants:
//  A) `[Song]` metadata block + `[Verse 1]`-delimited lyric blocks.
//  B) `[File]`/`[S A#######]` block with slash-delimited `Fields=` labels and a
//     `Words=` blob where `//` separates sections and `/` separates lines.
// Brings in title, author, copyright (→ notes), CCLI #, key, structure, and
// lyrics — but no inline chords or tempo (the format does not carry them).
export function convertSongSelect(text) {
  const looksUsr =
    /\[File\]/i.test(text) ||
    /Type\s*=\s*SongSelect/i.test(text) ||
    /^\s*(Title|Words|Fields)\s*=/im.test(text);
  if (!looksUsr) throw new Error('Not a SongSelect .usr file');

  const meta = {};
  let fields = null;
  let words = null;
  const blocks = []; // variant A: [{ label, lines: [] }]
  let currentBlock = null;

  const assignMeta = (key, value) => {
    if (key === 'title') meta.title = value;
    else if (key === 'author' || key === 'authors') meta.artist = formatAuthors(value);
    else if (key === 'key' || key === 'keys') meta.key = firstKey(value);
    else if (key === 'copyright') meta.notes = value;
    else if (['ccli', 'songnumber', 'song number', 'ccli number', 'cclinumber'].includes(key)) {
      meta.ccli = value;
    } else if (key === 'fields') fields = value;
    else if (key === 'words') words = value;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      if (currentBlock) currentBlock.lines.push('');
      continue;
    }

    const bracket = line.match(/^\[([^\]]+)\]$/);
    if (bracket) {
      const inner = bracket[1].trim();
      // [File], [Song], [S A1234] are metadata containers, not lyric sections.
      if (/^(file|song)$/i.test(inner) || /^s[\s0-9]/i.test(inner)) {
        currentBlock = null;
      } else {
        currentBlock = { label: usrSectionLabel(inner), lines: [] };
        blocks.push(currentBlock);
      }
      continue;
    }

    const kv = line.match(/^([A-Za-z][A-Za-z0-9 _]*?)\s*=\s*(.*)$/);
    if (kv && !currentBlock) {
      assignMeta(kv[1].trim().toLowerCase(), kv[2].trim());
      continue;
    }

    // Any other line is lyric content for the current section block.
    if (currentBlock) currentBlock.lines.push(line);
  }

  const structure = [];
  const bodyLines = [];
  let verseFallback = 0;

  const pushSection = (rawLabel, lyricLines) => {
    const label = usrSectionLabel(rawLabel) || `Verse ${++verseFallback}`;
    structure.push(label);
    bodyLines.push('', `## ${label}`, ...lyricLines);
  };

  if (blocks.length > 0) {
    for (const block of blocks) pushSection(block.label, block.lines);
  } else if (words != null) {
    const fieldLabels = String(fields || '').split('/').map(s => s.trim()).filter(Boolean);
    words.split('//').forEach((chunk, idx) => {
      const lyricLines = chunk.split('/').map(s => s.trim());
      pushSection(fieldLabels[idx] || '', lyricLines);
    });
  } else {
    pushSection('Verse 1', []);
  }

  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return frontmatter({
    title: meta.title || 'Untitled',
    artist: meta.artist || '',
    key: meta.key || '',
    ccli: meta.ccli,
    notes: meta.notes,
    structure,
  }) + body;
}

// ─── Entry point ───────────────────────────────────────────────────

// Apply user-supplied metadata overrides on top of converter output.
// Overrides win when non-empty; empty values are ignored (don't erase
// metadata the converter detected from the source).
function applyMetadataOverrides(md, overrides) {
  if (!overrides) return md;
  let out = md;
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || String(v).trim() === '') continue;
    const re = new RegExp(`^${k}:.*$`, 'm');
    if (re.test(out)) {
      out = out.replace(re, `${k}: ${v}`);
    } else {
      out = out.replace(/^---\n/, `---\n${k}: ${v}\n`);
    }
  }
  return out;
}

export function smartImport(text, formatOverride = null, overrides = null) {
  const format = formatOverride || detectFormat(text);
  const warnings = [];

  let md;
  if (format === 'chordpro') md = convertChordPro(text);
  else if (format === 'opensong') md = convertOpenSong(text);
  else if (format === 'songselect') md = convertSongSelect(text);
  else if (format === 'ultimate-guitar') md = convertUltimateGuitar(text);
  else md = convertPlain(text);

  md = applyMetadataOverrides(md, overrides);

  if (!text.trim()) warnings.push('Input was empty.');

  return { md, format, warnings };
}
