import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  parseChangelog, isShownRelease, baseVersion, currentIndex, capSections,
  bulletCount, inlineSegments, sectionLabel,
} from '@/lib/changelog';

const SAMPLE = `# Release Notes

Intro line.

## 1.2.0 — Big one
*March 2027*

### Added
- **One** — first
- Two
  wrapped onto a second line

### Fixed
- Three

## 1.1.0 — Small
*February 2027*

### Improved
- Four

## 0.1.0-pre-alpha — Ancient
*May 2026*

### Added
- Old
`;

describe('parseChangelog', () => {
  const rs = parseChangelog(SAMPLE);
  it('reads every release with title, date and sections', () => {
    expect(rs.map((r) => r.version)).toEqual(['1.2.0', '1.1.0', '0.1.0-pre-alpha']);
    expect(rs[0].title).toBe('Big one');
    expect(rs[0].date).toBe('March 2027');
    expect(rs[0].sections.map((s) => s.name)).toEqual(['Added', 'Fixed']);
  });
  it('joins a wrapped bullet onto the one before', () => {
    expect(rs[0].sections[0].items[1]).toBe('Two wrapped onto a second line');
  });
  it('skips the page intro', () => {
    expect(JSON.stringify(rs)).not.toContain('Intro line');
  });
  it('parses the real changelog, newest first, every release dated', () => {
    const raw = fs.readFileSync(new URL('../data/changelog.md', import.meta.url), 'utf8');
    const real = parseChangelog(raw).filter(isShownRelease);
    expect(real.length).toBeGreaterThan(5);
    for (const r of real) {
      expect(r.title).not.toBe('');
      expect(r.date).toMatch(/\d{4}/);
      expect(bulletCount(r)).toBeGreaterThan(0);
    }
  });
});

describe('what the page shows', () => {
  const rs = parseChangelog(SAMPLE);
  it('hides pre-alpha releases', () => {
    expect(rs.filter(isShownRelease).map((r) => r.version)).toEqual(['1.2.0', '1.1.0']);
  });
  it('matches a beta build to its release, else the newest', () => {
    expect(baseVersion('1.1.0-beta.4')).toBe('1.1.0');
    expect(currentIndex(rs, '1.1.0-beta.4')).toBe(1);
    expect(currentIndex(rs, '9.9.9')).toBe(0);
  });
  it('caps bullets across sections and drops empty sections', () => {
    const capped = capSections(rs[0], 2);
    expect(capped.map((s) => s.items.length)).toEqual([2]);
    expect(capSections(rs[0], 8)).toBe(rs[0].sections);
  });
  it('labels sections in plain words', () => {
    expect(sectionLabel('Added')).toBe('New');
    expect(sectionLabel('Improved')).toBe('Better');
  });
});

describe('inlineSegments', () => {
  it('splits bold, code and links', () => {
    expect(inlineSegments('**A** — b `c` [d](https://e.f)')).toEqual([
      { type: 'bold', text: 'A' },
      { type: 'text', text: ' — b ' },
      { type: 'code', text: 'c' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'd', href: 'https://e.f' },
    ]);
  });
  it('leaves snake_case words alone', () => {
    expect(inlineSegments('team_songs and x')).toEqual([{ type: 'text', text: 'team_songs and x' }]);
  });
});
