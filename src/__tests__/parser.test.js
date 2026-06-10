import { describe, it, expect } from 'vitest';
import {
  parseSongMd,
  songToMd,
  parseLine,
  lineToPlacement,
  placementToLine,
  parseTabBlock,
  serializeTabBlock,
  parseTabPositions,
  extractInlineNotes,
  splitMd,
  parseFrontmatterFields,
  serializeFrontmatterFields,
  generateId,
} from '../parser';

const SAMPLE = `---
title: Amazing Grace
artist: Traditional
key: G
tempo: 90
time: 3/4
tags: [worship, hymn]
capo: 2
---

## Verse 1
> Gently
[G]Amazing [G7]grace how [C]sweet the [G]sound

## Chorus
[D]That saved a [G]wretch like [Em]me
{modulate: +2}
[A]Once was [D]lost but [A]now I'm [D]found

## Instrumental
{tab, time: 3/4}
e|--0--2--3--|
B|--1--3--5--|
G|--0--2--4--|
D|-----------|
A|--3--------|
E|-----------|
{/tab}
`;

describe('parseSongMd', () => {
  it('extracts frontmatter metadata', () => {
    const song = parseSongMd(SAMPLE);
    expect(song.title).toBe('Amazing Grace');
    expect(song.artist).toBe('Traditional');
    expect(song.key).toBe('G');
    expect(song.tempo).toBe(90);
    expect(song.time).toBe('3/4');
    expect(song.capo).toBe(2);
    expect(song.tags).toEqual(['worship', 'hymn']);
  });

  it('handles missing fields with sensible defaults', () => {
    const song = parseSongMd('## Verse 1\n[C]Test');
    expect(song.title).toBe('Untitled');
    expect(song.artist).toBe('Unknown');
    expect(song.key).toBe('C');
    // Tempo and time signature stay absent when not in the frontmatter,
    // so new songs don't ship with a misleading 120 bpm / 4-4 default.
    expect(song.tempo).toBeNull();
    expect(song.time).toBe('');
    expect(song.capo).toBe(0);
    expect(song.tags).toEqual([]);
  });

  it('parses sections and preserves order', () => {
    const song = parseSongMd(SAMPLE);
    expect(song.sections.map(s => s.type)).toEqual(['Verse 1', 'Chorus', 'Instrumental']);
  });

  it('captures band cues (lines starting with >)', () => {
    const song = parseSongMd(SAMPLE);
    expect(song.sections[0].note).toBe('Gently');
  });

  it('parses modulate markers into objects', () => {
    const song = parseSongMd(SAMPLE);
    const chorus = song.sections[1];
    const mod = chorus.lines.find(l => typeof l === 'object' && l.type === 'modulate');
    expect(mod).toBeDefined();
    expect(mod.semitones).toBe(2);
  });

  it('parses negative modulate markers', () => {
    const song = parseSongMd(`---\ntitle: T\n---\n## V\n{modulate: -3}\n[Am]test`);
    const mod = song.sections[0].lines.find(l => typeof l === 'object' && l.type === 'modulate');
    expect(mod.semitones).toBe(-3);
  });

  it('parses tab blocks with metadata', () => {
    const song = parseSongMd(SAMPLE);
    const tabSection = song.sections[2];
    const tab = tabSection.lines.find(l => typeof l === 'object' && l.type === 'tab');
    expect(tab).toBeDefined();
    expect(tab.time).toBe('3/4');
    expect(tab.strings).toHaveLength(6);
    expect(tab.strings[0].note).toBe('e');
  });

  it('trims trailing empty string lines from sections', () => {
    const song = parseSongMd(SAMPLE);
    const lastLine = song.sections[0].lines.at(-1);
    expect(typeof lastLine === 'string' ? lastLine.trim() : '').not.toBe('');
  });

  it('derives structure from sections when not provided', () => {
    const song = parseSongMd(SAMPLE);
    expect(song.structure).toEqual(['Verse 1', 'Chorus', 'Instrumental']);
  });
});

describe('songToMd round-trip', () => {
  it('round-trips a song through parse → serialize → parse', () => {
    const first = parseSongMd(SAMPLE);
    const md2 = songToMd(first);
    const second = parseSongMd(md2);

    expect(second.title).toBe(first.title);
    expect(second.key).toBe(first.key);
    expect(second.sections).toHaveLength(first.sections.length);
    expect(second.sections.map(s => s.type)).toEqual(first.sections.map(s => s.type));
  });

  it('preserves tab blocks across round trip', () => {
    const first = parseSongMd(SAMPLE);
    const md2 = songToMd(first);
    const second = parseSongMd(md2);
    const firstTab = first.sections[2].lines.find(l => l?.type === 'tab');
    const secondTab = second.sections[2].lines.find(l => l?.type === 'tab');
    expect(secondTab.strings.length).toBe(firstTab.strings.length);
    expect(secondTab.time).toBe(firstTab.time);
  });

  it('preserves modulate markers across round trip', () => {
    const first = parseSongMd(SAMPLE);
    const md2 = songToMd(first);
    expect(md2).toContain('{modulate: +2}');
    const second = parseSongMd(md2);
    const mod = second.sections[1].lines.find(l => l?.type === 'modulate');
    expect(mod.semitones).toBe(2);
  });

  it('emits the negative modulate sign without a leading +', () => {
    const song = {
      title: 'T', artist: 'A', key: 'C', tempo: 120, time: '4/4',
      sections: [{ type: 'V', note: '', lines: [{ type: 'modulate', semitones: -3 }] }],
    };
    const md = songToMd(song);
    expect(md).toContain('{modulate: -3}');
  });
});

