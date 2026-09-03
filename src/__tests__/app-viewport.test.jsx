// `--app-vh` — the shell's height, when `100dvh` is lying about it.
//
// Owner, 2026-08-23: *"there's a strange bug in the reader with the bottom bar,
// it appears higher when you first enter the reader but if you exit the app and
// enter it again it moves down again."*
//
// The reader's bottom bar is `sticky bottom-0`, the last flex child of a
// scroller that fills the shell, and nothing positions it — so there is exactly
// one geometry that puts it higher with blank space under it: the shell is
// shorter than the screen. Measured in Chromium by shortening the shell on
// purpose (the only way to see it there, since `dvh` resolves correctly at
// every size tried):
//
//   shell = 100dvh          foot bottom 768, screen 768, gap  0
//   shell = 100dvh − 44px   foot bottom 724, screen 768, gap 44
//
// So the bar moving down when you leave the app and come back is `100dvh`
// re-resolving bigger on a later layout. This module reads the number from
// somewhere we can ask again.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installAppViewport, APP_HEIGHT } from '@/lib/appViewport';

let teardown = null;
const vh = () => document.documentElement.style.getPropertyValue('--app-vh');
const setViewport = (h) => { window.innerHeight = h; };
// The module coalesces through rAF; jsdom's is a timer.
const settle = () => new Promise(r => setTimeout(r, 20));

beforeEach(() => {
  document.documentElement.style.removeProperty('--app-vh');
  setViewport(800);
});
afterEach(() => { teardown?.(); teardown = null; });

describe('publishing the height', () => {
  it('writes it immediately, before anything can paint', () => {
    teardown = installAppViewport();
    expect(vh()).toBe('800px');
  });

  it('keeps `100dvh` as the fallback, so a build without it is unchanged', () => {
    expect(APP_HEIGHT).toBe('var(--app-vh, 100dvh)');
  });

  it('follows the viewport', async () => {
    teardown = installAppViewport();
    setViewport(650);
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(vh()).toBe('650px');
  });

  // ⚠ "Exit the app and enter it again" IS a visibility change — it is the
  // gesture that happens to be fixing this by hand today, so it is the listener
  // that matters most.
  it('re-asks when you come back to the app', async () => {
    teardown = installAppViewport();
    setViewport(900);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(vh()).toBe('900px');
  });

  it('and when the page is restored from the back/forward cache', async () => {
    teardown = installAppViewport();
    setViewport(910);
    window.dispatchEvent(new Event('pageshow'));
    await settle();
    expect(vh()).toBe('910px');
  });
});

describe('the guard, and the hole that was in it', () => {
  // ⚠ THE BUG IN THE FIX. The first cut compared against a remembered "last
  // value I wrote", which assumes the only way the property can be wrong is
  // that the viewport changed. Caught by putting a short value in and firing
  // the event meant to heal it: `innerHeight` still matched the cache, the sync
  // returned early, and the app stayed short for good. The house bug, in the
  // fix for the house bug.
  it('corrects a value it did not write', async () => {
    teardown = installAppViewport();
    expect(vh()).toBe('800px');
    // Whatever put it there — a stale first layout, another writer, iOS.
    document.documentElement.style.setProperty('--app-vh', '756px');
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(vh()).toBe('800px');
  });

  // A viewport of zero is a browser mid-transition, not a fact about a screen.
  // Writing it collapses the app to nothing for a frame.
  it('never writes a zero', async () => {
    teardown = installAppViewport();
    setViewport(0);
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(vh()).toBe('800px');
  });

  it('stops listening when torn down', async () => {
    const stop = installAppViewport();
    stop();
    setViewport(500);
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(vh()).toBe('800px');
  });
});

// ⚠ `window.innerHeight`, NOT `visualViewport.height`. The visual viewport
// collapses when the on-screen keyboard opens; `innerHeight` does not. Sizing
// the shell off the visual viewport would shrink the whole app around the
// keyboard every time somebody typed a note or a tempo — a much louder bug than
// the one being fixed.
describe('which viewport it reads', () => {
  it('ignores the visual viewport, so a keyboard never resizes the app', async () => {
    teardown = installAppViewport();
    const vv = { height: 380, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(vh()).toBe('800px');
    expect(vv.addEventListener).not.toHaveBeenCalled();
  });
});
