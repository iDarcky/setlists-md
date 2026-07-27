import { describe, it, expect } from 'vitest';
import { slugify } from '@/setlist-io';

describe('slugify', () => {
  it('lowercases ASCII titles', () => {
    expect(slugify('Amazing Grace')).toBe('amazing-grace');
  });

  it('converts spaces to hyphens', () => {
    expect(slugify('How Great Is Our God')).toBe('how-great-is-our-god');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('Too  Many   Spaces')).toBe('too-many-spaces');
  });

  it('strips OS-illegal characters (< > : " / \\ | ? *)', () => {
    expect(slugify('A/B:C')).toBe('abc');
    expect(slugify('My "Song"')).toBe('my-song');
    expect(slugify('File|Name?')).toBe('filename');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('-Leading Hyphen-')).toBe('leading-hyphen');
  });

  it('strips leading and trailing dots', () => {
    expect(slugify('.hidden')).toBe('hidden');
  });

  it('preserves Unicode letters (non-ASCII titles)', () => {
    const result = slugify('Înțelept');
    expect(result).toContain('înțelept');
    expect(result).not.toBe('untitled');
  });

  it('preserves accented Latin characters', () => {
    expect(slugify('Álabe')).toBe('álabe');
  });

  it('returns "untitled" for null', () => {
    expect(slugify(null)).toBe('untitled');
  });

  it('returns "untitled" for undefined', () => {
    expect(slugify(undefined)).toBe('untitled');
  });

  it('returns "untitled" for empty string', () => {
    expect(slugify('')).toBe('untitled');
  });

  it('returns "untitled" when the title consists entirely of illegal characters', () => {
    expect(slugify('///?')).toBe('untitled');
  });

  it('handles numeric titles', () => {
    expect(slugify('10000 Reasons')).toBe('10000-reasons');
  });

  it('does not produce consecutive hyphens', () => {
    const result = slugify('One  -  Two');
    expect(result).not.toMatch(/--/);
  });
});
