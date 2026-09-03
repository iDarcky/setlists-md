import { inferStructureMode, structureFollowsSections } from './music';

// ── The `{modulate}` marker ────────────────────────────────────────────────
// One shape, two writers, two readers — kept together so the regex, the object
// and the serialised text can never drift apart. They did not drift before
// because there was nothing to drift; `every` is the first optional part this
// marker has ever had.
//
//   {modulate: +2}          fire the FIRST time this section is played
//   {modulate: +2, every}   fire on every repeat (a chorus that climbs)
//
// Why the distinction exists at all: a marker lives in the section BODY, and a
// repeated section replays its body — so a chorus containing "+2" climbed a
// step every time it was played, with no way to say "modulate, then repeat in
// the new key". See `sectionModPlan` in `lib/songFlow.js`.
export function modulateMarker(m) {
  const marker = { type: 'modulate', semitones: parseInt(m[1], 10) };
  // Absent, not `false` — the object goes through hashing and equality checks
  // in the sync engines, and a new always-present key would make every existing
  // song look changed on the first load after this ships.
  if (m[2]) marker.every = true;
  return marker;
}

export function serializeModulate(l) {
  const n = `${l.semitones > 0 ? '+' : ''}${l.semitones}`;
  return `{modulate: ${n}${l.every ? ', every' : ''}}`;
}

