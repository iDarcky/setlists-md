// Element 14 — a setlist item whose song isn't here, and getting it back.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SetlistReader from '@/features/reader/SetlistReader';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const deleted = songFromFlat({
  id: 'gone', title: 'Cornerstone', key: 'C',
  sections: [{ type: 'Verse 1', lines: ['[C]a'] }],
});
const present = songFromFlat({
  id: 's2', title: 'Goodness of God', key: 'A',
  sections: [{ type: 'Verse 1', lines: ['[A]b'] }],
});

// The item still carries the id of the song that was deleted — that id is the
// entire recovery path, so the fixture keeps it.
const setlist = {
  id: 'sl1',
  items: [{ songId: 'gone', songTitle: 'Cornerstone' }, { songId: 's2' }],
};

const renderIt = (props = {}) => render(
  <SetlistReader
    setlist={setlist}
    songs={[present]}
    settings={{}}
    onBack={() => {}}
    onFinish={() => {}}
    {...props}
  />,
);

describe('element 14 — the song is not here', () => {
  it('names the missing song rather than announcing a generic failure', () => {
    renderIt();
    // The title comes from the SETLIST ITEM. "Song not available" tells you
    // nothing; the name tells you whether it matters.
    expect(screen.getAllByText(/Cornerstone/).length).toBeGreaterThan(0);
  });

  it('does not read as a break', () => {
    renderIt();
    // The old behaviour routed this through BreakScreen, so a deleted song and
    // a scheduled pause drew the same screen.
    expect(screen.queryByText('Break')).toBeNull();
  });

  it('offers Restore when the song is still in the 30-day trash', () => {
    const onRestoreSong = vi.fn();
    renderIt({ trash: [{ song: deleted, deletedAt: Date.now() }], onRestoreSong });

    fireEvent.click(screen.getByText('Restore this song'));
    expect(onRestoreSong).toHaveBeenCalledWith('gone');
  });

  it('does not offer Restore when the bin has nothing to give back', () => {
    renderIt({ trash: [], onRestoreSong: vi.fn() });
    expect(screen.queryByText('Restore this song')).toBeNull();
  });

  it('does not offer Restore to a member who cannot write to the library', () => {
    // App passes `onRestoreSong = null` in a read-only team library. Without
    // this guard the button would appear and silently do nothing.
    renderIt({ trash: [{ song: deleted, deletedAt: Date.now() }], onRestoreSong: null });
    expect(screen.queryByText('Restore this song')).toBeNull();
  });

  it('offers a way past it, because the service does not stop', () => {
    renderIt();
    fireEvent.click(screen.getByText('Skip to the next one'));
    expect(screen.getAllByText(/Goodness of God/).length).toBeGreaterThan(0);
  });

  // The same bar as a song and a break (owner, 2026-08-03). Most true here:
  // this is the screen already telling you something has gone wrong, and it is
  // the worst possible moment to also lose the menu and the map of the set.
  it('carries the SAME bar — ☰, ✕, and the set when it is on', () => {
    renderIt({ settings: { readerTopBar: 'setlist' } });
    expect(screen.getByRole('button', { name: 'Display options' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy();
    expect(screen.getAllByText('Goodness of God').length).toBeGreaterThan(0);
  });
});
