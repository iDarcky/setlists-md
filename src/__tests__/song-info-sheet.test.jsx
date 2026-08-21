// The song's own panel — what it says, and what it deliberately does not.
//
// The decision this pins is a REJECTION. The obvious build was "reuse the Song
// Hub's Details tab in a sheet", and the owner turned it down (2026-08-21):
// *"I don't want it to be the same as song details, because there might be too
// many info there that are not relevant in a practice/live scenario."*
//
// That is easy to un-decide by accident — Details is right there, it already
// has every field, and adding "just CCLI" to this panel would look like a
// one-line improvement. So the test states the rule as a rule: the panel
// answers what a musician holding the iPad would ACT on in the next four
// minutes, and cataloguing fields are somebody else's surface.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SongInfoSheet from '@/features/reader/SongInfoSheet';

const song = {
  id: 's1',
  title: 'Cel Minunat, Salvatorul',
  artist: 'Test Artist',
  key: 'C',
  tempo: 118,
  time: '4/4',
  keyHistory: { C: 3, D: 2, G: 1 },
  // Everything below is Details' territory. It rides on the same object
  // because `resolveSongView` carries it; the panel must ignore all of it.
  ccli: '1234567',
  writers: 'Somebody Else',
  publishers: 'A Publisher',
  copyright: '2019',
  album: 'An Album',
  year: '2019',
  themes: 'grace, cross',
};

const open = (props = {}) => render(
  <SongInfoSheet open onClose={() => {}} wide song={song} displayKey="C" {...props} />
);

describe('the song info panel', () => {
  it('answers the four things you act on', () => {
    open({ capo: 2, capoShapeKey: 'Bb' });
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByText('Capo 2')).toBeTruthy();
    expect(screen.getByText('Bb shapes')).toBeTruthy();
    expect(screen.getByText('♩ 118')).toBeTruthy();
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('is NOT Song Details — no cataloguing fields', () => {
    const { container } = open();
    const text = container.textContent;
    for (const stray of ['1234567', 'Somebody Else', 'A Publisher', 'An Album', 'grace, cross']) {
      expect(text).not.toContain(stray);
    }
  });

  it('answers the leader question: what do we usually play this in', () => {
    open();
    // Ranked, and capped at three — a song played in eight keys is a list
    // nobody reads mid-rehearsal, and the tail is noise by definition.
    // Testing Library normalises runs of whitespace, so match on the shape
    // rather than the exact spacing.
    expect(screen.getByText(/C ×3\s+·\s+D ×2\s+·\s+G ×1/)).toBeTruthy();
  });

  it('says nothing about a history that does not exist', () => {
    const { container } = render(
      <SongInfoSheet open onClose={() => {}} wide song={{ ...song, keyHistory: {} }} displayKey="C" />
    );
    expect(container.textContent).not.toContain('Usually played in');
  });

  // ⚠ The song's own key is only worth saying when it is NOT the one you are
  // reading. Otherwise the panel prints "C" twice under two labels and neither
  // one carries information — the same rule the bar's capo chip follows.
  it('names the written key only when you have transposed away from it', () => {
    const same = render(<SongInfoSheet open onClose={() => {}} wide song={song} displayKey="C" />);
    expect(same.container.textContent).not.toContain('written in');
    same.unmount();

    open({ displayKey: 'E' });
    expect(screen.getByText('written in C')).toBeTruthy();
  });

  // ⚠ "Main Arrangement" on a song that has exactly one arrangement is a row
  // that answers a question nobody asked. The caller decides; this pins that
  // the panel draws nothing when it is not told.
  it('names the arrangement only when told to', () => {
    const { container, unmount } = open();
    expect(container.textContent).not.toContain('Arrangement');
    unmount();
    open({ arrangementName: 'Acoustic' });
    expect(screen.getByText('Acoustic')).toBeTruthy();
  });

  it('shows nothing at all when closed', () => {
    const { container } = render(
      <SongInfoSheet open={false} onClose={() => {}} wide song={song} displayKey="C" />
    );
    expect(container.textContent).toBe('');
  });
});