// Parse a .md song file into a structured object
export function parseSongMd(text) {
  const lines = text.split('\n');
  let inFrontmatter = false;
  let pastFrontmatter = false;
  const frontLines = [];
  const bodyLines = [];

  for (const line of lines) {
    if (!pastFrontmatter && line.trim() === '---') {
      if (!inFrontmatter) { inFrontmatter = true; continue; }
      else { inFrontmatter = false; pastFrontmatter = true; continue; }
    }
    if (inFrontmatter) frontLines.push(line);
    else if (pastFrontmatter) bodyLines.push(line);
    else bodyLines.push(line);
  }

  // Parse YAML frontmatter (simple key: value)
  const meta = {};
  // ── Keys this build does not model, kept verbatim ───────────────────────────
  // A dropped key is not a cosmetic loss. Measured in production 2026-08-07:
  // the extended-metadata fields entered the format on 2026-06-06, and a client
  // still running the older build stripped them on parse and deleted them on
  // its next push — while the current build re-added them. One song had its
  // `language` line added 15 times and removed 14 times in 14 days, and
  // `team_activity` reached 27,628 rows, 93% of it that ping-pong.
  //
  // So an unrecognised key rides through untouched, RAW — the exact source
  // text, not a re-serialisation of a guessed type — so the round trip is
  // byte-exact and a future field can never be destroyed by a build that
  // predates it. (This cannot repair the current loop: the old client's parser
  // has already dropped them. It stops the NEXT one.)
  const extraFrontmatter = [];
  for (const fl of frontLines) {
    const m = fl.match(/^(\w[\w\s]*?):\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else if (!isNaN(val) && val !== '') {
        val = Number(val);
      }
      const rawKey = m[1].trim();
      meta[rawKey.toLowerCase()] = val;
      if (!KNOWN_FRONTMATTER_KEYS.has(rawKey.toLowerCase())) {
        extraFrontmatter.push([rawKey, m[2].trim()]);
      }
    }
  }

  // Parse body into sections
  const sections = [];
  let current = null;
  let inTab = false;
  let tabAccum = null;
  // Named tab library (independent, reusable blocks) lives in a trailing
  // `%% tabs` region. Sections reference them with `{tabref: Name}`.
  const tabLibrary = [];
  let inLibrary = false;
  let libAccum = null;
  let libName = null;

  for (const line of bodyLines) {
    // Enter the trailing tab-library region.
    if (line.trim() === '%% tabs') {
      if (inTab && tabAccum && current) { current.lines.push(tabAccum); inTab = false; tabAccum = null; }
      if (current) { sections.push(current); current = null; }
      inLibrary = true;
      continue;
    }
    if (inLibrary) {
      const defOpen = line.match(/^\{tab:\s*([^,}]+?)(?:,\s*(.+?))?\}$/);
      if (defOpen) {
        libName = defOpen[1].trim();
        let time = null;
        const tp = (defOpen[2] || '').match(/time:\s*(\S+)/);
        if (tp) time = tp[1];
        const ip = (defOpen[2] || '').match(/instrument:\s*(\w+)/);
        const instrument = ip ? ip[1] : null;
        libAccum = { type: 'tab', strings: [], time, instrument, raw: [] };
        continue;
      }
      if (libAccum && line.trim() === '{/tab}') {
        tabLibrary.push({ name: libName, tab: libAccum });
        libAccum = null; libName = null;
        continue;
      }
      if (libAccum) {
        const sm = line.match(/^([eBGDAE])\|(.+)$/);
        if (sm) libAccum.strings.push({ note: sm[1], content: sm[2] });
        libAccum.raw.push(line);
      }
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+?)$/);
    if (sectionMatch) {
      if (inTab && tabAccum && current) {
        current.lines.push(tabAccum);
        inTab = false;
        tabAccum = null;
      }
      if (current) sections.push(current);
      current = { type: sectionMatch[1].trim(), note: '', lines: [] };
      continue;
    }
    // Lines starting with > are band/performance notes
    if (line.match(/^>\s*(.*)/)) {
      // ⚠ Strip exactly the ONE space the serializer writes (`> ${note}`) — do
      // NOT trim. The cue field in the editor round-trips through
      // songToMd → parse on every keystroke, so a `.trim()` here deleted the
      // trailing space before it could become a word boundary: you could type
      // one word into a band cue and no more (PLAN §1.2 #3c, prio 1, reported
      // 2026-08-04). Trimming is right for a file and wrong for a keystroke,
      // and this line is both. `\r` is dropped for CRLF files.
      if (current) current.note = line.replace(/^>[ \t]?/, '').replace(/\r$/, '');
      continue;
    }

    // Tab block detection
    const tabOpen = line.match(/^\{tab(?:,\s*(.+?))?\}$/);
    if (tabOpen) {
      inTab = true;
      const meta = tabOpen[1] || '';
      let time = null;
      const timePart = meta.match(/time:\s*(\S+)/);
      if (timePart) time = timePart[1];
      const instPart = meta.match(/instrument:\s*(\w+)/);
      const instrument = instPart ? instPart[1] : null;
      tabAccum = { type: 'tab', strings: [], time, instrument, raw: [] };
      continue;
    }
    if (inTab && line.trim() === '{/tab}') {
      if (current && tabAccum) current.lines.push(tabAccum);
      inTab = false;
      tabAccum = null;
      continue;
    }
    if (inTab && tabAccum) {
      const strMatch = line.match(/^([eBGDAE])\|(.+)$/);
      if (strMatch) {
        tabAccum.strings.push({ note: strMatch[1], content: strMatch[2] });
      }
      tabAccum.raw.push(line);
      continue;
    }

    // Modulate marker detection
    const modMatch = line.match(/^\{modulate:\s*([+-]?\d+)(\s*,\s*every)?\}$/);
    if (modMatch) {
      // `every` = climb on every repeat; bare = fire the first time only.
      // See `sectionModPlan` for why a repeated section needed the distinction.
      if (current) current.lines.push(modulateMarker(modMatch));
      continue;
    }

    // Reference to a named library tab.
    const refMatch = line.match(/^\{tabref:\s*(.+?)\}$/);
    if (refMatch) {
      if (current) current.lines.push({ type: 'tabref', name: refMatch[1].trim() });
      continue;
    }

    if (current) current.lines.push(line);
  }
  if (inTab && tabAccum && current) {
    current.lines.push(tabAccum);
  }
  if (current) sections.push(current);

  if (libAccum && libName) tabLibrary.push({ name: libName, tab: libAccum });

  // Trim trailing empty lines from each section
  for (const s of sections) {
    while (s.lines.length) {
      const last = s.lines[s.lines.length - 1];
      if (typeof last === 'string' && !last.trim()) s.lines.pop();
      else break;
    }
  }

  // Resolve tab references to their library block (kept by name for re-export).
  const libMap = new Map(tabLibrary.map(t => [t.name, t.tab]));
  for (const s of sections) {
    for (const l of s.lines) {
      if (l && typeof l === 'object' && l.type === 'tabref') l.tab = libMap.get(l.name) || null;
    }
  }

  return {
    // `id` is legacy; new-shape files only emit `songId` + `arrangementId`.
    // Fall back to songId so a file without `id:` still parses with one.
    id: meta.id || meta.songid || null,
    title: meta.title || 'Untitled',
    artist: meta.artist || 'Unknown',
    key: meta.key || 'C',
    tempo: meta.tempo || null,
    time: meta.time || '',
    duration: meta.duration || '',
    ccli: meta.ccli || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    spotify: meta.spotify || '',
    youtube: meta.youtube || '',
    capo: meta.capo || 0,
    notes: meta.notes || '',
    structure: Array.isArray(meta.structure)
      ? meta.structure
      : (typeof meta.structure === 'string'
        ? meta.structure.split(',').map(s => s.trim()).filter(Boolean)
        : sections.map(s => s.type)),
    // Element 8 — key changes as an overlay on the play order. See
    // `lib/keyChanges.js` for why they are not in the section bodies and not
    // in `structure`. Wire format is `slot:line:semitones`, one triple per
    // entry: `keyChanges: [3:0:+2, 5:4:-1]`.
    keyChanges: parseKeyChangeList(meta.keychanges ?? meta.keyChanges),
    // Whether the play order is a hand-tuned custom slide order or just follows
    // the section (document) order. Honour an explicit frontmatter value;
    // otherwise infer from whether the saved structure already differs.
    structureMode: (meta.structuremode === 'custom' || meta.structuremode === 'auto')
      ? meta.structuremode
      : inferStructureMode(
          Array.isArray(meta.structure)
            ? meta.structure
            : (typeof meta.structure === 'string' ? meta.structure.split(',').map(s => s.trim()).filter(Boolean) : []),
          sections,
        ),
    sections,
    tabLibrary,
    // Extended descriptive metadata (song-level).
    ...Object.fromEntries(EXTRA_META_FIELDS.map(([k]) => [k, meta[k] != null ? String(meta[k]) : ''])),
    // Frontmatter this build does not model, verbatim, in source order.
    // Absent (not an empty array) when there is none, so the common song shape
    // is unchanged and no existing song's hash moves.
    ...(extraFrontmatter.length ? { extraFrontmatter } : null),
    // Arrangement linkage — null when the file is a standalone (single-arrangement) song.
    songId: meta.songid || null,
    arrangementId: meta.arrangementid || null,
    arrangementName: meta.arrangementname || null,
  };
}

