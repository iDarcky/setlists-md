// Rebuild a chord chart from a PDF's positioned text runs.
//
// This is deliberately pure — it takes the item list pdf.js hands back and
// nothing else, so the whole reconstruction is testable without a PDF binary
// (see __tests__/pdf-layout.test.js). pdfChart.js does the pdf.js part.
//
// The insight that makes this exact rather than approximate: chord-chart
// generators split the lyric run at every chord position, so a chord's
// character offset is just the length of the fragments starting left of it.
// No character-width estimation, no monospace grid.

// An item: { str, x, y, w, h, font }. y grows upward (PDF origin, bottom-left).
const Y_TOL = 3;      // items within this many points share a line
const X_TOL = 6;      // chord x vs fragment x counted as aligned
const GAP_COL = 60;   // horizontal gap that implies a second column
const CHORD_GAP = 24; // max vertical distance from a chord row to its lyric

const CHORDISH = /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?[0-9()#b/♯♭+\-A-Za-z]*$/;

// Romanian first — this is the vocabulary the local charts actually use — then
// the English names, so an English PDF lands on the same section types.
const SECTION_PATTERNS = [
  [/^STROF[AĂ]\s*(\d+)?/i, n => `Verse ${n || 1}`],
  // \b so the Romanian "VERS" doesn't swallow the English "VERSE 2" below.
  [/^VERS(?:UL)?\b\s*(\d+)?/i, n => `Verse ${n || 1}`],
  [/^PRE-?\s*REFREN\s*(\d+)?/i, () => 'Pre-Chorus'],
  [/^REFREN\s*(\d+)?/i, () => 'Chorus'],
  [/^(?:PUNTE|BRIDGE)\s*(\d+)?/i, () => 'Bridge'],
  [/^(?:[IÎ]NCHEIERE|FINAL|OUTRO)/i, () => 'Outro'],
  [/^(?:INTRO|INTRODUCERE)/i, () => 'Intro'],
  [/^VERSE\s*(\d+)?/i, n => `Verse ${n || 1}`],
  [/^PRE-?\s*CHORUS/i, () => 'Pre-Chorus'],
  [/^CHORUS\s*(\d+)?/i, () => 'Chorus'],
  [/^TAG|^ENDING/i, () => 'Outro'],
];

// Shorthand used in the play-order strip: S1 R S2 R B R.
const ORDER_SHORTHAND = { R: 'Chorus', B: 'Bridge', P: 'Pre-Chorus', F: 'Outro', I: 'Intro' };

export function sectionNameFrom(text) {
  for (const [re, fn] of SECTION_PATTERNS) {
    const m = String(text || '').trim().match(re);
    if (m) return fn(m[1]);
  }
  return null;
}

export function orderTokenToSection(token) {
  const t = String(token || '').trim().replace(/\s*[x×]\d+$/i, '');
  if (/^S(\d*)$/i.test(t)) return `Verse ${t.slice(1) || 1}`;
  // "R1", "R2" number the chorus's appearances, not different choruses.
  const m = t.match(/^([A-Z])\d*$/i);
  return (m && ORDER_SHORTHAND[m[1].toUpperCase()]) || null;
}

// The play-order strip as a list of section names, or null if these tokens are
// not one. Repeats come either glued ("R2x2") or as their own token ("R3",
// "x2"); both play the section that many times. A tempo ("♩ = 80") can share
// the row and is returned separately.
export function parsePlayOrder(tokens) {
  const order = [];
  let tempo = null;
  const rest = [];
  const joined = tokens.join(' ');
  const t = joined.match(/♩\s*=\s*(\d{2,3})/);
  if (t) tempo = t[1];
  for (const tok of tokens) {
    if (/^(♩|=|\d{2,3})$/.test(tok)) continue;
    rest.push(tok);
  }
  if (rest.length < 2 && !(rest.length === 1 && tempo)) return rest.length ? null : (tempo ? { order, tempo } : null);
  for (const tok of rest) {
    const rep = tok.match(/^[x×](\d+)$/i);
    if (rep) {
      if (!order.length) return null;
      for (let n = 1; n < Number(rep[1]); n++) order.push(order[order.length - 1]);
      continue;
    }
    const name = orderTokenToSection(tok);
    if (!name) return null;
    const times = Number(tok.match(/[x×](\d+)$/i)?.[1] || 1);
    for (let n = 0; n < times; n++) order.push(name);
  }
  return { order, tempo };
}

// The chord font is the one whose runs almost all look like chords. Far more
// reliable than testing each token: in a lyric, "A" and "Am" are words too.
// Play-order shorthand is set in the chord font but is not chord-shaped, so it
// would drag the ratio down on a chart with few chords. Only the tokens that
// can't be notes are excluded — a bare "B" really might be a chord. The
// tempo ("♩ = 80") and repeat counts ("R2x2", "x2") share that row.
const NON_NOTE_SHORTHAND = /^(?:(?:S|R|P|F|I)\d*(?:[x×]\d+)?|[x×]\d+|♩|=|\d{1,3})$/i;

export function findChordFont(items) {
  const byFont = new Map();
  for (const it of items) {
    const s = it.str.trim();
    if (!s || NON_NOTE_SHORTHAND.test(s)) continue;
    if (!byFont.has(it.font)) byFont.set(it.font, []);
    byFont.get(it.font).push(s);
  }
  let chordFont = null;
  let best = 0;
  for (const [font, strs] of byFont) {
    if (strs.length < 3) continue;
    const ratio = strs.filter(s => CHORDISH.test(s)).length / strs.length;
    if (ratio > 0.8 && ratio > best) { best = ratio; chordFont = font; }
  }
  return chordFont;
}

// Split into columns along a vertical channel no text crosses.
//
// Looking only at left edges (the first version) breaks on a two-column chart
// whose left column runs long: a lyric that ends at x=275 leaves a 50pt gap to
// the right column's 304, under any "big gap" threshold, and both columns came
// back interleaved line by line. So build the union of every run's [x, x+w]
// span and split in the widest empty channel instead.
//
// Two kinds of run legitimately cross the channel and are left out of the
// union: anything wider than most of the page (the title, a publisher footer),
// and the header band above the first section heading, where composer credits
// and the play-order strip span both columns. The boundary is the channel's
// MIDPOINT — a column starting at 311.9 must not fall on the wrong side of a
// split at 312.
const MIN_CHANNEL = 12;

export function splitColumns(items) {
  const real = items.filter(i => i.str.trim());
  if (real.length === 0) return [items];
  const left = Math.min(...real.map(i => i.x));
  const right = Math.max(...real.map(i => i.x + (i.w || 0)));
  const span = right - left || 1;

  const headings = real.filter(i => sectionNameFrom(i.str));
  const top = headings.length ? Math.max(...headings.map(i => i.y)) + Y_TOL : Infinity;
  const body = real.filter(i => i.y <= top && (i.w || 0) < span * 0.6);

  const spans = body.map(i => [i.x, i.x + (i.w || 0)]).sort((a, b) => a[0] - b[0]);
  let best = null;
  let reach = spans.length ? spans[0][1] : left;
  for (let k = 1; k < spans.length; k++) {
    const [x0, x1] = spans[k];
    const gap = x0 - reach;
    // A channel only counts in the middle of the page — never the margin
    // between a lyric and a short chord hanging off its end.
    if (gap >= MIN_CHANNEL && x0 > left + 150 && (!best || gap > best.gap)) {
      best = { gap, at: (x0 + reach) / 2 };
    }
    reach = Math.max(reach, x1);
  }
  if (!best) return [items];
  return [items.filter(i => i.x < best.at), items.filter(i => i.x >= best.at)];
}

// Group a column's items into lines, top-down.
export function toLines(items, chordFont) {
  const lines = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find(l => Math.abs(l.y - it.y) <= Y_TOL);
    if (line) {
      line.items.push(it);
      line.items.sort((a, b) => a.x - b.x);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  return lines.map(l => {
    const real = l.items.filter(i => i.str.trim());
    return {
      y: l.y,
      items: l.items,
      kind: real.length > 0 && real.every(i => i.font === chordFont) ? 'chords' : 'text',
      size: Math.max(...l.items.map(i => i.h || 0)),
      text: joinFragments(l.items).trim(),
    };
  });
}

// Weave a chord row into the lyric row beneath it, emitting our [Chord] inline
// syntax at the exact split points the generator used.
// A generator that splits a lyric at a chord leaves the two runs touching
// (gap 0), but a real word space is often just a horizontal offset with no
// whitespace item at all. Infer one when the gap is a meaningful fraction of
// the type size, so "te" + "voi" doesn't come back as "tevoi".
function gapSpace(prev, next) {
  if (!prev || !next) return '';
  if (/\s$/.test(prev.str) || /^\s/.test(next.str)) return '';
  const gap = next.x - (prev.x + (prev.w || 0));
  const size = prev.h || next.h || 12;
  return gap > size * 0.25 ? ' ' : '';
}

export function joinFragments(items) {
  let out = '';
  for (let i = 0; i < items.length; i++) {
    out += gapSpace(items[i - 1], items[i]) + items[i].str;
  }
  return out;
}

export function mergeChordRow(chordLine, lyricLine) {
  const frags = lyricLine.items;
  const chords = chordLine.items.filter(i => i.str.trim());
  if (frags.length === 0) return chords.map(c => `[${c.str.trim()}]`).join('');

  // Rebuild the line, recording where each fragment starts in the finished
  // string so a chord's x can be turned into a character offset.
  // A chord wider than the syllable under it pushes the rest of the lyric
  // right, so "mer[Cm]e[Bb]u" is set as "mer e  u". That gap is padding, not
  // a word space: the fragment starts where an earlier chord ENDS, and that
  // chord overhangs the text before it.
  const pushed = (prev, next) => chords.some(c => {
    const end = c.x + (c.w || 0);
    return c.x < next.x - X_TOL && end >= prev.x + (prev.w || 0) - 0.5 && next.x - end >= -0.5 && next.x - end <= X_TOL;
  });
  let text = '';
  const spans = [];
  for (let f = 0; f < frags.length; f++) {
    text += pushed(frags[f - 1] || frags[f], frags[f]) && f > 0 ? '' : gapSpace(frags[f - 1], frags[f]);
    spans.push({ item: frags[f], start: text.length });
    text += frags[f].str;
  }

  // Where does this chord belong, as a character offset?
  const offsetFor = (ch) => {
    // 1. Aligned with a fragment's left edge. This is the exact case: chart
    //    generators split the lyric run at every chord, so the boundary IS the
    //    answer — no estimation. Whitespace runs can't anchor, or the chord
    //    lands before the space instead of on its word.
    for (const s of spans) {
      if (s.item.str.trim() && Math.abs(ch.x - s.item.x) <= X_TOL) return s.start;
    }
    if (ch.x <= spans[0].item.x) return 0;
    // 2. Otherwise the lyric is one unsplit run (a Word export, a monospace
    //    chart) and the offset has to be estimated from average character
    //    width within whichever fragment the chord sits over.
    for (const s of spans) {
      const { item } = s;
      const end = item.x + (item.w || 0);
      if (ch.x < end && item.str.length > 0) {
        const perChar = (item.w || 0) / item.str.length;
        if (!perChar) return s.start;
        const idx = Math.max(0, Math.min(item.str.length, Math.round((ch.x - item.x) / perChar)));
        return s.start + idx;
      }
    }
    return text.length; // past the end of the line
  };

  // Splice from the back so earlier offsets stay valid.
  const marks = chords
    .map(ch => ({ at: offsetFor(ch), chord: ch.str.trim(), x: ch.x }))
    .sort((a, b) => b.at - a.at || b.x - a.x);
  let out = text;
  for (const m of marks) out = `${out.slice(0, m.at)}[${m.chord}]${out.slice(m.at)}`;
  return out.trim();
}

/**
 * Rebuild a chart from positioned text runs.
 * @param {Array<{str,x,y,w,h,font}>} rawItems
 * @returns {{ md: string, meta: object, warnings: string[] }}
 */
export function buildChartFromItems(rawItems) {
  const warnings = [];
  // Whitespace runs are real items and carry the spaces between words —
  // dropping them welds words together ("Muzica deOni Rodilă").
  const items = (rawItems || []).filter(i => i && typeof i.str === 'string' && i.str.length > 0);
  if (items.length === 0) return { md: '', meta: {}, warnings: ['No text found in this PDF.'] };

  const chordFont = findChordFont(items);
  if (!chordFont) warnings.push('No chord font detected — chords may be missing.');

  const meta = {};
  const body = [];
  const lyricSize = medianLyricSize(items, chordFont);

  for (const col of splitColumns(items)) {
    const lines = toLines(col, chordFont);
    // A two-column chart repeats the header band across both columns (title and
    // composer left, key and play order right), so "still in the header" is a
    // per-column question.
    let seenSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.kind === 'chords') {
        const tokens = line.items.filter(x => x.str.trim()).map(x => x.str.trim());
        // Section shorthand above the first header is the play order, not chords.
        if (!seenSection) {
          const parsed = parsePlayOrder(tokens);
          if (parsed) {
            if (parsed.order.length > 1) meta.structure = parsed.order;
            if (parsed.tempo) meta.tempo = parsed.tempo;
          }
          continue;
        }
        // A chord row with no lyric under it is an instrumental row (intro,
        // turnaround). Keep it as a chords-only line instead of dropping it.
        const below = lines[i + 1];
        const feedsLyric = below && below.kind === 'text' && below.text && Math.abs(line.y - below.y) < CHORD_GAP && !sectionNameFrom(below.text);
        if (!feedsLyric) body.push({ line: tokens.map(c => `[${c}]`).join(' ') });
        continue; // otherwise consumed by the lyric line beneath
      }

      const section = sectionNameFrom(line.text);
      if (section) { body.push({ section }); seenSection = true; continue; }
      if (!line.text) continue;

      if (!seenSection) {
        // Without a chord font (a lyrics-only chart) the play-order strip is a
        // plain text row.
        const order = parsePlayOrder(line.items.filter(x => x.str.trim()).map(x => x.str.trim()));
        if (order && order.order.length > 1) {
          meta.structure = order.order;
          if (order.tempo) meta.tempo = order.tempo;
          continue;
        }
        if (!meta.title && line.size >= 20) {
          const runs = line.items.filter(x => x.str.trim()).sort((a, b) => (b.w || 0) - (a.w || 0));
          meta.title = runs[0].str.trim();
          const keyRun = runs.slice(1).find(x => /^[A-G](#|b)?m?$/.test(x.str.trim()));
          if (keyRun) meta.key = keyRun.str.trim();
          continue;
        }
        if (!meta.key && /^[A-G](#|b)?m?$/.test(line.text) && line.size >= 14) { meta.key = line.text; continue; }
        // "Muzica de X · Versuri de Y" names the composer and the lyricist —
        // NOT the performing artist, which these charts simply don't state.
        // Both go to `writers`; `artist` is left empty rather than guessed,
        // because a wrong artist is worse than a missing one (it's what the
        // library groups and sorts by).
        const credits = line.text.match(/Muzica de\s*(.+?)\s*[·|]\s*Versuri de\s*(.+)$/i);
        if (credits) {
          const composer = credits[1].trim();
          const lyricist = credits[2].trim();
          meta.writers = composer === lyricist ? composer : `${composer}, ${lyricist}`;
        } else {
          const music = line.text.match(/^(?:Muzica|Muzică)\s+(?:și|si)\s+versuri\s+de\s*(.+)$/i)
            || line.text.match(/^(?:Compozitor|Compozitori|Autor|Autori)\s*:\s*(.+)$/i);
          if (music) meta.writers = music[1].trim();
          const tempo = line.text.match(/♩\s*=\s*(\d{2,3})/);
          if (tempo && !meta.tempo) meta.tempo = tempo[1];
        }
        continue; // remaining header chrome (repeated title, logos, …)
      }

      const year = line.text.match(/^Compus[ăa]\s+[îi]n\s*(\d{4})/i);
      if (year) { meta.year = year[1]; continue; }
      if (!meta.key && /^[A-G](#|b)?m?$/.test(line.text) && line.size >= 14) { meta.key = line.text; continue; }

      // Page furniture in small type (publisher credits under the footer rule)
      // is not lyrics.
      if (lyricSize && line.size && line.size < lyricSize * 0.7) continue;

      const above = lines[i - 1];
      const hasChords = above && above.kind === 'chords' && Math.abs(above.y - line.y) < CHORD_GAP;
      const text = hasChords ? mergeChordRow(above, line) : line.text;
      // A narrow column wraps a long line, and the generator sets the rest on
      // the next row (with its own chord row). Song lines start with a capital,
      // so one that starts lowercase is the tail of the line before it.
      const prev = body[body.length - 1];
      if (prev && prev.line !== undefined && !isChordOnly(prev.line) && /^[a-zăâîșşțţ]/.test(line.text)) {
        prev.line = `${prev.line} ${text}`;
        continue;
      }
      body.push({ line: text });
    }
  }

  if (!body.some(b => b.section)) warnings.push('No section headings found — everything landed in one section.');

  return { md: toMarkdown(meta, body), meta, warnings };
}

const isChordOnly = (line) => /^(\[[^\]]+\]\s*)+$/.test(line.trim());

// The body text size: the median size weighted by characters, so the lyrics
// (most of the letters on the page) win over headings and header chrome.
function medianLyricSize(items, chordFont) {
  const runs = items.filter(i => i.str.trim() && i.font !== chordFont && i.h).sort((a, b) => a.h - b.h);
  const total = runs.reduce((n, i) => n + i.str.length, 0);
  let seen = 0;
  for (const i of runs) {
    seen += i.str.length;
    if (seen * 2 >= total) return i.h;
  }
  return 0;
}

function toMarkdown(meta, body) {
  let md = '---\n';
  md += `title: ${meta.title || ''}\n`;
  if (meta.artist) md += `artist: ${meta.artist}\n`;
  md += `key: ${meta.key || ''}\n`;
  if (meta.tempo) md += `tempo: ${meta.tempo}\n`;
  if (meta.structure?.length) md += `structure: [${meta.structure.join(', ')}]\n`;
  if (meta.language) md += `language: ${meta.language}\n`;
  if (meta.writers) md += `writers: ${meta.writers}\n`;
  if (meta.year) md += `year: ${meta.year}\n`;
  md += '---\n';
  // A chart with no headings still needs one section for the parser.
  if (!body.some(b => b.section)) md += '\n## Verse 1\n';
  for (const b of body) md += b.section ? `\n## ${b.section}\n` : `${b.line}\n`;
  return md;
}
