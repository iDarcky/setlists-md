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
      meta[m[1].trim().toLowerCase()] = val;
    }
  }

  // Parse body into sections
  const sections = [];
  let current = null;
  let inTab = false;
  let tabAccum = null;

  for (const line of bodyLines) {
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
      if (current) current.note = line.replace(/^>\s*/, '').trim();
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
      tabAccum = { type: 'tab', strings: [], time, raw: [] };
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
    const modMatch = line.match(/^\{modulate:\s*([+-]?\d+)\}$/);
    if (modMatch) {
      if (current) current.lines.push({ type: 'modulate', semitones: parseInt(modMatch[1], 10) });
      continue;
    }

    if (current) current.lines.push(line);
  }
  if (inTab && tabAccum && current) {
    current.lines.push(tabAccum);
  }
  if (current) sections.push(current);

  // Trim trailing empty lines from each section
  for (const s of sections) {
    while (s.lines.length) {
      const last = s.lines[s.lines.length - 1];
      if (typeof last === 'string' && !last.trim()) s.lines.pop();
      else break;
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
    sections,
    // Arrangement linkage — null when the file is a standalone (single-arrangement) song.
    songId: meta.songid || null,
    arrangementId: meta.arrangementid || null,
    arrangementName: meta.arrangementname || null,
  };
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
        key: arr?.key,
        tempo: arr?.tempo,
        time: arr?.time,
        capo: arr?.capo,
        notes: arr?.notes,
        structure: arr?.structure,
        sections: arr?.sections || [],
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
  if (!useArrangementIdentity && view.id) md += `id: ${view.id}\n`;
  md += `title: ${view.title}\n`;
  md += `artist: ${view.artist}\n`;
  md += `key: ${view.key}\n`;
  if (view.tempo) md += `tempo: ${view.tempo}\n`;
  if (view.time) md += `time: ${view.time}\n`;
  if (view.ccli) md += `ccli: "${view.ccli}"\n`;
  if (view.tags?.length) md += `tags: [${view.tags.join(', ')}]\n`;
  if (view.spotify) md += `spotify: ${view.spotify}\n`;
  if (view.youtube) md += `youtube: ${view.youtube}\n`;
  if (view.capo) md += `capo: ${view.capo}\n`;
  if (view.notes) md += `notes: ${view.notes}\n`;
  // Only emit `structure:` when the user has explicitly set a custom
  // section order (Proclaim-style). When empty, render falls back to
  // document order so we don't want to bake that order into the file.
  if (view.structure && view.structure.length > 0) {
    md += `structure: [${view.structure.join(', ')}]\n`;
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
      if (l && l.type === 'modulate') return `{modulate: ${l.semitones > 0 ? '+' : ''}${l.semitones}}`;
      return '';
    }).join('\n') + '\n\n';
  }

  return md.trim() + '\n';
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
  // Prefer raw lines for round-trip fidelity
  if (tab.raw && tab.raw.length > 0) {
    const header = tab.time ? `{tab, time: ${tab.time}}` : '{tab}';
    return header + '\n' + tab.raw.join('\n') + '\n{/tab}';
  }
  // Generate from structured data (grid-editor-created)
  const header = tab.time ? `{tab, time: ${tab.time}}` : '{tab}';
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

// Extract inline notes {!text} from a line
// Returns { clean: lineWithoutNotes, notes: ['note1', 'note2'] }
export function extractInlineNotes(line) {
  const notes = [];
  const clean = line.replace(/\{!([^}]*)\}/g, (_, text) => {
    notes.push(text.trim());
    return '';
  });
  return { clean, notes };
}

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
    title: '', artist: '', key: 'C', tempo: '', time: '',
    structure: '', ccli: '', tags: '', capo: '',
    spotify: '', youtube: '', notes: '',
    songid: '', arrangementid: '', arrangementname: '',
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

// Serialize field object back to frontmatter text
export function serializeFrontmatterFields(fields) {
  const lines = [];
  if (fields.title) lines.push(`title: ${fields.title}`);
  if (fields.artist) lines.push(`artist: ${fields.artist}`);
  if (fields.key) lines.push(`key: ${fields.key}`);
  if (fields.tempo) lines.push(`tempo: ${fields.tempo}`);
  if (fields.time) lines.push(`time: ${fields.time}`);
  // Structure is now a user-edited list (Proclaim-style). Persist
  // verbatim through the form-editor round-trip so the chip editor
  // can hand it back unchanged.
  if (fields.structure) lines.push(`structure: [${fields.structure}]`);
  if (fields.ccli) lines.push(`ccli: "${fields.ccli}"`);
  if (fields.tags) lines.push(`tags: [${fields.tags}]`);
  if (fields.capo) lines.push(`capo: ${fields.capo}`);
  if (fields.spotify) lines.push(`spotify: ${fields.spotify}`);
  if (fields.youtube) lines.push(`youtube: ${fields.youtube}`);
  if (fields.notes) lines.push(`notes: ${fields.notes}`);
  if (fields.songid) lines.push(`songId: ${fields.songid}`);
  if (fields.arrangementid) lines.push(`arrangementId: ${fields.arrangementid}`);
  if (fields.arrangementname) lines.push(`arrangementName: ${fields.arrangementname}`);
  return lines.join('\n');
}