// Extended descriptive metadata carried at song level: [objectKey, mdKey].
export const EXTRA_META_FIELDS = [
  ['originaltitle', 'originalTitle'],
  ['language', 'language'],
  ['translator', 'translator'],
  ['writers', 'writers'],
  ['publishers', 'publishers'],
  ['copyright', 'copyright'],
  ['album', 'album'],
  ['label', 'label'],
  ['year', 'year'],
  ['themes', 'themes'],
  ['genres', 'genres'],
  ['scripture', 'scripture'],
  ['vocalrange', 'vocalRange'],
  ['moment', 'moment'],
  ['story', 'story'],
];
export const EXTRA_META_KEYS = EXTRA_META_FIELDS.map(([k]) => k);

/**
 * Every frontmatter key this version of the format understands, lower-cased.
 *
 * Anything NOT in here is carried through parse → serialize untouched (see
 * `extraFrontmatter`). That is the whole point: a build that predates a field
 * must not be able to DELETE it.
 *
 * ⚠ Keep it in step with `songToMd`'s frontmatter block. `parser.test.js`
 * asserts it, by serializing a song with every field populated and checking
 * that every key it emits is listed here — so adding a key to the serializer
 * and forgetting this list fails the suite rather than silently duplicating
 * the key on the next save.
 */
