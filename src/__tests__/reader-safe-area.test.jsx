// The two hardware edges, on an INSTALLED app.
//
// Both of these are invisible in every browser tab and on every desktop, which
// is exactly why they shipped wrong: `env(safe-area-inset-*)` is 0 unless the
// app owns the whole screen, so nothing here shows up until someone adds the
// app to their home screen and opens it. Owner, 2026-08-23, on an iPad running
// the installed app: *"we need to fix the top on paw installed on ipad, there's
// no clearance. Also there's a bit too much clearance on bot."*
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';
import { SAFE_TOP, SAFE_BOTTOM_TOPUP, ROW_PAD } from '@/features/reader/readerChrome';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: /min-width/.test(query), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const song = songFromFlat({
  id: 's', title: 'A Song', artist: 'X', key: 'C',
  sections: [{ type: 'Verse 1', lines: ['[C]words'] }], structure: ['Verse 1'],
});

// ⚠ ASSERTED AGAINST THE SOURCE, not the rendered style. jsdom's CSS parser
// DROPS any declaration it cannot parse, and it cannot parse `env()` — so a
// rendered `style` attribute here comes back without the very property under
// test, and a DOM assertion would fail while the browser does the right thing.
// (Verified in Chromium: the reader's header carries
// `padding-top: env(safe-area-inset-top, 0px)` and computes 0px where there is
// no inset.) `reader.test.jsx` reads the source for the same class of reason.
const source = (f) => import('node:fs').then(fs => fs.readFileSync(f, 'utf8'));

describe('the top edge', () => {
  // ⚠ The status bar of an installed app is painted OVER the web view, and the
  // reader's header is `sticky top-0`. Measured before the fix: `.reader-head`
  // at top 0 with `padding-top: 0px` — not one pixel reserved, so the clock and
  // the battery sat on the song title.
  it('the sticky header reserves the status bar', async () => {
    const src = await source('src/features/reader/ReaderTopBar.jsx');
    expect(src).toContain('paddingTop: SAFE_TOP');
  });

  // ⚠ On the sticky block itself, not on a child. The block paints the chrome
  // background; padding a child instead leaves the status bar sitting over bare
  // chart while the bar starts below it.
  it('on the block that paints the background', async () => {
    const src = await source('src/features/reader/ReaderTopBar.jsx');
    const head = src.slice(src.indexOf('className="reader-head'), src.indexOf('{cornerMark}'));
    expect(head).toContain("background: 'var(--chart-bg");
    expect(head).toContain('paddingTop: SAFE_TOP');
  });

  // The reader still mounts with it — the guard against a typo that renders
  // nothing at all.
  it('and the header is still there', () => {
    const { container } = render(<Reader song={song} settings={{}} mode="practice" />);
    expect(container.querySelector('.reader-head')).toBeTruthy();
  });
});

describe('the bottom edge', () => {
  // ⚠ THE RULE. An inset is a MINIMUM DISTANCE from the edge, not an amount to
  // add to whatever padding is already there. The footer block reserved the
  // whole inset on top of the 4px its own row carries, so the buttons ended up
  // the inset PLUS 4px above the home indicator — the "bit too much".
  it('tops the row padding up to the inset instead of stacking on it', () => {
    expect(SAFE_BOTTOM_TOPUP).toContain('env(safe-area-inset-bottom');
    expect(SAFE_BOTTOM_TOPUP).toContain(`- ${ROW_PAD}px`);
    expect(SAFE_BOTTOM_TOPUP.startsWith('max(0px,')).toBe(true);
  });

  // The floor matters as much as the subtraction: without `max(0px, …)` a
  // device reporting 0 would get a NEGATIVE padding, which pulls the footer's
  // last row down off the screen on every desktop in the world.
  it('never goes negative where there is no inset', () => {
    expect(SAFE_BOTTOM_TOPUP).toMatch(/^max\(0px,/);
  });

  it('and SAFE_TOP is the plain inset — nothing is already reserved up there', () => {
    expect(SAFE_TOP).toBe('env(safe-area-inset-top, 0px)');
  });
});
