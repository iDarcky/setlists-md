// Element 10, on the one rule it has that is not about getting somewhere:
// **while a song is being edited, nothing may leave it.** The change is
// already applied and Cancel only exists while the session is open, so a jump
// to the next song strands it with no way back.
//
// ⚠ The rule was enforced on the three navs you can SEE — the footer, the
// floating pill and the edge arrows all carry `!locked` — and on neither of
// the two you cannot. The keyboard/pedal handler and the swipe both walked
// straight out of an edit, and they are exactly the paths that give no sign
// navigation is supposed to be off. A hidden control is not a disabled one.
//
// The rail had the same bug pointing the other way: `locked` disabled its
// COLLAPSE chevron (which strands nothing) and left every row live.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SetlistReader from '@/features/reader/SetlistReader';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  try { localStorage.clear(); } catch { /* private mode */ }
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const songs = [
  songFromFlat({ id: 's1', title: 'Cornerstone', key: 'C', sections: [{ type: 'Verse 1', lines: ['[C]a'] }] }),
  songFromFlat({ id: 's2', title: 'Goodness of God', key: 'A', sections: [{ type: 'Verse 1', lines: ['[A]b'] }] }),
];
const setlist = { id: 'sl1', items: [{ songId: 's1' }, { songId: 's2' }] };

const renderIt = (settings = {}) => render(
  <SetlistReader
    setlist={setlist} songs={songs} settings={settings} mode="practice"
    onBack={() => {}} onFinish={() => {}} onUpdateSong={vi.fn()}
  />
);

const enterEdit = () => {
  const fab = screen.queryByRole('button', { name: 'Song actions' });
  if (fab) fireEvent.click(fab);
  fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
};
// Edit mode's own Done button is the tell: it exists only on the song being
// edited, so it disappearing means we navigated away.
const stillEditing = () => screen.queryByRole('button', { name: 'Done' }) !== null;

describe('nothing leaves a song mid-edit', () => {
  it('not the keyboard, and not a Bluetooth pedal', () => {
    renderIt();
    enterEdit();
    expect(stillEditing()).toBe(true);
    for (const key of ['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp']) {
      fireEvent.keyDown(window, { key });
      expect(stillEditing()).toBe(true);
    }
  });

  it('not a swipe', () => {
    renderIt({ readerNav: 'swipe' });
    enterEdit();
    const surface = document.querySelector('.overflow-y-auto.no-scrollbar');
    fireEvent.touchStart(surface, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 40, clientY: 105 }] });
    expect(stillEditing()).toBe(true);
  });

  it('not a row in the rail, which is remembered open per device', () => {
    try { localStorage.setItem('setlists-md:reader-rail-open', '1'); } catch { /* private mode */ }
    renderIt();
    enterEdit();
    // The rail is beside the chart, already open from a previous session.
    const rail = screen.getByRole('complementary', { name: 'Setlist' });
    const row = [...rail.querySelectorAll('button')]
      .find(b => b.textContent.includes('Goodness of God'));
    expect(row).toBeTruthy();
    fireEvent.click(row);
    expect(stillEditing()).toBe(true);
  });

  // ⚠ The other half of the same correction: closing the rail is the SAFE act
  // — it leaves you on the song you are editing — and it was the one thing
  // `locked` disabled.
  it('but the rail can still be closed', () => {
    try { localStorage.setItem('setlists-md:reader-rail-open', '1'); } catch { /* private mode */ }
    renderIt();
    enterEdit();
    const collapse = screen.getByRole('button', { name: 'Collapse setlist' });
    expect(collapse.hasAttribute('disabled')).toBe(false);
    fireEvent.click(collapse);
    expect(screen.queryByRole('complementary', { name: 'Setlist' })).toBeNull();
    expect(stillEditing()).toBe(true);
  });

  it('and every nav works again the moment the edit is done', () => {
    renderIt();
    enterEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
});