export const KNOWN_FRONTMATTER_KEYS = new Set([
  'id', 'title', 'artist', 'key', 'tempo', 'time', 'duration', 'ccli', 'tags',
  'spotify', 'youtube', 'capo', 'notes', 'structure', 'structuremode',
  'songid', 'arrangementid', 'arrangementname', 'keychanges',
  ...EXTRA_META_KEYS,
]);

/**
 * `[3:0:+2, 5:4:-1]` → `[{slot,line,semitones}]`.
 *
 * Deliberately forgiving: anything that is not three integers is dropped
 * rather than thrown, because a hand-edited `.md` is a text file people mistype
 * and half a key change is worse than none. `normalizeKeyChanges` (in
 * `lib/keyChanges.js`) does the same job on the way out of the app; this is the
 * same contract at the file boundary.
 */
export function parseKeyChangeList(raw) {
  const parts = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string' ? raw.split(',') : []);
  const out = [];
  for (const part of parts) {
    const m = String(part).trim().match(/^(\d+):(\d+):([+-]?\d+)$/);
    if (!m) continue;
    const semitones = parseInt(m[3], 10);
    if (!semitones) continue;
    out.push({ slot: parseInt(m[1], 10), line: parseInt(m[2], 10), semitones });
  }
  return out;
}

/** The inverse. Empty in → nothing emitted, so untouched songs round-trip. */
export function serializeKeyChangeList(list) {
  return (list || [])
    .filter(e => e && Number.isFinite(e.slot) && Number.isFinite(e.line) && e.semitones)
    .map(e => `${e.slot}:${e.line}:${e.semitones > 0 ? '+' : ''}${e.semitones}`)
    .join(', ');
}

// Frontmatter is one line per field. Strip newlines/tabs that would break the
// parse (or inject stray keys) and trim. Internal single spaces are preserved.
export function sanitizeFrontmatterValue(v) {
  if (v == null) return '';
  return String(v).replace(/[\r\n\t\f\v]+/g, ' ').trim();
}

