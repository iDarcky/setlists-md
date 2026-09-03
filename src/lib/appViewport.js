// How tall the app is, when the unit that is supposed to say so is lying.
//
// ── The bug ─────────────────────────────────────────────────────────────────
// Owner, 2026-08-23: *"there's a strange bug in the reader with the bottom bar,
// it appears higher when you first enter the reader but if you exit the app and
// enter it again it moves down again."*
//
// The reader's bottom bar is `sticky bottom-0`, the last flex child of a
// scroller that fills the shell. Nothing positions it — so there is exactly one
// geometry that can put it higher with blank space under it: **the shell is
// shorter than the screen.** Measured in Chromium by shortening the shell on
// purpose, which is the only way to see it there:
//
//   shell = 100dvh          foot bottom 768, screen 768, gap 0
//   shell = 100dvh − 20px   foot bottom 748, screen 768, gap 20
//   shell = 100dvh − 44px   foot bottom 724, screen 768, gap 44
//
// The shell's height is `100dvh` — on `html`, on `body`, and on
// `DesktopLayout`'s root. So the bar moving down when you leave the app and
// come back is `100dvh` re-resolving to a bigger number on the second layout:
// the value was wrong at first paint and nothing asked it again.
//
// ⚠ NOT REPRODUCIBLE IN CHROMIUM, and it is not going to be. `dvh` resolves
// correctly there at every size tried (1024×768, 768×1024, 390×844, before and
// after a resize: shell = main = scroller = innerHeight, exactly). This is an
// iOS layout-timing fault, and there is no WebKit build in this environment to
// watch it happen — so the fix is aimed at the mechanism, which IS measurable,
// rather than at a repro.
//
// ── The fix ─────────────────────────────────────────────────────────────────
// `window.innerHeight` is the same number `100dvh` is meant to be, except it is
// a value we can read now and read again. It is published as `--app-vh` and the
// stylesheets use it with `100dvh` as the FALLBACK, so a build where this never
// runs behaves exactly as it does today.
//
// ⚠ `window.innerHeight`, not `visualViewport.height`. The visual viewport
// collapses when the on-screen keyboard opens; `innerHeight` does not. Sizing
// the shell off the visual viewport would shrink the whole app around the
// keyboard every time someone typed a note or a tempo — a much louder bug than
// the one being fixed.
//
// ⚠ `visibilitychange` is the important listener, not `resize`. "Exit the app
// and enter it again" is precisely a visibility change, and it is what happens
// to be fixing this by hand today.

/** The shell's height, for anything that means "as tall as the screen". */
export const APP_HEIGHT = 'var(--app-vh, 100dvh)';

/**
 * Publish `--app-vh` and keep it current. Idempotent; returns a teardown.
 *
 * Called at module scope from `main.jsx` rather than from a component, so the
 * first value is written before React's first paint instead of one frame after
 * it.
 */
export function installAppViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let frame = 0;
  const root = document.documentElement;

  const write = () => {
    frame = 0;
    const h = window.innerHeight;
    // A viewport of zero is a browser mid-transition, not a fact about the
    // screen. Writing it would collapse the app for a frame.
    if (!h) return;
    // ⚠ COMPARED AGAINST THE DOM, never against a remembered number. A cached
    // "last value I wrote" is a switch wired at one end: it assumes the only
    // way the property can be wrong is that the viewport changed. Tested by
    // putting a short value in and firing the event that is supposed to heal
    // it — with the cache, `innerHeight` still matched what we thought we had
    // written, so the sync returned early and the app stayed 44px short
    // FOREVER. Reading the property back costs nothing (it is our own inline
    // style, not a computed value, so there is no layout flush) and it makes
    // every listener genuinely corrective.
    const next = `${h}px`;
    if (root.style.getPropertyValue('--app-vh') === next) return;
    root.style.setProperty('--app-vh', next);
  };

  // Coalesced: iOS can fire orientationchange and resize for one rotation, and
  // the two would otherwise lay the whole app out twice.
  const sync = () => {
    if (frame) return;
    frame = requestAnimationFrame(write);
  };

  write();

  const events = ['resize', 'orientationchange', 'pageshow'];
  for (const e of events) window.addEventListener(e, sync);
  document.addEventListener('visibilitychange', sync);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    for (const e of events) window.removeEventListener(e, sync);
    document.removeEventListener('visibilitychange', sync);
  };
}
