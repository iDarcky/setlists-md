// Convert pasted chord charts into our .md body format.
//
// Handles two common sources:
//   • Ultimate-Guitar style — a line of chords positioned above a lyric line.
//   • ChordPro — inline [C] chords plus {directives} like {soc}, {comment}.
//
// Returns { body, meta }. `meta` carries title/artist/key/tempo/time/capo when
// the source declared them (ChordPro directives); the caller decides whether to
// apply them to the song's frontmatter.

const SECTION_WORDS = /^(intro|verses?|pre[\s-]?chorus|chorus|bridge|instrumental|interlude|tag|vamp|outro|ending|refrain|solo|breakdown|hook|coda|turnaround|chant)\b/i;

// A single chord token: root, optional accidental, quality, extensions, slash.
const CHORD_TOKEN = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M)?\d{0,2}(?:sus\d|add\d|[#b]\d{1,2})?(?:\/[A-G][#b]?)?$/;

export function isChordToken(t) {
  if (!t) return false;
  if (t === 'N.C.' || t === 'NC' || t === '%') return true;
  return CHORD_TOKEN.test(t);
}

// A line is "chords" when every whitespace-separated token is a chord.
function isChordLine(line) {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return false;
  return toks.every(isChordToken);
}

// Recognise a section header: "[Verse 1]", "Chorus:", "Bridge".
function sectionFrom(line) {
  const t = line.trim();
  let inner = null;
  const br = t.match(/^\[(.+)\]$/);
  if (br) inner = br[1].trim();
  else if (/^[A-Za-z][A-Za-z0-9 ]*:$/.test(t) && t.length < 30) inner = t.replace(/:\s*$/, '').trim();
  else if (/^[A-Za-z][A-Za-z ]*\d*$/.test(t) && SECTION_WORDS.test(t) && t.length < 24) inner = t;
  if (inner && SECTION_WORDS.test(inner)) {
    return inner.replace(/^([A-Za-z ]+?)\s*(\d+)$/, '$1 $2').replace(/\s+/g, ' ').trim();
  }
  return null;
}

// Merge a chord line and the lyric line beneath it into inline [chord] form,
// placing each chord at its column. Inserts right-to-left to keep offsets valid.
function mergeChordLyric(chordLine, lyricLine) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) chords.push({ chord: m[0], col: m.index });
  let out = lyricLine.replace(/\s+$/, '');
  for (let i = chords.length - 1; i >= 0; i--) {
    const { chord, col } = chords[i];
    const pos = Math.min(col, out.length);
    out = out.slice(0, pos) + `[${chord}]` + out.slice(pos);
  }
  return out;
}

// An instrumental chord line (no lyric beneath): bracket each chord in place.
function chordOnly(chordLine) {
  return chordLine.replace(/\S+/g, (t) => (isChordToken(t) ? `[${t}]` : t));
}

const DIRECTIVE = /^\{(\w+)(?::\s*(.*))?\}$/;

export function importChartText(text) {
  const meta = {};
  if (!text) return { body: '', meta };
  const src = text.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let inTab = false;

  const pushBlank = () => { if (out.length && out[out.length - 1] !== '') out.push(''); };

  for (let i = 0; i < src.length; i++) {
    const line = src[i].replace(/\s+$/, '');

    // Inside a ChordPro tab block — copy verbatim until the close directive.
    if (inTab) {
      const d = line.trim().match(DIRECTIVE);
      if (d && /^(eot|end_of_tab)$/i.test(d[1])) { out.push('{/tab}'); inTab = false; continue; }
      out.push(line);
      continue;
    }

    const dir = line.trim().match(DIRECTIVE);
    if (dir) {
      const name = dir[1].toLowerCase();
      const val = (dir[2] || '').trim();
      if (/^(title|t)$/.test(name)) meta.title = val;
      else if (/^(artist|subtitle|st)$/.test(name)) meta.artist = meta.artist || val;
      else if (name === 'key') meta.key = val;
      else if (name === 'tempo') meta.tempo = val;
      else if (name === 'time') meta.time = val;
      else if (name === 'capo') meta.capo = val;
      else if (/^(comment|c|ci|comment_italic)$/.test(name)) { if (val) out.push(`> ${val}`); }
      else if (/^(soc|start_of_chorus)$/.test(name)) { pushBlank(); out.push('## Chorus'); }
      else if (/^(sov|start_of_verse)$/.test(name)) { pushBlank(); out.push('## Verse'); }
      else if (/^(sob|start_of_bridge)$/.test(name)) { pushBlank(); out.push('## Bridge'); }
      else if (/^(eoc|eov|eob|end_of_chorus|end_of_verse|end_of_bridge)$/.test(name)) { pushBlank(); }
      else if (/^(sot|start_of_tab)$/.test(name)) { out.push('{tab}'); inTab = true; }
      // Unknown directive → dropped.
      continue;
    }

    const sec = sectionFrom(line);
    if (sec) { pushBlank(); out.push(`## ${sec}`); continue; }

    if (line.trim() === '') { pushBlank(); continue; }

    if (isChordLine(line)) {
      const next = src[i + 1] != null ? src[i + 1].replace(/\s+$/, '') : '';
      const nextIsLyric = next.trim() !== '' && !isChordLine(next) && !sectionFrom(next) && !DIRECTIVE.test(next.trim());
      if (nextIsLyric) { out.push(mergeChordLyric(line, next)); i++; continue; }
      out.push(chordOnly(line));
      continue;
    }

    out.push(line);
  }

  const body = out.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return { body, meta };
}