// Convert a song object back to .md format.
// Accepts both the v2 song shape (with arrangements[]) and the legacy flat
// shape. For v2 songs, pass `arrangement` to choose which arrangement to
// serialize; omitted, the default arrangement is used. The emitted .md
// includes `songId` + `arrangementId` + `arrangementName` frontmatter so
// multiple files for one song can be re-grouped on import.
export function songToMd(song, arrangement) {
  // Resolve a flat view of the song so the rest of this function can stay
  // shape-agnostic.
  let arr = arrangement;
  let isV2 = Array.isArray(song?.arrangements) && song.arrangements.length > 0;
  if (isV2 && !arr) {
    arr = song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0];
  }
  const view = isV2
    ? {
        id: song.id,
        title: song.title,
        artist: song.artist,
        ccli: song.ccli,
        tags: song.tags,
        spotify: song.spotify,
        youtube: song.youtube,
        ...Object.fromEntries(EXTRA_META_FIELDS.map(([k]) => [k, song[k]])),
        extraFrontmatter: song.extraFrontmatter,
        key: arr?.key,
        tempo: arr?.tempo,
        time: arr?.time,
        capo: arr?.capo,
        notes: arr?.notes,
        structure: arr?.structure,
        structureMode: arr?.structureMode,
        sections: arr?.sections || [],
        tabLibrary: arr?.tabLibrary || song.tabLibrary || [],
        _songId: song.id,
        _arrangementId: arr?.id,
        _arrangementName: arr?.name,
      }
    : song;

  let md = '---\n';
  // For v2 songs we use songId+arrangementId for identity (a song with N
  // arrangements gets N .md files; each one's identity is the pair). For
  // legacy single-arrangement exports we still emit `id` so older tooling
  // keeps working.
  const useArrangementIdentity = !!(view._songId && view._arrangementId);
  const sv = sanitizeFrontmatterValue;
  if (!useArrangementIdentity && view.id) md += `id: ${sv(view.id)}\n`;
  md += `title: ${sv(view.title)}\n`;
  md += `artist: ${sv(view.artist)}\n`;
  md += `key: ${sv(view.key)}\n`;
  if (view.tempo) md += `tempo: ${sv(view.tempo)}\n`;
  if (view.time) md += `time: ${sv(view.time)}\n`;
  if (view.duration) md += `duration: ${sv(view.duration)}\n`;
  if (view.ccli) md += `ccli: "${sv(view.ccli)}"\n`;
  if (view.tags?.length) md += `tags: [${sv(view.tags.join(', '))}]\n`;
  if (view.spotify) md += `spotify: ${sv(view.spotify)}\n`;
  if (view.youtube) md += `youtube: ${sv(view.youtube)}\n`;
  if (view.capo) md += `capo: ${sv(view.capo)}\n`;
  if (view.notes) md += `notes: ${sv(view.notes)}\n`;
  for (const [k, mdKey] of EXTRA_META_FIELDS) {
    if (view[k]) md += `${mdKey}: ${sv(view[k])}\n`;
  }
  // Emit the play order (kept byte-stable with how it was stored). Auto songs
  // carry it too — it simply mirrors document order and is ignored at render —
  // so existing files round-trip identically without a forced re-sync.
  if (view.structure && view.structure.length > 0) {
    md += `structure: [${sv(view.structure.join(', '))}]\n`;
  }
  // Element 8's overlay. Anchored to the PLAY ORDER, so it is emitted next to
  // the play order and read with it — an anchor without its structure is an
  // index into nothing.
  const kc = serializeKeyChangeList(view.keyChanges);
  if (kc) md += `keyChanges: [${sv(kc)}]\n`;
  // Flag a hand-tuned custom slide order so the reader (and the editor toggle)
  // honour it. Auto stays implicit. Older custom songs with no flag are
  // detected by their order already differing from document order.
  const isCustomStructure = view.structureMode === 'custom'
    || (view.structureMode == null && view.structure && view.structure.length > 0
        && !structureFollowsSections(view.structure, view.sections));
  if (isCustomStructure) {
    md += `structureMode: custom\n`;
  }
  // Unmodelled keys, last and verbatim. Order among themselves is the source
  // file's; position after the known block is arbitrary but STABLE, which is
  // all the round trip needs.
  for (const [k, raw] of view.extraFrontmatter || []) {
    md += `${k}: ${raw}\n`;
  }
  if (useArrangementIdentity) {
    md += `songId: ${view._songId}\n`;
    md += `arrangementId: ${view._arrangementId}\n`;
    if (view._arrangementName) md += `arrangementName: ${view._arrangementName}\n`;
  }
  md += '---\n\n';

  for (const sec of (view.sections || [])) {
    md += `## ${sec.type}\n`;
    if (sec.note) md += `> ${sec.note}\n`;
    md += (sec.lines || []).map(l => {
      if (typeof l === 'string') return l;
      if (l && l.type === 'tab') return serializeTabBlock(l);
      if (l && l.type === 'tabref') return `{tabref: ${l.name}}`;
      if (l && l.type === 'modulate') return serializeModulate(l);
      return '';
    }).join('\n') + '\n\n';
  }

  // Trailing named-tab library (independent reusable blocks).
  const lib = view.tabLibrary || [];
  if (lib.length > 0) {
    md += '%% tabs\n\n';
    md += lib.map(serializeTabDef).join('\n\n') + '\n';
  }

  return md.trim() + '\n';
}

