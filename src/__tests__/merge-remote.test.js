import { describe, it, expect } from 'vitest';
import { mergeRemoteSong } from '@/sync/mergeRemote';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat, addArrangement } from '@/arrangements';
import { canonicalSongHash } from '@/sync/canonical';

// The merge that adopts a pulled song into the copy a device already holds.
// The invariant that stops the re-upload loop: after adopting the server copy,
// serializing the result must hash to the SERVER's hash — otherwise the next
// push writes the local (stale) values back and the other device does the
// same in reverse (PLAN.md §1.2 #6).

const BASE_MD = `---
title: Domn peste veacuri
artist: Elim Harmony Band
key: A
tempo: 88
time: 4/4
structure: [Verse 1, Chorus 1]
songId: s1
arrangementId: arr_main
arrangementName: Main Arrangement
---

## Verse 1
[A]Domn peste [D]veacuri

## Chorus 1
[E]Slavă
`;

// The same song with the catalogue fields filled in: song-level extended
// metadata, the arrangement-level structure mode, and a key this build does
// not model (carried verbatim as extraFrontmatter).
const META_MD = BASE_MD.replace(
  'time: 4/4\n',
  'time: 4/4\nlanguage: Română\nwriters: Elim Harmony Band\nyear: 2014\nstructureMode: custom\nsomethingNew: kept verbatim\n',
);

const local = (md, extra = {}) => ({ ...songFromFlat({ ...parseSongMd(md), id: 's1' }), ...extra });
const hashOf = (song) => canonicalSongHash(songToMd(song));
const T = 1_700_000_000_000;

describe('mergeRemoteSong', () => {
  it('carries every field the parser produces, and the result hashes like the server copy', () => {
    const mine = local(BASE_MD, { keyHistory: { A: 3 }, tempoHistory: { 88: 2 } });
    const merged = mergeRemoteSong(mine, parseSongMd(META_MD), T);

    expect(merged.id).toBe('s1');
    expect(merged.language).toBe('Română');
    expect(merged.writers).toBe('Elim Harmony Band');
    expect(merged.year).toBe('2014');
    expect(merged.extraFrontmatter).toEqual([['somethingNew', 'kept verbatim']]);
    expect(merged.arrangements).toHaveLength(1);
    expect(merged.arrangements[0].id).toBe('arr_main');
    expect(merged.arrangements[0].structureMode).toBe('custom');
    // Play counts never travel — the local ones survive.
    expect(merged.keyHistory).toEqual({ A: 3 });
    expect(merged.tempoHistory).toEqual({ 88: 2 });
    // Stamped with the server's edit time, not "now".
    expect(merged.updatedAt).toBe(T);
    expect(merged.arrangements[0].updatedAt).toBe(T);
    // The invariant.
    expect(hashOf(merged)).toBe(canonicalSongHash(META_MD));
  });

  it('drops the fields the remote no longer carries (server wins, nothing stale survives)', () => {
    const mine = local(META_MD);
    const merged = mergeRemoteSong(mine, parseSongMd(BASE_MD), T);

    expect(merged.language).toBe('');
    expect(merged.year).toBe('');
    expect(merged.extraFrontmatter).toBeUndefined();
    expect(merged.arrangements[0].structureMode).toBe('auto');
    expect(hashOf(merged)).toBe(canonicalSongHash(BASE_MD));
  });

  it('keeps a local-only second arrangement and the local default', () => {
    const { song: mine, arrangementId: acousticId } = addArrangement(local(BASE_MD), 'Acoustic');
    const merged = mergeRemoteSong(mine, parseSongMd(META_MD), T);

    expect(merged.arrangements.map(a => a.id)).toEqual(['arr_main', acousticId]);
    expect(merged.defaultArrangementId).toBe('arr_main');
    expect(merged.arrangements[0].structureMode).toBe('custom');
    expect(merged.arrangements[1]).toBe(mine.arrangements[1]); // untouched, same reference
    expect(merged.language).toBe('Română');
  });

  it('replaces the matching non-default arrangement and leaves the default alone', () => {
    const { song: mine, arrangementId: acousticId } = addArrangement(local(BASE_MD), 'Acoustic');
    const remoteMd = META_MD.replace('arrangementId: arr_main', `arrangementId: ${acousticId}`);
    const merged = mergeRemoteSong(mine, parseSongMd(remoteMd), T);

    expect(merged.defaultArrangementId).toBe('arr_main');
    expect(merged.arrangements[0]).toBe(mine.arrangements[0]);
    expect(merged.arrangements[1].id).toBe(acousticId);
    expect(merged.arrangements[1].structureMode).toBe('custom');
  });

  it('keeps the local arrangement id when the remote carries none (setlist items keep resolving)', () => {
    const remoteMd = META_MD.replace('songId: s1\narrangementId: arr_main\narrangementName: Main Arrangement\n', '');
    const merged = mergeRemoteSong(local(BASE_MD), parseSongMd(remoteMd), T);

    expect(merged.arrangements[0].id).toBe('arr_main');
    expect(merged.defaultArrangementId).toBe('arr_main');
    expect(merged.language).toBe('Română');
  });

  it('adopts the remote arrangement id over a legacy local one (one-time migration)', () => {
    const mine = local(BASE_MD.replace('arrangementId: arr_main', 'arrangementId: arr_legacy'));
    const merged = mergeRemoteSong(mine, parseSongMd(META_MD), T);

    expect(merged.arrangements.map(a => a.id)).toEqual(['arr_main']);
    expect(merged.defaultArrangementId).toBe('arr_main');
  });

  it('with no local copy it is simply the parsed song', () => {
    const merged = mergeRemoteSong(null, parseSongMd(META_MD), T);
    expect(merged.id).toBe('s1');
    expect(merged.language).toBe('Română');
    expect(merged.updatedAt).toBe(T);
    expect(hashOf(merged)).toBe(canonicalSongHash(META_MD));
  });
});
