import { describe, it, expect } from 'vitest';
import { inferSections, sectionLabel } from '@/lib/detectSections';

describe('sectionLabel', () => {
  it('reads the names people type above the words', () => {
    expect(sectionLabel('Verse 1')).toBe('Verse 1');
    expect(sectionLabel('CHORUS:')).toBe('Chorus');
    expect(sectionLabel('[Pre-Chorus 2]')).toBe('Pre Chorus 2');
    expect(sectionLabel('(Bridge)')).toBe('Bridge');
    expect(sectionLabel('Strofa 2')).toBe('Verse 2');
    expect(sectionLabel('Refren x2')).toBe('Chorus');
    expect(sectionLabel('Amazing grace how sweet')).toBeNull();
    expect(sectionLabel('Chorus of angels sing')).toBeNull();
  });
});

describe('inferSections with typed names', () => {
  it('takes the name over the guess', () => {
    const out = inferSections('Verse 1\nAmazing grace\n\nBridge\nMy chains are gone\n\nChorus\nSing it');
    expect(out.map(s => s.type)).toEqual(['Verse 1', 'Bridge', 'Chorus']);
    expect(out[0].lines).toEqual(['Amazing grace']);
    expect(out.every(s => s.confident)).toBe(true);
  });

  it('joins a name on its own line to the block below', () => {
    const out = inferSections('Chorus\n\nSing it now\nSing it loud');
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('Chorus');
    expect(out[0].lines).toEqual(['Sing it now', 'Sing it loud']);
  });

  it('splits a block where a name starts mid-way', () => {
    const out = inferSections('Verse 1\nFirst line\nChorus\nSing it');
    expect(out.map(s => s.type)).toEqual(['Verse 1', 'Chorus']);
  });

  it('a bare name again means sing that one again', () => {
    const out = inferSections('Chorus\nSing it\n\nVerse 2\nMore words\n\nChorus');
    expect(out.map(s => s.type)).toEqual(['Chorus', 'Verse 2', 'Chorus']);
    expect(out[2].lines).toEqual(['Sing it']);
  });

  it('numbers plain "Verse" names in order', () => {
    const out = inferSections('Verse\nOne\n\nVerse\nTwo');
    expect(out.map(s => s.type)).toEqual(['Verse 1', 'Verse 2']);
  });
});
