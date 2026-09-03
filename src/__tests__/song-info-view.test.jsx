// The song's own surface — what it says, what it deliberately does not, and
// the two shapes it takes.
//
// ⚠ This file replaced a set of tests for a COMPLEMENTARY STRIP that lived in
// the reader's chrome and carefully avoided repeating whatever the top bar was
// already showing. That component is gone: the owner rejected the shape twice
// (a modal — *"I think the song panel is ugly"* — and then the row — *"I don't
// know if I like the row"*) and picked a takeover from ten mockups. A surface
// you summon and dismiss has no reason to dodge the bar, so "never repeats the
// key" stopped being true on purpose. The rule that SURVIVED both rewrites is
// the one below about cataloguing fields, which is why it is the longest note
// here.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SongInfoView from '@/features/reader/SongInfoView';
import { songInfoFacts } from '@/features/reader/songInfo';

const song = {
  id: 's1',
  title: 'Cel Minunat, Salvatorul',
  artist: 'Test Artist',
  key: 'C',
  tempo: 118,
  time: '4/4',
  keyHistory: { C: 3, D: 2, G: 1 },
  scripture: 'Isaiah 9:6',
  story: 'Written after a funeral in 2019.',
  // Everything below is the hub's territory. It rides on the same object
  // because `resolveSongView` carries it; this surface must ignore all of it.
  ccli: '1234567',
  writers: 'Somebody Else',
  publishers: 'A Publisher',
  copyright: '2019',
  album: 'An Album',
  year: '2019',
  themes: 'grace, cross',
};

const open = (props = {}) => render(
  <SongInfoView open onClose={() => {}} song={song} displayKey="C" {...props} />
);

describe('what it says', () => {
  it('leads with the key, and puts the rest under it', () => {
    open({ capo: 2, capoShapeKey: 'Bb' });
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('capo 2 · Bb')).toBeTruthy();
    expect(screen.getByText('♩ 118')).toBeTruthy();
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('answers the leader question: what do we usually play this in', () => {
    open();
    // Ranked, capped at three — a song played in eight keys is a list nobody
    // reads mid-rehearsal, and the tail is noise by definition.
    expect(screen.getByText(/C ×3\s+·\s+D ×2\s+·\s+G ×1/)).toBeTruthy();
  });

  it('says nothing about a history that does not exist', () => {
    const { container } = render(
      <SongInfoView open onClose={() => {}} song={{ ...song, keyHistory: {} }} displayKey="C" />
    );
    expect(container.textContent).not.toContain('Usually played in');
  });

  // ⚠ THE RULE THAT SURVIVED EVERY REWRITE. The owner turned down reusing the
  // Song Hub's Details tab because it carries *"too many info there that are
  // not relevant in a practice/live scenario"*. The line, asked and answered:
  // **a field belongs here if it changes how you PLAY the song in the next four
  // minutes.** Scripture and story pass — a leader reads them to set the
  // intent. CCLI, publishers, copyright, album, year and themes never do.
  //
  // This is easy to un-decide by accident, because every one of those fields is
  // already on the object and adding "just CCLI" looks like a one-line
  // improvement. The test states the rule as a rule.
  it('carries scripture and story — the two that change how you play it', () => {
    open();
    expect(screen.getByText('Scripture')).toBeTruthy();
    expect(screen.getByText('Isaiah 9:6')).toBeTruthy();
    expect(screen.getByText('Story')).toBeTruthy();
  });

  it('carries none of the cataloguing fields', () => {
    const { container } = open();
    for (const stray of ['1234567', 'Somebody Else', 'A Publisher', 'An Album', 'grace, cross']) {
      expect(container.textContent).not.toContain(stray);
    }
  });

  // ⚠ The song's own key is only worth saying when it is NOT the one you are
  // reading. Otherwise it prints "C" twice under two labels and neither one
  // carries information — the same rule the bar's capo chip follows.
  it('names the written key only when you have transposed away from it', () => {
    const same = render(<SongInfoView open onClose={() => {}} song={song} displayKey="C" />);
    expect(same.container.textContent).not.toContain('written in');
    same.unmount();
    open({ displayKey: 'E' });
    expect(screen.getByText('written in C')).toBeTruthy();
  });

  // ⚠ VIEW ONLY (owner: *"This one should be view only and look cool"*). The
  // key and the capo stay the top bar's controls; this says what they are.
  // The close button is the one exception, and on the phone even that is the
  // whole surface rather than a control.
  it('writes nothing — the only button is the wide shape\'s close', () => {
    const { container, unmount } = open({ wide: true });
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Close song info']);
    unmount();
    const phone = open();
    expect(phone.container.querySelectorAll('button').length).toBe(0);
  });
});

describe('two shapes, because a phone and an iPad have different problems', () => {
  // 390 points cannot be shared, so the phone gets the whole screen — the only
  // shape where the story and the notes get read rather than glimpsed.
  it('takes over on a phone', () => {
    const { container } = open();
    const el = container.querySelector('[role="dialog"]');
    expect(el).toBeTruthy();
    expect(el.className).toContain('absolute');
    expect(el.className).toContain('inset-0');
    expect(screen.getByText('tap anywhere to go back')).toBeTruthy();
  });

  // ⚠ `absolute`, not `fixed`. It covers the READER, not the viewport — the
  // reader's root is `relative` for exactly this. Anchored to the viewport it
  // would sit over the app's own chrome wherever the reader is embedded rather
  // than filling the screen.
  it('covers the reader and not the viewport', () => {
    const { container } = open();
    expect(container.querySelector('[role="dialog"]').className).not.toContain('fixed');
  });

  // On wide it is a COLUMN beside the chart (owner: *"let's do the rail, but
  // let's keep the cool part"*), so it must NOT carry modal semantics — an
  // aside that announces itself as a dialog is a screen reader being told the
  // chart beside it is inert.
  it('is a column on a wide screen, not a dialog', () => {
    const { container } = open({ wide: true });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    expect(aside.className).toContain('shrink-0');
    expect(container.textContent).not.toContain('tap anywhere');
  });

  it('shows nothing at all when closed', () => {
    const { container } = render(
      <SongInfoView open={false} onClose={() => {}} song={song} displayKey="C" />
    );
    expect(container.textContent).toBe('');
  });
});

// The caller uses this to decide whether the TITLE is a control at all — a
// title styled as a button that opens an empty surface is READER.md's trap 23
// with extra steps.
describe('whether there is anything to open', () => {
  it('counts the story and the scripture, not just the numbers', () => {
    const bare = { key: 'C', keyHistory: {} };
    expect(songInfoFacts({ song: bare, displayKey: 'C', showTempoTime: true })).toEqual([]);
    expect(songInfoFacts({ song: { ...bare, story: 'x' }, displayKey: 'C', showTempoTime: true }).length).toBe(1);
    expect(songInfoFacts({ song: { ...bare, scripture: 'John 1' }, displayKey: 'C', showTempoTime: true }).length).toBe(1);
  });
});