// Serialize a named library tab: `{tab: Name, time: T}` … `{/tab}`.
export function serializeTabDef({ name, tab }) {
  const attrs = [];
  if (tab?.instrument) attrs.push(`instrument: ${tab.instrument}`);
  if (tab?.time) attrs.push(`time: ${tab.time}`);
  const header = `{tab: ${name}${attrs.length ? ', ' + attrs.join(', ') : ''}}`;
  const bodyLines = (tab?.raw && tab.raw.length > 0)
    ? tab.raw
    : (tab?.strings || []).map(s => `${s.note}|${s.content}`);
  return `${header}\n${bodyLines.join('\n')}\n{/tab}`;
}

// Parse a lyric line into chord+text pairs
// Input:  "[A]I bring the [D]ashes"
// Output: [{chord:"A", text:"I bring the "}, {chord:"D", text:"ashes"}]
export function parseLine(line) {
  const parts = [];
  const re = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const text = line.slice(lastIndex, match.index);
      if (parts.length > 0) {
        parts[parts.length - 1].text += text;
      } else {
        parts.push({ chord: '', text });
      }
    }
    parts.push({ chord: match[1], text: '' });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < line.length) {
    const text = line.slice(lastIndex);
    if (parts.length > 0) {
      parts[parts.length - 1].text += text;
    } else {
      parts.push({ chord: '', text });
    }
  }

  return parts;
}

// Convert a chord-annotated line to placement model
// "[C]Amazing [G]grace" → { plainText: "Amazing grace", chords: [{chord:"C",pos:0},{chord:"G",pos:8}] }
export function lineToPlacement(line) {
  const chords = [];
  const re = /\[([^\]]+)\]/g;
  let match, stripped = '', lastIndex = 0;
  while ((match = re.exec(line)) !== null) {
    stripped += line.slice(lastIndex, match.index);
    chords.push({ chord: match[1], pos: stripped.length });
    lastIndex = re.lastIndex;
  }
  stripped += line.slice(lastIndex);
  return { plainText: stripped, chords };
}
 
// Convert placement model back to chord-annotated line
// { plainText: "Amazing grace", chords: [{chord:"C",pos:0},{chord:"G",pos:8}] } → "[C]Amazing [G]grace"
export function placementToLine({ plainText, chords }) {
  const sorted = [...chords].sort((a, b) => b.pos - a.pos);
  let result = plainText;
  for (const c of sorted) {
    result = result.slice(0, c.pos) + '[' + c.chord + ']' + result.slice(c.pos);
  }
  return result;
}
 
// Serialize a tab block object back to ASCII
export function serializeTabBlock(tab) {
  const attrs = [];
  if (tab.instrument) attrs.push(`instrument: ${tab.instrument}`);
  if (tab.time) attrs.push(`time: ${tab.time}`);
  const header = `{tab${attrs.length ? ', ' + attrs.join(', ') : ''}}`;
  // Prefer raw lines for round-trip fidelity
  if (tab.raw && tab.raw.length > 0) {
    return header + '\n' + tab.raw.join('\n') + '\n{/tab}';
  }
  // Generate from structured data (grid-editor-created)
  const lines = tab.strings.map(s => `${s.note}|${s.content}`);
  return header + '\n' + lines.join('\n') + '\n{/tab}';
}

// Parse tab string content into positioned fret data for rendering
export function parseTabPositions(content) {
  const positions = [];
  const measures = content.split('|').filter(m => m.length > 0);
  let charOffset = 0;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    let i = 0;
    while (i < measure.length) {
      const ch = measure[i];
      if (ch >= '0' && ch <= '9') {
        // Check for two-digit fret numbers (10-24)
        let fretStr = ch;
        if (i + 1 < measure.length && measure[i + 1] >= '0' && measure[i + 1] <= '9') {
          fretStr += measure[i + 1];
          i++;
        }
        const fret = parseInt(fretStr, 10);
        // Check for trailing technique marker
        let technique = null;
        if (i + 1 < measure.length) {
          const next = measure[i + 1];
          if ('hpsbx~'.includes(next) || next === '/' || next === '\\') {
            technique = next;
            i++;
          }
        }
        positions.push({ fret, pos: charOffset + i - (fretStr.length - 1), measure: mi, technique });
      }
      i++;
    }
    charOffset += measure.length + 1; // +1 for the | separator
  }

  return positions;
}

