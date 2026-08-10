// Element 19 — the capo.
//
// The thing these tests are really guarding is WHOSE the number is. A capo on a
// song or on a setlist item changes what every other player reads, which is
// what the old shared `items[i].capo` did; this one lives in the user's own
// settings and the suite asserts it stays there.
import { describe, it, expect } from 'vitest';
import { capoFor, withCapo, shapeKeyFor, suggestCapo, MAX_CAPO } from '@/lib/capo';
import { PORTABLE_PREF_KEYS } from '@/app/usePreferenceSync';

describe('what a capo does to the chart', () => {
  it('names the shapes you finger, not the key you sound', () => {
    // The band is in A; you put a capo on 2; you play G shapes.
    expect(shapeKeyFor('A', 2)).toBe('G');
    expect(shapeKeyFor('Bb', 3)).toBe('G');
    expect(shapeKeyFor('E', 4)).toBe('C');
  });

  it('moves pitch, not mode', () => {
    // A capo is a nut, not a modulation — a minor key stays minor.
    expect(shapeKeyFor('Am', 2)).toBe('Gm');
    expect(shapeKeyFor('Bbm', 1)).toBe('Am');
  });

  it('is a no-op at zero, and on a song with no key', () => {
    expect(shapeKeyFor('A', 0)).toBe('A');
    expect(shapeKeyFor(null, 3)).toBe(null);
  });
});

describe('the suggestion', () => {
  it('offers the smallest fret that lands on an open shape', () => {
    expect(suggestCapo('A')).toBeNull();          // A is already open
    expect(suggestCapo('Bb')).toEqual({ capo: 1, shapeKey: 'A' });
    expect(suggestCapo('F')).toEqual({ capo: 1, shapeKey: 'E' });
    expect(suggestCapo('Eb')).toEqual({ capo: 1, shapeKey: 'D' });
  });

  it('says nothing when the key is already an easy one', () => {
    for (const k of ['G', 'C', 'D', 'A', 'E']) expect(suggestCapo(k)).toBeNull();
  });

  it('follows the ROOT, so a minor key gets its relative shape family', () => {
    // Am fingers like A — the family is about the fingering, the quality rides
    // along. Suggesting a different capo for Am than for A would be wrong.
    expect(suggestCapo('Am')).toBeNull();
    expect(suggestCapo('Bbm')).toEqual({ capo: 1, shapeKey: 'Am' });
  });

  it('never suggests past the usable neck', () => {
    for (const k of ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab']) {
      const s = suggestCapo(k);
      if (s) expect(s.capo).toBeLessThanOrEqual(MAX_CAPO);
    }
  });
});

describe('where the number lives', () => {
  it('reads this user\'s capo for this song', () => {
    expect(capoFor({ songCapos: { s1: 2 } }, 's1')).toBe(2);
    expect(capoFor({ songCapos: { s1: 2 } }, 's2')).toBe(0);
    expect(capoFor({}, 's1')).toBe(0);
    expect(capoFor(undefined, 's1')).toBe(0);
  });

  it('ignores a stored value outside the neck', () => {
    expect(capoFor({ songCapos: { s1: 99 } }, 's1')).toBe(0);
    expect(capoFor({ songCapos: { s1: -3 } }, 's1')).toBe(0);
  });

  it('clears by REMOVING the key, not by storing a zero', () => {
    // The map is synced to the account; 108 songs each carrying an explicit 0
    // is 108 entries saying nothing.
    const set = withCapo({ songCapos: { a: 1, b: 2 } }, 'a', 0);
    expect(set).toEqual({ b: 2 });
    expect('a' in set).toBe(false);
  });

  it('clamps what it stores', () => {
    expect(withCapo({}, 's', 99)).toEqual({ s: MAX_CAPO });
    expect(withCapo({}, 's', 2.4)).toEqual({ s: 2 });
  });

  it('never mutates the settings it was handed', () => {
    const before = { songCapos: { a: 1 } };
    withCapo(before, 'b', 3);
    expect(before.songCapos).toEqual({ a: 1 });
  });

  it('follows the account', () => {
    // Element 5 found three switches that were read but never written, or
    // written but never read. A portable preference has a third failure mode:
    // it works perfectly on the device you set it on and silently does not
    // follow you, which is indistinguishable from having forgotten to set it.
    expect(PORTABLE_PREF_KEYS).toContain('songCapos');
  });
});

describe('a capo is never the band\'s', () => {
  it('writes nothing but the settings map', async () => {
    const raw = await import('node:fs').then(fs =>
      fs.readFileSync('src/lib/capo.js', 'utf8'));
    // Comments stripped — the file DESCRIBES the shared `items[i].capo` it
    // replaces, and describing the old bug is not committing it.
    const src = raw.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    // The whole point. If this module ever learns to write a song or a setlist
    // item, one guitarist's capo starts rewriting the bass player's chart —
    // which is exactly the bug this replaces.
    expect(src).not.toMatch(/items?\[/);
    expect(src).not.toContain('.capo =');
    expect(src).not.toContain('onUpdateSong');
    expect(src).not.toContain('onUpdateSetlist');
  });
});
