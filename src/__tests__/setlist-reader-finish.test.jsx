// Element 13's front door: how a set actually reaches the finale.
//
// ⚠ ONE OF THE FOUR NAVS COULD NOT. The footer's last arrow turns into Finish,
// the floating pill's does, the edge arrows' does — **swipe** had no visible
// control at all beyond the counter chip, and a swipe past the last song just
// clamps. So for a swipe user element 13 was reachable by no route whatever and
// the only way out of a finished set was the ✕. Every nav is asked the same
// question here, so a fifth one cannot be added without answering it.
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
  window.matchMedia = vi.fn().mockImplementation(q => ({
    matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const songs = [
  songFromFlat({ id: 's1', title: 'Cornerstone', key: 'G', sections: [{ type: 'Verse 1', lines: ['[G]a'] }] }),
  songFromFlat({ id: 's2', title: 'Goodness of God', key: 'A', sections: [{ type: 'Verse 1', lines: ['[A]b'] }] }),
];
const setlist = { id: 'sl1', name: 'Sunday', items: [{ songId: 's1' }, { songId: 's2' }] };

const NAVS = ['footer', 'pill', 'edge', 'swipe'];

describe('every nav can finish a set', () => {
  for (const nav of NAVS) {
    it(`${nav} offers Finish on the last item, and it fires`, () => {
      const onFinish = vi.fn();
      render(<SetlistReader setlist={setlist} songs={songs} settings={{ readerNav: nav }}
        onBack={() => {}} onFinish={onFinish} startIndex={1} />);
      fireEvent.click(screen.getByRole('button', { name: /finish/i }));
      expect(onFinish).toHaveBeenCalledTimes(1);
      // Element 13 takes exactly one thing, and its only stat is computed from
      // it — `{ songCount }` was once sent instead and the finale read 0s.
      expect(typeof onFinish.mock.calls[0][0].startTime).toBe('number');
    });

    it(`${nav} offers no Finish before the end`, () => {
      render(<SetlistReader setlist={setlist} songs={songs} settings={{ readerNav: nav }}
        onBack={() => {}} onFinish={() => {}} />);
      expect(screen.queryByRole('button', { name: /finish/i })).toBeNull();
    });
  }

  // ⚠ A host that cannot take you to a finale must not draw a button saying it
  // will. Every nav guards on `onFinish`, but `SetlistReader` wrapped it as
  // `() => onFinish?.({…})` — always a function — so the guard was always true.
  // No caller is in that position today (App always passes one), which is what
  // makes it a landmine rather than a bug: it arrives with the next caller.
  it('offers no Finish at all without somewhere to finish to', () => {
    for (const nav of NAVS) {
      const { unmount } = render(
        <SetlistReader setlist={setlist} songs={songs} settings={{ readerNav: nav }}
          onBack={() => {}} startIndex={1} />
      );
      expect(screen.queryByRole('button', { name: /finish/i })).toBeNull();
      unmount();
    }
  });
});