describe('parseLine', () => {
  it('splits a line into chord/text parts', () => {
    const parts = parseLine('[A]I bring the [D]ashes');
    expect(parts).toEqual([
      { chord: 'A', text: 'I bring the ' },
      { chord: 'D', text: 'ashes' },
    ]);
  });

  it('treats leading plain text as a no-chord part', () => {
    const parts = parseLine('Leading plain [C]text');
    expect(parts[0]).toEqual({ chord: '', text: 'Leading plain ' });
  });

  it('returns a single empty-chord part for plain lines', () => {
    const parts = parseLine('no chords here');
    expect(parts).toHaveLength(1);
    expect(parts[0].chord).toBe('');
  });
});

describe('lineToPlacement / placementToLine', () => {
  it('round-trips a chord line', () => {
    const src = '[C]Amazing [G]grace how [F]sweet';
    const placement = lineToPlacement(src);
    expect(placement.plainText).toBe('Amazing grace how sweet');
    expect(placement.chords).toEqual([
      { chord: 'C', pos: 0 },
      { chord: 'G', pos: 8 },
      { chord: 'F', pos: 18 },
    ]);
    expect(placementToLine(placement)).toBe(src);
  });

  it('places multiple chords at the same position in correct order', () => {
    const placement = {
      plainText: 'abc',
      chords: [{ chord: 'C', pos: 0 }, { chord: 'G', pos: 3 }],
    };
    expect(placementToLine(placement)).toBe('[C]abc[G]');
  });
});

describe('extractInlineNotes', () => {
  it('separates inline notes from lyrics', () => {
    const { clean, notes } = extractInlineNotes('Line {!soft} here {!ends}');
    expect(clean).toBe('Line  here ');
    expect(notes).toEqual(['soft', 'ends']);
  });

  it('returns empty notes array when no inline notes present', () => {
    const { clean, notes } = extractInlineNotes('just lyrics');
    expect(clean).toBe('just lyrics');
    expect(notes).toEqual([]);
  });
});

describe('named tab library + references', () => {
  const md = [
    '---',
    'title: Lib Song',
    'artist: Me',
    'key: C',
    '---',
    '',
    '## Intro',
    '{tabref: Solo}',
    '',
    '## Verse 1',
    '[C]Hello',
    '{tabref: Solo}',
    '',
    '%% tabs',
    '',
    '{tab: Solo, time: 4/4}',
    'e|--0--2--3--|',
    'B|--1--3--5--|',
    'G|-----------|',
    'D|-----------|',
    'A|-----------|',
    'E|-----------|',
    '{/tab}',
    '',
  ].join('\n');

  it('parses the library and resolves references', () => {
    const song = parseSongMd(md);
    expect(song.tabLibrary).toHaveLength(1);
    expect(song.tabLibrary[0].name).toBe('Solo');
    expect(song.tabLibrary[0].tab.strings).toHaveLength(6);
    const ref = song.sections[0].lines.find(l => l?.type === 'tabref');
    expect(ref.name).toBe('Solo');
    expect(ref.tab).toBeTruthy(); // resolved
    expect(ref.tab.strings[0].content).toContain('0');
  });

  it('round-trips library + refs through songToMd', () => {
    const song = parseSongMd(md);
    const out = songToMd(song);
    expect(out).toContain('%% tabs');
    expect(out).toContain('{tab: Solo, time: 4/4}');
    expect(out.match(/\{tabref: Solo\}/g)).toHaveLength(2);
    // re-parse is stable
    const again = parseSongMd(out);
    expect(again.tabLibrary).toHaveLength(1);
    expect(again.sections.flatMap(s => s.lines).filter(l => l?.type === 'tabref')).toHaveLength(2);
  });

  it('survives the v2 arrangement round-trip (editor save path)', async () => {
    const { songFromFlat, resolveSongView } = await import('../arrangements.js');
    const flat = parseSongMd(md);
    const v2 = songFromFlat(flat);                 // Editor working song
    expect(v2.arrangements[0].tabLibrary).toHaveLength(1);
    const view = resolveSongView(v2, v2.defaultArrangementId);
    expect(view.tabLibrary).toHaveLength(1);
    const out = songToMd(v2, v2.arrangements[0]);  // re-derive md from working song
    expect(out).toContain('{tab: Solo, time: 4/4}');
    expect(parseSongMd(out).tabLibrary).toHaveLength(1);
  });

  it('leaves dangling references unresolved (null tab)', () => {
    const song = parseSongMd('---\ntitle: X\nkey: C\n---\n\n## Intro\n{tabref: Ghost}\n');
    const ref = song.sections[0].lines.find(l => l?.type === 'tabref');
    expect(ref.name).toBe('Ghost');
    expect(ref.tab).toBeNull();
  });
});

