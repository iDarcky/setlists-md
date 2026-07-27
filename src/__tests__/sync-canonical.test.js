import { describe, it, expect } from 'vitest';
import { cyrb53, canonicalSongHash, canonicalSetlistHash, stableStringify } from '@/sync/canonical';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat } from '@/arrangements';

// A corpus of real-world-ish songs covering the features that have historically
// caused serialization drift: custom frontmatter, repeated structure, tabs,
// modulate markers, no-chord sections, and diacritics.
const CORPUS = {
  customFrontmatter: `---
title: Tu ești sfânt (Pe Tine, Doamne, Te laudam)
artist: Hillsong
key: C
tempo: 154
time: 4/4
language: God is Great
writers: Marty Sampson
year: 2001
structure: [Verse 1, Verse 2, Chorus 1, Verse 3, Chorus 1, Bridge 1, Bridge 1, Chorus 1, Chorus 1]
songId: mq9c63c4qk4sbd
arrangementId: arr_mq9c63c4u0mkzj
arrangementName: Main Arrangement
---

## Verse 1
[C]Pe Tine, D[F]oamne, Te lăud[G]ăm,
[C]Ne-nchinăm în d[F]uh și-n adev[G]ăr.

## Chorus 1
Tu ești s[C]fânt, Tu ești [Am]drept

## Verse 3
Pe Tine, Doamne, Te iubim.

## Bridge 1
[C]Sfânt e [F]Dumne[G]zeu,
`,
  withTabAndModulate: `---
title: Tab + Modulate
artist: Test
key: G
---

## Intro
{tab, time: 4/4}
e|--0--2--3--|
B|--1--3--5--|
G|--0--2--4--|
D|-----------|
A|--3--------|
E|-----------|
{/tab}

## Verse 1
[G]Plain [C]words and [D]chords
{modulate: +2}
[A]After the key change
`,
  minimal: `---
title: Minimal
key: A
---

## Verse 1
Just lyrics, no chords
`,
};

describe('cyrb53', () => {
  it('is deterministic and distinguishes inputs', () => {
    expect(cyrb53('hello')).toBe(cyrb53('hello'));
    expect(cyrb53('hello')).not.toBe(cyrb53('hellp'));
    expect(typeof cyrb53('x')).toBe('string');
  });
});

describe('canonicalSongHash — cosmetic differences collapse', () => {
  const vA = `---
title: Test Song
artist: Hillsong
key: C
tempo: 154
capo: 0
language: God is Great
---

## Verse 1
[C]Line one
`;
  // Same song as two different app versions might serialize it: frontmatter
  // reordered, missing space after a colon, capo omitted (defaults to 0),
  // trailing whitespace on a lyric line.
  const vB = `---
artist: Hillsong
title: Test Song
language: God is Great
tempo:154
key: C
---

## Verse 1
[C]Line one
`;

  it('two serializations of the same song hash identically', () => {
    expect(canonicalSongHash(vA)).toBe(canonicalSongHash(vB));
  });

  it('a genuine content change hashes differently', () => {
    const vC = vA.replace('Line one', 'Line TWO');
    expect(canonicalSongHash(vA)).not.toBe(canonicalSongHash(vC));
  });
});

describe('canonicalSetlistHash', () => {
  it('is independent of object key order (JSONB reordering)', () => {
    const s1 = { id: 'x', name: 'Set', date: '2026-06-14', items: [{ songId: 'a', note: '' }] };
    const s2 = { items: [{ note: '', songId: 'a' }], date: '2026-06-14', name: 'Set', id: 'x' };
    expect(canonicalSetlistHash(s1)).toBe(canonicalSetlistHash(s2));
  });
  it('accepts a JSON string and matches the equivalent object', () => {
    const obj = { id: 'x', name: 'Set', items: [] };
    expect(canonicalSetlistHash(JSON.stringify(obj))).toBe(canonicalSetlistHash(obj));
  });
});

// Regression lock: if a future change to songToMd reintroduces drift, these
// fail in CI before they can ship and spam the activity feed.
describe('serialization stability (round-trip corpus)', () => {
  for (const [name, md] of Object.entries(CORPUS)) {
    it(`${name}: songToMd∘parse is idempotent`, () => {
      const once = songToMd(songFromFlat({ ...parseSongMd(md), id: parseSongMd(md).id || 'x' }));
      const twice = songToMd(songFromFlat({ ...parseSongMd(once), id: parseSongMd(once).id || 'x' }));
      expect(twice).toBe(once);
    });

    it(`${name}: canonical hash is steady-state stable (no per-sync drift)`, () => {
      // Once through the pipeline mints any missing ids (a legitimate one-time
      // event); from there every subsequent sync must produce the SAME hash, or
      // the song would re-upload forever.
      const once = songToMd(songFromFlat({ ...parseSongMd(md), id: parseSongMd(md).id || 'x' }));
      const twice = songToMd(songFromFlat({ ...parseSongMd(once), id: parseSongMd(once).id || 'x' }));
      expect(canonicalSongHash(twice)).toBe(canonicalSongHash(once));
    });
  }
});

describe('stableStringify (re-exported)', () => {
  it('sorts keys and drops undefined', () => {
    expect(stableStringify({ b: 1, a: undefined, c: 2 })).toBe('{"b":1,"c":2}');
  });
});
