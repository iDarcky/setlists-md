// The hub's Details tab, on the two play histories it shows.
//
// ⚠ It deliberately differs from the reader's song panel. That surface is a
// takeover printing the song's own ♩ six lines up, so a single recorded tempo
// equal to it is the same number twice (see `song-info-view.test.jsx`). This
// is the CATALOGUE view — "played 6× at 72" is a fact about the song's life,
// and the tempo it repeats is one the reader is not showing at all.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SongDetails from '@/features/song/SongDetails';

const song = (over = {}) => ({
  id: 's1', title: 'Cel Minunat', artist: 'Test Artist',
  key: 'C', tempo: 118, time: '4/4',
  keyHistory: {}, tempoHistory: {},
  ...over,
});

describe('Details — play histories', () => {
  it('ranks the tempos it has, most played first', () => {
    render(<SongDetails song={song({ tempoHistory: { 72: 2, 76: 5 } })} />);
    expect(screen.getByText('Tempo history')).toBeTruthy();
    const chips = [...document.querySelectorAll('.font-mono')].map(n => n.textContent);
    expect(chips).toEqual(['♩ 76', '♩ 72']);
  });

  it('shows a lone tempo even when it matches the song — this is the catalogue', () => {
    render(<SongDetails song={song({ tempoHistory: { 118: 6 } })} />);
    expect(screen.getByText('♩ 118')).toBeTruthy();
    expect(screen.getByText('6×')).toBeTruthy();
  });

  it('says nothing about a history that does not exist', () => {
    const { container } = render(<SongDetails song={song()} />);
    expect(container.textContent).not.toContain('Tempo history');
    expect(container.textContent).not.toContain('Key history');
  });

  // ⚠ A song with nothing but a tempo history is NOT an empty Details tab.
  // The empty state is computed from a list of every section, and adding a
  // section without adding it to that list is how a panel renders its own
  // "nothing here yet" over content that is right below it.
  it('is not the empty state when a tempo history is all there is', () => {
    // Bare on purpose: no artist, tempo, time or tag, so every OTHER thing the
    // empty check counts is absent and the history is the only content left.
    const { container } = render(
      <SongDetails song={{ id: 's1', title: 'Bare', tempoHistory: { 72: 3 } }} />
    );
    expect(container.textContent).not.toContain('No additional song info yet');
    expect(screen.getByText('Tempo history')).toBeTruthy();
    expect(screen.getByText('♩ 72')).toBeTruthy();
  });
});
