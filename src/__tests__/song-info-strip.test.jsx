// The song's own strip — what it says, and what it deliberately does not.
//
// The decision this pins is a REJECTION. The obvious build was "reuse the Song
// Hub's Details tab", and the owner turned it down (2026-08-21):
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
import SongInfoStrip from '@/features/reader/SongInfoStrip';
import { songInfoFacts } from '@/features/reader/songInfo';

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
  <SongInfoStrip open song={song} displayKey="C" {...props} />
);

describe('the song info strip', () => {
  // ⚠ COMPLEMENT, not summary. The strip carries what the bar has dropped, so
  // on a phone (`showTempoTime` false) it supplies tempo and time, and on a
  // tablet it stays quiet about them because the bar still has them. The first
  // cut printed Key · Capo · Tempo · Time forty pixels under the same four in
  // the bar, which is what "the song panel is ugly" was partly about.
  it('supplies tempo and time when the bar has dropped them', () => {
    open();
    expect(screen.getByText('♩ 118')).toBeTruthy();
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('stays quiet about tempo and time while the bar still shows them', () => {
    const { container } = open({ showTempoTime: true });
    expect(container.textContent).not.toContain('118');
    expect(container.textContent).not.toContain('4/4');
  });

  // Key and capo are NEVER here. The bar carries both at every width and they
  // are its two live controls; repeating them is the duplication above.
  it('never repeats the key or the capo', () => {
    const { container } = open();
    expect(container.textContent).not.toContain('Capo');
    expect(container.textContent).not.toContain('Key');
  });

  it('has nothing to unfold when the bar is already saying it all', () => {
    // A bare song on a wide screen: no history, one arrangement, no notes, not
    // transposed. The caller uses this to keep the title from becoming a
    // button that opens an empty row.
    const bare = { ...song, keyHistory: {} };
    expect(songInfoFacts({ song: bare, displayKey: 'C', showTempoTime: true })).toEqual([]);
    const { container } = render(<SongInfoStrip open song={bare} displayKey="C" showTempoTime />);
    expect(container.textContent).toBe('');
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
      <SongInfoStrip open song={{ ...song, keyHistory: {} }} displayKey="C" />
    );
    expect(container.textContent).not.toContain('Usually played in');
  });

  // ⚠ The song's own key is only worth saying when it is NOT the one you are
  // reading. Otherwise the panel prints "C" twice under two labels and neither
  // one carries information — the same rule the bar's capo chip follows.
  it('names the written key only when you have transposed away from it', () => {
    const same = render(<SongInfoStrip open song={song} displayKey="C" />);
    expect(same.container.textContent).not.toContain('Written in');
    same.unmount();

    open({ displayKey: 'E' });
    expect(screen.getByText('Written in')).toBeTruthy();
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

  it('shows nothing at all when folded', () => {
    const { container } = render(<SongInfoStrip open={false} song={song} displayKey="C" />);
    expect(container.textContent).toBe('');
  });

  // ⚠ NOT A DIALOG. It was one for a round and the owner rejected the whole
  // object: *"I think the song panel is ugly, maybe we can use something else,
  // not necessarily a panel?"* A modal reads as Settings, dims the chart, and
  // adds a surface to a reader that already has too many. It is a row of the
  // sticky chrome now, so it must not carry modal semantics — no role, no
  // scrim, nothing portalled out of the block it belongs to.
  it('is chrome, not a modal', () => {
    const { container, baseElement } = open();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    // Rendered in place. A portal would put it in <body> outside `container`,
    // which is exactly how it would end up floating over the chart again.
    expect(baseElement.textContent).toBe(container.textContent);
  });
});
