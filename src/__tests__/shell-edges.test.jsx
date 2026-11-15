// Two iPad bugs that had nothing to do with each other except the edge of the
// screen. Owner, 2026-08-24, on an installed iPad app:
//
//   1. (The dashboard header overflow. Its test went with the old Dashboard,
//      deleted 2026-11-15.)
//   2. *"All 3 pages, dashboard, setlists, and songs have like a black bar at
//      the bottom of the page."*
//
// ⚠ Both are LAYOUT facts that jsdom cannot compute — it has no box model, so a
// rendered assertion here would pass whatever the CSS said. Measured in
// Chromium instead and pinned at the source, the way `reader.test.jsx` pins the
// rules it cannot render.
import { describe, it, expect } from 'vitest';

const read = (f) => import('node:fs').then(fs => fs.readFileSync(f, 'utf8'));

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
