import { describe, it, expect } from 'vitest';
import { fillVerseChords, canFillVerseChords, fillSongVerseChords } from '@/lib/verseChords';

// "Doamne, ai plătit totu-n locul meu" as Melodia prints it: chords on verse 1 only.
const v1 = { type: 'Verse 1', lines: ['[Bb]Isus îmi spune azi:', '„Tu, [F]fiule ești [Bb]slab.', 'La [Gm]Mine vino a[Eb]cum,', 'Eu [F]te voi aju[Bb]ta.”'] };
const chorus = { type: 'Chorus', lines: ['[Bb]Doamne, ai plă[Gm]tit'] };
const v2 = { type: 'Verse 2', lines: ['Isuse, eu acum', 'Cunosc puterea Ta,', 'Ce inima pe veci', 'Mi-o poate transforma.'] };
const v4 = { type: 'Verse 4', lines: ['La tronul Tău ceresc', 'Genunchii-mi voi pleca', 'Și-atunci voi preamări,', 'Isuse, mila Ta.'] };

describe('fillVerseChords', () => {
  it('copies verse 1 onto bare verses, syllable by syllable', () => {
    const out = fillVerseChords([v1, chorus, v2]);
    expect(out[2].lines).toEqual([
      '[Bb]Isuse, eu acum',
      'Cu[F]nosc puterea [Bb]Ta,',
      'Ce [Gm]inima pe [Eb]veci', // silent final "i": the chord goes on "veci", not "ci"
      'Mi-[F]o poate transfor[Bb]ma.',
    ]);
  });

  it('keeps "ch" together and lands the last chord on the last syllable', () => {
    const out = fillVerseChords([v1, v4]);
    expect(out[1].lines[1]).toBe('Ge[F]nunchii-mi voi ple[Bb]ca');
    expect(out[1].lines[2]).toBe('Și-[Gm]atunci voi prea[Eb]mări,');
  });

  it('leaves the source verse, the chorus and chorded verses untouched', () => {
    const own = { type: 'Verse 3', lines: ['[C]Already mine'] };
    const out = fillVerseChords([v1, chorus, own, v2]);
    expect(out[0]).toBe(v1);
    expect(out[1]).toBe(chorus);
    expect(out[2]).toBe(own);
  });

  it('skips cues, tabs and extra lines the source verse has no match for', () => {
    const longer = { type: 'Verse 2', lines: ['> soft', 'Isuse, eu acum', 'a', 'b', 'c', 'One line too many', { type: 'modulate', semitones: 2 }] };
    const out = fillVerseChords([v1, longer]);
    expect(out[1].lines[0]).toBe('> soft');
    expect(out[1].lines[1]).toBe('[Bb]Isuse, eu acum');
    expect(out[1].lines[5]).toBe('One line too many');
    expect(out[1].lines[6]).toEqual({ type: 'modulate', semitones: 2 });
  });

  it('does nothing when there is nothing to copy', () => {
    const bare = [{ type: 'Verse 1', lines: ['a b c'] }, { type: 'Verse 2', lines: ['d e f'] }];
    expect(canFillVerseChords(bare)).toBe(false);
    expect(fillVerseChords(bare)).toBe(bare);
    const done = [v1, { type: 'Verse 2', lines: ['[G]x'] }];
    expect(canFillVerseChords(done)).toBe(false);
  });

  it('works on every arrangement of a song and keeps identity when unchanged', () => {
    const song = { id: 's', arrangements: [{ id: 'a', sections: [v1, v2] }, { id: 'b', sections: [chorus] }] };
    const out = fillSongVerseChords(song);
    expect(out.arrangements[0].sections[1].lines[0]).toBe('[Bb]Isuse, eu acum');
    expect(out.arrangements[1]).toBe(song.arrangements[1]);
    const none = { id: 't', arrangements: [{ id: 'c', sections: [chorus] }] };
    expect(fillSongVerseChords(none)).toBe(none);
  });
});
