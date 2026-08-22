// Element 8, end to end: a `.md` file with a key-change overlay, rendered.
//
// The unit tests next door prove the arithmetic. This proves the wiring — the
// four places the overlay has to reach before it means anything on screen:
// the parser, the arrangement schema, the chart's chords, and the repeat logic.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'church' }),
}));

const MD = `---
title: Element 8
artist: Test
key: C
structure: [Chorus, Verse 2, Chorus]
keyChanges: [2:0:+2]
---

## Chorus
[C]Chorus line [F]here [G]now

## Verse 2
[Am]Verse two [F]line [C]here
`;

const songOf = (md) => {
  const flat = parseSongMd(md);
  return { ...songFromFlat({ ...flat, id: 'e8' }), id: 'e8' };
};

const chordsIn = (slot) => {
  const sec = document.querySelector(`[data-section-index="${slot}"]`);
  return [...sec.querySelectorAll('span')]
    .map(s => s.textContent)
    .filter(t => /^[A-G][b#]?m?$/.test(t));
};

describe('a key change anchored to a slot', () => {
  // ⚠ THE CASE `READER.md` CALLED UNREPRESENTABLE. With `{modulate}` in the
  // section body it genuinely was: both choruses are the same object, so `once`
  // gives C then C and `every` climbs Verse 2 as well. One overlay entry says
  // it, because the anchor names an OCCURRENCE.
  it('lifts the second chorus and leaves the first one alone', () => {
    render(<Reader song={songOf(MD)} settings={{ defaultColumns: 1 }} mode="practice" />);
    expect(chordsIn(0)).toEqual(['C', 'F', 'G']);
    // Verse 2 sits before the change, so it is untouched — the thing `every`
    // could never avoid doing.
    expect(chordsIn(1)).toEqual(['Am', 'F', 'C']);
    expect(chordsIn(2)).toEqual(['D', 'G', 'A']);
  });

  it('announces the arrival key where it happens', () => {
    render(<Reader song={songOf(MD)} settings={{ defaultColumns: 1 }} mode="practice" />);
    const chip = screen.getByText('key change');
    // Drawn inside the slot it belongs to, not floating between sections.
    expect(chip.closest('[data-section-index]').dataset.sectionIndex).toBe('2');
  });

  // ⚠ Repeat detection reads the OVERLAY's offsets. Left reading
  // `buildSongFlow`'s own, the second chorus would collapse into a `×2` pill
  // announcing a repeat that is actually a step higher — the bug that hides
  // exactly the case this feature exists for.
  it('does not collapse a repeat that changed key', () => {
    const { container } = render(
      <Reader song={songOf(MD)} settings={{ defaultColumns: 1, duplicateSections: 'condensed' }} mode="practice" />
    );
    expect(container.querySelectorAll('[data-section-index]').length).toBe(3);
    // `↩` is the collapsed-repeat tag. (Not `×2` — that is the label for a run
    // of ADJACENT repeats, and these two choruses have a verse between them.)
    expect(container.textContent).not.toContain('↩');
  });

  it('still collapses a repeat that did not', () => {
    const { container } = render(
      <Reader song={songOf(MD.replace(/keyChanges:.*\n/, ''))}
        settings={{ defaultColumns: 1, duplicateSections: 'condensed' }} mode="practice" />
    );
    expect(container.textContent).toContain('↩');
  });
});

describe('the overlay survives the file', () => {
  it('round-trips through the .md and back', () => {
    const song = songOf(MD);
    const view = song.arrangements[0];
    expect(view.keyChanges).toEqual([{ slot: 2, line: 0, semitones: 2 }]);
    const out = songToMd({ ...view, title: song.title, artist: song.artist });
    expect(out).toContain('keyChanges: [2:0:+2]');
    expect(parseSongMd(out).keyChanges).toEqual(view.keyChanges);
  });

  it('emits nothing for a song that has none', () => {
    const plain = parseSongMd(MD.replace(/keyChanges:.*\n/, ''));
    expect(songToMd(plain)).not.toContain('keyChanges');
  });
});

describe('a song that still uses {modulate}', () => {
  const LEGACY = `---
title: Legacy
key: C
structure: [Chorus, Chorus]
---

## Chorus
{modulate: +2, every}
[C]one [F]two
`;

  // Read as an overlay at load time, so nothing needs migrating — and the
  // climbing chorus still climbs.
  it('reads its markers as an overlay and keeps climbing', () => {
    render(<Reader song={songOf(LEGACY)} settings={{ defaultColumns: 1 }} mode="practice" />);
    expect(chordsIn(0)).toEqual(['D', 'G']);
    expect(chordsIn(1)).toEqual(['E', 'A']);
  });

  // ⚠ A song mid-conversion carries BOTH. The overlay wins outright rather than
  // merging, or the same change is counted twice and drawn twice.
  it('is silent about its markers once an overlay exists', () => {
    const both = LEGACY.replace('structure: [Chorus, Chorus]',
      'structure: [Chorus, Chorus]\nkeyChanges: [1:0:+1]');
    const { container } = render(
      <Reader song={songOf(both)} settings={{ defaultColumns: 1 }} mode="practice" />
    );
    expect(container.querySelectorAll('[data-section-index]').length).toBe(2);
    // One chip, from the overlay — not one from each source.
    expect(screen.getAllByText('key change').length).toBe(1);
    expect(chordsIn(0)).toEqual(['C', 'F']);
    expect(chordsIn(1)).toEqual(['Db', 'Gb']);
  });
});
