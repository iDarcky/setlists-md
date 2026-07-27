import { describe, it, expect } from 'vitest';
import {
  songToMd,
  splitMd,
  parseSongMd,
  parseFrontmatterFields,
  serializeFrontmatterFields,
} from '../parser';

// The chart canvas (ArrangeTabV2) owns the body and the play order, nothing
// else. It used to emit songToMd(song) wholesale — and because parseSongMd
// defaults a blank title to "Untitled" and a blank key to "C", simply
// reordering the play order stamped both onto a song the user hadn't named.
// This is that round trip, isolated.
function emitPreservingFrontmatter(md, updatedSong) {
  const generated = songToMd(updatedSong);
  const { body } = splitMd(generated);
  const genFm = parseFrontmatterFields(splitMd(generated).frontmatter);
  const curFm = parseFrontmatterFields(splitMd(md).frontmatter);
  const fm = serializeFrontmatterFields({
    ...curFm,
    structure: genFm.structure,
    structuremode: genFm.structuremode,
  });
  return fm ? `---\n${fm}\n---\n${body}` : body;
}

const BLANK = `---
title:
artist:
key:
---

## Verse 1
Some words
`;

describe('canvas edits and the frontmatter', () => {
  it('does NOT invent a title or key on a blank song', () => {
    const song = parseSongMd(BLANK);
    // What parseSongMd hands the canvas already carries the defaults…
    expect(song.title).toBe('Untitled');
    expect(song.key).toBe('C');

    // …but they must not be written back out.
    const next = emitPreservingFrontmatter(BLANK, { ...song, structure: ['Verse 1'] });
    const fm = parseFrontmatterFields(splitMd(next).frontmatter);
    expect(fm.title).toBe('');
    expect(fm.key).toBe('');
  });

  it('shows what the old behaviour did, so the regression is legible', () => {
    const song = parseSongMd(BLANK);
    const naive = songToMd({ ...song, structure: ['Verse 1'] });
    const fm = parseFrontmatterFields(splitMd(naive).frontmatter);
    expect(fm.title).toBe('Untitled');
    expect(fm.key).toBe('C');
  });

  it('keeps a title and key the user really did set', () => {
    const md = BLANK.replace('title:', 'title: La Crucea Ta').replace('key:', 'key: D');
    const song = parseSongMd(md);
    const next = emitPreservingFrontmatter(md, { ...song, structure: ['Verse 1'] });
    const fm = parseFrontmatterFields(splitMd(next).frontmatter);
    expect(fm.title).toBe('La Crucea Ta');
    expect(fm.key).toBe('D');
  });

  it('still records the play order the canvas changed', () => {
    const song = parseSongMd(BLANK);
    const next = emitPreservingFrontmatter(BLANK, {
      ...song,
      structureMode: 'custom',
      structure: ['Verse 1', 'Chorus', 'Verse 1'],
    });
    const fm = parseFrontmatterFields(splitMd(next).frontmatter);
    expect(fm.structure).toBe('Verse 1, Chorus, Verse 1');
  });

  it('leaves every other detail the user typed alone', () => {
    const md = `---
title: Song
key: G
capo: 2
ccli: "1234567"
tags: [worship, fast]
---

## Verse 1
Words
`;
    const song = parseSongMd(md);
    const next = emitPreservingFrontmatter(md, { ...song, structure: ['Verse 1'] });
    const fm = parseFrontmatterFields(splitMd(next).frontmatter);
    expect(fm.capo).toBe('2');
    expect(fm.ccli).toBe('1234567');
    expect(fm.tags).toBe('worship, fast');
  });

  it('keeps the body the canvas produced', () => {
    const song = parseSongMd(BLANK);
    const next = emitPreservingFrontmatter(BLANK, song);
    expect(splitMd(next).body).toContain('## Verse 1');
    expect(splitMd(next).body).toContain('Some words');
  });
});
