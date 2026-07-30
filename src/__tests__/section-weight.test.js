// Which sections a song leans on. This drives element 3's "a chorus is clearly
// heavier than a verse" (extra air above it) and the chorus indent.
//
// It was broken from the day it shipped and nothing caught it: the HEAVY set
// was capitalised while `normalizeSectionName` lowercases, so `sectionWeight`
// never once returned 'hi'. Both features silently did nothing.
import { describe, it, expect } from 'vitest';
import { sectionWeight } from '@/lib/songFlow';

describe('sectionWeight', () => {
  it('is hi for the sections a song leans on', () => {
    expect(sectionWeight('Chorus')).toBe('hi');
    expect(sectionWeight('Refrain')).toBe('hi');
    expect(sectionWeight('Bridge')).toBe('hi');
  });

  it('matches whatever case the chart was written in', () => {
    // The regression: HEAVY held 'Chorus' but the lookup was 'chorus'.
    expect(sectionWeight('chorus')).toBe('hi');
    expect(sectionWeight('CHORUS')).toBe('hi');
    expect(sectionWeight('Chorus:')).toBe('hi');
  });

  it('matches NUMBERED sections — real charts write "Bridge 1"', () => {
    expect(sectionWeight('Chorus 1')).toBe('hi');
    expect(sectionWeight('Chorus 2')).toBe('hi');
    expect(sectionWeight('Bridge 1')).toBe('hi');
  });

  it('is base for everything else', () => {
    expect(sectionWeight('Verse 1')).toBe('base');
    expect(sectionWeight('Intro')).toBe('base');
    expect(sectionWeight('Outro 1')).toBe('base');
    expect(sectionWeight('Pre-Chorus')).toBe('base');   // its own thing, not a chorus
    expect(sectionWeight('')).toBe('base');
    expect(sectionWeight(undefined)).toBe('base');
  });
});