// Parse raw string lines (without delimiters) into a tab object
export function parseTabBlock(rawLines) {
  const tab = { type: 'tab', strings: [], time: null, raw: [...rawLines] };
  for (const line of rawLines) {
    const m = line.match(/^([eBGDAE])\|(.+)$/);
    if (m) {
      tab.strings.push({ note: m[1], content: m[2] });
    }
  }
  return tab;
}

// Reconstruct a section's `lines[]` (plain strings plus tab / modulate /
// tabref objects) from a raw multi-line string. Mirrors the per-line handling
// inside parseSongMd so editing a section as text — e.g. the bottom-sheet
// drawer in ArrangeTabV2 — round-trips tab blocks instead of flattening them
// to plain `{tab}` / `e|...` strings (which then vanish on the next parse).
export function parseSectionLines(rawText) {
  const lines = String(rawText ?? '').split('\n');
  const out = [];
  let inTab = false;
  let tabAccum = null;
  for (const line of lines) {
    const tabOpen = line.match(/^\{tab(?:,\s*(.+?))?\}$/);
    if (tabOpen) {
      inTab = true;
      const meta = tabOpen[1] || '';
      const timePart = meta.match(/time:\s*(\S+)/);
      const instPart = meta.match(/instrument:\s*(\w+)/);
      tabAccum = {
        type: 'tab',
        strings: [],
        time: timePart ? timePart[1] : null,
        instrument: instPart ? instPart[1] : null,
        raw: [],
      };
      continue;
    }
    if (inTab && line.trim() === '{/tab}') {
      if (tabAccum) out.push(tabAccum);
      inTab = false;
      tabAccum = null;
      continue;
    }
    if (inTab && tabAccum) {
      const strMatch = line.match(/^([eBGDAE])\|(.+)$/);
      if (strMatch) tabAccum.strings.push({ note: strMatch[1], content: strMatch[2] });
      tabAccum.raw.push(line);
      continue;
    }
    const modMatch = line.match(/^\{modulate:\s*([+-]?\d+)(\s*,\s*every)?\}$/);
    if (modMatch) {
      out.push(modulateMarker(modMatch));
      continue;
    }
    const refMatch = line.match(/^\{tabref:\s*(.+?)\}$/);
    if (refMatch) {
      out.push({ type: 'tabref', name: refMatch[1].trim() });
      continue;
    }
    out.push(line);
  }
  if (inTab && tabAccum) out.push(tabAccum);
  return out;
}

// Extract inline notes {!text} from a line
// Returns { clean: lineWithoutNotes, notes: ['note1', 'note2'] }
export function extractInlineNotes(line) {
  const notes = [];
  const clean = line.replace(/\{!([^}]*)\}/g, (_, text) => {
    // Same rule as the band cue above: the space the writer typed is theirs.
    // This one runs at RENDER, not at parse (the `{!…}` marker stays in the
    // line), which is why the inline note never actually ate a keystroke the
    // way the cue did — but a deliberate space still vanished from the page.
    notes.push(text);
    return '';
  });
  return { clean, notes };
}

/**
 * How long a cue and an inline note may be.
 *
 * Measured, not guessed (2026-08-06, Chromium, the reader's own heading row):
 * a band cue wraps to **2 rows at 70 characters on a 360px phone** and to 3 at
 * 80. Two rows is the ceiling the owner set — the heading pins with its cue, so
 * every row beyond that is a row of the song the pin is covering.
 *
 * Enforced at the INPUT (the editor's cue field and inline-note field), because
 * a cap applied at render is a truncation the writer never sees coming. A
 * longer cue arriving from an imported file is still shown, clipped, by the
 * reader — a file is not a keystroke.
 */
