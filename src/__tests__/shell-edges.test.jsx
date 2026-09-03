// Two iPad bugs that had nothing to do with each other except the edge of the
// screen. Owner, 2026-08-24, on an installed iPad app:
//
//   1. *"you can scroll left/right on the dashboard because of the customize
//      button, or I think that's the reason"* — it was.
//   2. *"All 3 pages, dashboard, setlists, and songs have like a black bar at
//      the bottom of the page."*
//
// ⚠ Both are LAYOUT facts that jsdom cannot compute — it has no box model, so a
// rendered assertion here would pass whatever the CSS said. Measured in
// Chromium instead and pinned at the source, the way `reader.test.jsx` pins the
// rules it cannot render.
import { describe, it, expect } from 'vitest';

const read = (f) => import('node:fs').then(fs => fs.readFileSync(f, 'utf8'));

describe('the dashboard header cannot push the page sideways', () => {
  // Measured in Chromium, `main.scrollWidth - main.clientWidth` on the
  // dashboard, before the fix:
  //
  //   744  ok        820  OVERFLOW 14px   ← iPad portrait
  //   768  OVERFLOW 66px                  1000+ ok
  //
  // and the overflowing node at 820 was `div.items-center.gap-2.mt-2` — the
  // group holding New Song, New Setlist and Customize — ending in the Customize
  // button itself. From `md:` up the header is a ROW of two things that both
  // refuse to shrink: a 565px group of non-wrapping buttons and a 40px display
  // heading with no `min-w-0`.
  //
  // ⚠ `<main>` is `overflow-y-auto`, and `overflow-y: auto` computes
  // `overflow-x` to `auto` too — so an overflow inside it is a horizontal
  // SCROLL, not a clip. html/body are `overflow: hidden`, which is why the
  // document itself never showed it and only the page slid.
  it('wraps instead, and both halves can give first', async () => {
    const src = await read('src/features/dashboard/Dashboard.jsx');
    const header = src.slice(src.indexOf('Header: Welcome + Search + Actions'),
      src.indexOf('Reorderable widgets'));
    expect(header).toContain('md:flex-row flex-wrap');
    // The greeting and the action group, each able to shrink before the wrap.
    expect(header).toContain('<div className="min-w-0">');
    expect(header).toContain('min-w-0 flex flex-col sm:flex-row');
    // And the widest fixed thing in the group — the search box.
    expect(header).toContain('w-full sm:w-72 min-w-0');
  });
});

describe('nothing shows through under the shell', () => {
  // ⚠ THE SEAM. `<main>` paints `--ds-background-100`; body was
  // `--ds-background-200`, which in the dark theme is hsl(0 0% 4%) — near
  // black against main's hsl(240 4% 9%). Body's background is what propagates
  // to the CANVAS, so the moment the shell came up short of the screen the gap
  // underneath read as a black bar across the bottom of every page.
  //
  // Reproduced in Chromium by shortening the shell 44px: a 44px band of
  // rgb(10,10,10) under rgb(22,22,24). After: rgb(22,22,24) — invisible.
  //
  // ⚠ This is the SECOND lock, not the fix. The height itself is
  // `lib/appViewport.js`, the same iOS fault that left the reader's bottom bar
  // hanging above the screen. One ground means a residual pixel of gap can
  // never be a bar again.
  it('body carries the same ground as the page', async () => {
    const css = await read('src/styles/index.css');
    const body = css.slice(css.indexOf('  body {'), css.indexOf('  html {'));
    expect(body).toContain('background: var(--ds-background-100)');
    expect(body).not.toContain('background: var(--ds-background-200)');
  });

  // The height fix that makes the gap not exist in the first place.
  it('and the shell height is still the one we can re-ask for', async () => {
    const css = await read('src/styles/index.css');
    expect(css).toContain('height: var(--app-vh, 100dvh)');
  });
});
