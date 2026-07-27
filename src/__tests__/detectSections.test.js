import { describe, it, expect } from 'vitest';
import { inferSections, ensureSections, splitBlocks } from '../lib/detectSections';
import { importChartText } from '../lib/importChords';
import { parseSongMd } from '../parser';

// A real shape: copied off a lyrics site, no section labels at all.
const WEBSITE = `La crucea Ta mă-ntorc
Din zile în care n-am luptat deloc

Îți mulțumesc că nu disprețuiești
Un duh mâhnit

La crucea Ta mă-ntorc
Altarul gol din suflet mă condamnă

Îți mulțumesc că nu disprețuiești
Un duh mâhnit`;

describe('splitBlocks', () => {
  it('splits on blank lines', () => {
    expect(splitBlocks(WEBSITE)).toHaveLength(4);
  });

  it('tolerates padding at both ends', () => {
    expect(splitBlocks('\n\nOne line\n\n\n')).toEqual([['One line']]);
  });
});

describe('inferSections', () => {
  it('finds the chorus by repetition, not by position', () => {
    const out = inferSections(WEBSITE);
    expect(out.map(s => s.type)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
  });

  it('works when the song OPENS on the chorus', () => {
    // The case you were worried about. Order tells us nothing; repetition does.
    const src = `Îți mulțumesc\nUn duh mâhnit\n\nLa crucea Ta\nDin zile\n\nÎți mulțumesc\nUn duh mâhnit`;
    expect(inferSections(src).map(s => s.type)).toEqual(['Chorus', 'Verse 1', 'Chorus']);
  });

  it('ignores chords, case and diacritics when matching blocks', () => {
    const src = `[G]Îți mulțumesc că nu disprețuiesti\n\nAltceva aici\n\nITI MULTUMESC ca nu disprețuiești!`;
    expect(inferSections(src).map(s => s.type)).toEqual(['Chorus', 'Verse 1', 'Chorus']);
  });

  it('marks a repetition-backed chorus as confident, a verse as a guess', () => {
    const out = inferSections(WEBSITE);
    expect(out.filter(s => s.type === 'Chorus').every(s => s.confident)).toBe(true);
    expect(out.filter(s => s.type.startsWith('Verse')).every(s => !s.confident)).toBe(true);
  });

  it('calls everything a verse when nothing repeats', () => {
    const src = `Block one\n\nBlock two\n\nBlock three`;
    expect(inferSections(src).map(s => s.type)).toEqual(['Verse 1', 'Verse 2', 'Verse 3']);
  });
});

describe('ensureSections', () => {
  it('leaves an already-labelled body alone', () => {
    const labelled = '## Verse 1\nWords\n\n## Chorus\nMore';
    expect(ensureSections(labelled)).toBe(labelled);
  });

  it('gives a headerless body real sections', () => {
    const out = ensureSections(WEBSITE);
    expect([...out.matchAll(/^## (.+)$/gm)].map(m => m[1]))
      .toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
  });

  it('is safe on empty input', () => {
    expect(ensureSections('')).toBe('');
    expect(ensureSections(null)).toBe('');
  });
});

describe('the data loss this prevents', () => {
  it('an unlabelled paste survives the round trip', () => {
    // Before: importChartText produced a headerless body, parseSongMd dropped
    // every line before the first "## " — so the whole song vanished on save.
    const { body } = importChartText(WEBSITE);
    const md = `---\ntitle: T\nkey: C\n---\n\n${body}`;
    const song = parseSongMd(md);

    expect(song.sections.length).toBeGreaterThan(0);
    const allText = song.sections.flatMap(s => s.lines).join('\n');
    expect(allText).toContain('La crucea Ta mă-ntorc');
    expect(allText).toContain('Un duh mâhnit');
    expect(allText).toContain('Altarul gol din suflet mă condamnă');
  });

  it('shows what a headerless body still does to the parser', () => {
    // Kept as documentation: this is why ensureSections exists, and why a body
    // must never reach the editor without at least one header.
    const md = '---\ntitle: T\nkey: C\n---\n\nLoose lyric with no heading\n';
    expect(parseSongMd(md).sections).toEqual([]);
  });
});