export const CUE_MAX_CHARS = 70;
export const INLINE_NOTE_MAX_CHARS = 40;

// Generate a unique ID for songs and setlists
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Frontmatter utilities ────────────────────────────────────────

// Split md into frontmatter and body parts
export function splitMd(md) {
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { frontmatter: '', body: md };
  return {
    frontmatter: fmMatch[1],
    body: md.substring(fmMatch[0].length),
  };
}

// Replace frontmatter in md while preserving body exactly
export function replaceFrontmatter(md, newFrontmatter) {
  const { body } = splitMd(md);
  return `---\n${newFrontmatter}\n---${body}`;
}

// Parse frontmatter text into flat field object (strings, for form editing)
export function parseFrontmatterFields(frontmatter) {
  const fields = {
    title: '', artist: '', key: '', tempo: '', time: '', duration: '',
    structure: '', structuremode: '', ccli: '', tags: '', capo: '',
    spotify: '', youtube: '', notes: '',
    songid: '', arrangementid: '', arrangementname: '',
    // Extended descriptive metadata (all optional, plain strings).
    originaltitle: '', language: '', translator: '',
    writers: '', publishers: '', copyright: '',
    album: '', label: '', year: '',
    themes: '', genres: '', scripture: '', vocalrange: '',
    moment: '', story: '',
  };
  if (!frontmatter) return fields;
  frontmatter.split('\n').forEach(line => {
    const m = line.match(/^(\w[\w\s]*?):\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      let val = m[2].trim();
      // Strip brackets from arrays, quotes from strings
      if (val.startsWith('[') && val.endsWith(']')) val = val.slice(1, -1);
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (Object.hasOwn(fields, key)) fields[key] = val;
    }
  });
  return fields;
}

// Serialize field object back to frontmatter text. Values are sanitized so a
// pasted newline (or a `key: value`-looking line) inside a field can't break
// the frontmatter or inject stray keys.
export function serializeFrontmatterFields(fields) {
  const s = sanitizeFrontmatterValue;
  const lines = [];
  if (fields.title) lines.push(`title: ${s(fields.title)}`);
  if (fields.artist) lines.push(`artist: ${s(fields.artist)}`);
  if (fields.key) lines.push(`key: ${s(fields.key)}`);
  if (fields.tempo) lines.push(`tempo: ${s(fields.tempo)}`);
  if (fields.time) lines.push(`time: ${s(fields.time)}`);
  if (fields.duration) lines.push(`duration: ${s(fields.duration)}`);
  // Structure is now a user-edited list (Proclaim-style). Persist
  // verbatim through the form-editor round-trip so the chip editor
  // can hand it back unchanged.
  if (fields.structure) lines.push(`structure: [${s(fields.structure)}]`);
  if (fields.structuremode === 'custom') lines.push(`structureMode: custom`);
  if (fields.ccli) lines.push(`ccli: "${s(fields.ccli)}"`);
  if (fields.tags) lines.push(`tags: [${s(fields.tags)}]`);
  if (fields.capo) lines.push(`capo: ${s(fields.capo)}`);
  if (fields.spotify) lines.push(`spotify: ${s(fields.spotify)}`);
  if (fields.youtube) lines.push(`youtube: ${s(fields.youtube)}`);
  if (fields.notes) lines.push(`notes: ${s(fields.notes)}`);
  // Extended descriptive metadata.
  for (const [objKey, mdKey] of EXTRA_META_FIELDS) {
    if (fields[objKey]) lines.push(`${mdKey}: ${s(fields[objKey])}`);
  }
  if (fields.songid) lines.push(`songId: ${s(fields.songid)}`);
  if (fields.arrangementid) lines.push(`arrangementId: ${s(fields.arrangementid)}`);
  if (fields.arrangementname) lines.push(`arrangementName: ${s(fields.arrangementname)}`);
  return lines.join('\n');
}