describe('parseTabBlock & serializeTabBlock', () => {
  const raw = [
    'e|--0--2--3--|',
    'B|--1--3--5--|',
    'G|--0--2--4--|',
    'D|-----------|',
    'A|--3--------|',
    'E|-----------|',
  ];

  it('parses raw lines into a tab object', () => {
    const tab = parseTabBlock(raw);
    expect(tab.type).toBe('tab');
    expect(tab.strings).toHaveLength(6);
    expect(tab.strings[0].note).toBe('e');
    expect(tab.strings[0].content).toBe('--0--2--3--|');
  });

  it('ignores malformed / non-string lines', () => {
    const tab = parseTabBlock(['noise', ...raw, 'garbage', '']);
    expect(tab.strings).toHaveLength(6);
  });

  it('uses raw for round-trip fidelity when present', () => {
    const tab = { type: 'tab', strings: [], time: '4/4', raw };
    const ascii = serializeTabBlock(tab);
    expect(ascii).toContain('{tab, time: 4/4}');
    expect(ascii).toContain('{/tab}');
    expect(ascii).toContain(raw[0]);
  });

  it('falls back to structured strings when raw is missing', () => {
    const tab = {
      type: 'tab',
      strings: [{ note: 'e', content: '--3--' }],
      time: null,
      raw: [],
    };
    const ascii = serializeTabBlock(tab);
    expect(ascii.startsWith('{tab}')).toBe(true);
    expect(ascii).toContain('e|--3--');
  });
});

describe('parseTabPositions', () => {
  it('parses single-digit frets', () => {
    const positions = parseTabPositions('--0--2--3--');
    expect(positions.map(p => p.fret)).toEqual([0, 2, 3]);
  });

  it('parses two-digit frets (10–24)', () => {
    const positions = parseTabPositions('--10--12--15--24--');
    expect(positions.map(p => p.fret)).toEqual([10, 12, 15, 24]);
  });

  it('parses technique markers attached to frets', () => {
    const positions = parseTabPositions('--3h5--7p5--');
    expect(positions.map(p => p.fret)).toEqual([3, 5, 7, 5]);
    expect(positions.find(p => p.fret === 3).technique).toBe('h');
    expect(positions.find(p => p.fret === 7).technique).toBe('p');
  });
});

describe('splitMd / replaceFrontmatter / parseFrontmatterFields', () => {
  it('splits md into frontmatter + body', () => {
    const { frontmatter, body } = splitMd('---\ntitle: X\n---\n## V\nhi');
    expect(frontmatter.trim()).toBe('title: X');
    expect(body.trim().startsWith('## V')).toBe(true);
  });

  it('returns empty frontmatter and full body when no frontmatter', () => {
    const { frontmatter, body } = splitMd('## V\nhi');
    expect(frontmatter).toBe('');
    expect(body).toBe('## V\nhi');
  });

  it('parses frontmatter fields to strings', () => {
    const fields = parseFrontmatterFields('title: X\nkey: G\ntempo: 90\ntags: [a, b]');
    expect(fields.title).toBe('X');
    expect(fields.key).toBe('G');
    expect(fields.tempo).toBe('90');
    expect(fields.tags).toBe('a, b');
  });

  it('round-trips through serializeFrontmatterFields', () => {
    const fields = {
      title: 'X', artist: 'Y', key: 'G', tempo: '90', time: '4/4',
      structure: '', ccli: '', tags: 'rock, live', capo: '', spotify: '', youtube: '', notes: '',
    };
    const text = serializeFrontmatterFields(fields);
    const parsed = parseFrontmatterFields(text);
    expect(parsed.title).toBe('X');
    expect(parsed.tags).toBe('rock, live');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(4);
  });

  it('produces different ids on subsequent calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    expect(ids.size).toBeGreaterThan(15);
  });
});

describe('edge cases', () => {
  it('handles a tab block that never closes', () => {
    const md = `---\ntitle: T\n---\n## V\n{tab}\ne|--0--\n`;
    const song = parseSongMd(md);
    const tab = song.sections[0].lines.find(l => l?.type === 'tab');
    expect(tab).toBeDefined();
    expect(tab.strings).toHaveLength(1);
  });

  it('handles sections with only a cue and no lyrics', () => {
    const md = `---\ntitle: T\n---\n## V\n> cue only\n`;
    const song = parseSongMd(md);
    expect(song.sections[0].note).toBe('cue only');
    expect(song.sections[0].lines.filter(l => typeof l === 'string' && l.trim()).length).toBe(0);
  });

  it('preserves unusual enharmonics through transpose-agnostic parse', () => {
    const md = `---\ntitle: T\nkey: F#\n---\n## V\n[Eb]test`;
    const song = parseSongMd(md);
    expect(song.key).toBe('F#');
    expect(song.sections[0].lines[0]).toContain('[Eb]');
  });
});
