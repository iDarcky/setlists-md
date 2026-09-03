import { describe, it, expect } from 'vitest';
import {
  applyPasteAtSection,
  splitSections,
  hasSectionHeaders,
  isEmptyChart,
} from '@/lib/pasteScope';

const CHART = `## Verse 1
[G]Amazing grace how sweet

## Chorus
[C]My chains are gone

## Verse 2
[G]'Twas grace that taught
`;

describe('splitSections', () => {
  it('splits a chart into its sections', () => {
    const blocks = splitSections(CHART);
    expect(blocks.map(b => b.header)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });

  it('keeps text before the first header as a headerless block', () => {
    const blocks = splitSections('loose line\n\n## Verse 1\nlyric');
    expect(blocks[0].header).toBe(null);
    expect(blocks[1].header).toBe('Verse 1');
  });
});

describe('isEmptyChart', () => {
  it('is true for a brand-new song with one empty section', () => {
    expect(isEmptyChart('## Verse 1\n\n')).toBe(true);
  });

  it('is false once anything is written', () => {
    expect(isEmptyChart('## Verse 1\nAmazing grace')).toBe(false);
  });
});

describe('applyPasteAtSection — the whole song', () => {
  it('replaces everything when pasted on the background', () => {
    const pasted = '## Verse 1\n[D]La crucea Ta';
    expect(applyPasteAtSection(CHART, pasted, null)).toBe('## Verse 1\n[D]La crucea Ta\n');
  });

  it('ignores an empty paste', () => {
    expect(applyPasteAtSection(CHART, '   ', 1)).toBe(CHART);
  });
});

describe('applyPasteAtSection — one section', () => {
  it('fills just that section, keeping its name', () => {
    // Pasting a bare verse into the Chorus must not rename the Chorus.
    const out = applyPasteAtSection(CHART, '[F]New chorus words', 1);
    const blocks = splitSections(out);
    expect(blocks.map(b => b.header)).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
    expect(blocks[1].lines.join('\n').trim()).toBe('[F]New chorus words');
    // The neighbours are untouched.
    expect(blocks[0].lines.join('\n')).toContain('Amazing grace');
    expect(blocks[2].lines.join('\n')).toContain("'Twas grace");
  });

  it('replaces the section with several when the paste has headers', () => {
    const pasted = '## Pre-Chorus\n[Am]Rising\n\n## Chorus\n[C]Set free';
    const out = applyPasteAtSection(CHART, pasted, 1);
    expect(splitSections(out).map(b => b.header))
      .toEqual(['Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2']);
  });

  it('handles a paste into the last section', () => {
    const out = applyPasteAtSection(CHART, '[G]Final words', 2);
    const blocks = splitSections(out);
    expect(blocks).toHaveLength(3);
    expect(blocks[2].lines.join('\n').trim()).toBe('[G]Final words');
  });

  it('falls back to whole-song when the index does not exist', () => {
    const out = applyPasteAtSection(CHART, '## Verse 1\n[D]Only this', 9);
    expect(out).toBe('## Verse 1\n[D]Only this\n');
  });

  it('is not confused by a leading headerless block', () => {
    const body = 'stray\n\n## Verse 1\nfirst\n\n## Chorus\nsecond\n';
    // Section 0 is "Verse 1", not the stray block.
    const out = applyPasteAtSection(body, 'replaced', 0);
    const blocks = splitSections(out);
    expect(blocks[0].header).toBe(null);
    expect(blocks[1].header).toBe('Verse 1');
    expect(blocks[1].lines.join('\n').trim()).toBe('replaced');
    expect(blocks[2].lines.join('\n').trim()).toBe('second');
  });
});

describe('the new-song case', () => {
  it('a full-song paste into the seeded empty section becomes the song', () => {
    // This is the whole point: no "new song mode". The seeded Verse 1 is a
    // section like any other, and the paste carries headers, so it expands.
    const seeded = '## Verse 1\n\n';
    const pasted = '## Verse 1\n[D]La crucea Ta\n\n## Chorus\n[G]Îți mulțumesc';
    const out = applyPasteAtSection(seeded, pasted, 0);
    expect(splitSections(out).map(b => b.header)).toEqual(['Verse 1', 'Chorus']);
    expect(out).toContain('La crucea Ta');
    expect(out).toContain('Îți mulțumesc');
  });

  it('a headerless paste into the seeded section just fills it', () => {
    const out = applyPasteAtSection('## Verse 1\n\n', '[D]La crucea Ta', 0);
    expect(out.trim()).toBe('## Verse 1\n[D]La crucea Ta');
  });
});

describe('hasSectionHeaders', () => {
  it('detects headers', () => {
    expect(hasSectionHeaders('## Chorus\nline')).toBe(true);
    expect(hasSectionHeaders('just lyrics\nmore lyrics')).toBe(false);
  });
});
