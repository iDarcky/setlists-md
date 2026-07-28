// Test setup — runs before every suite.
//
// IndexedDB first, before anything that might import storage.js: that module
// kicks off migrateLegacyKeys() at import time, so merely importing a
// component that touches storage rejects in a bare jsdom — and an unhandled
// rejection during import leaves the environment in a state where unrelated
// jsdom APIs start throwing.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount anything a test rendered. Without this the next test's queries can
// match the previous test's still-attached tree, which shows up as a passing
// assertion against stale DOM — the worst kind of green.
afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, and several components call them on mount
// (media queries drive the desktop/mobile split; matchMedia in particular is
// read synchronously by useSyncExternalStore in the editor's split preview).
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// jsdom 30 bug: `env()` inside `calc()` is stored mangled and then throws.
//
//   el.style.paddingTop = 'calc(0.75rem + env(safe-area-inset-top, 0px))'
//   -> stored as        'calc(0.75rem + env(0px * , * safe-area-inset-top))'
//   -> getComputedStyle() throws "object null is not iterable"
//
// (jsdom/living/css/helpers/font-sizes.js destructures a regex `exec` that
// returned null.) Bare `env(...)` is fine — only the calc form breaks.
//
// This is not our bug: the CSS is valid and ships correctly. But it's fatal in
// tests, because Testing Library calls getComputedStyle for every accessibility
// check, so a single safe-area header breaks EVERY `getByRole` on the page —
// and this is a PWA, so safe-area padding is everywhere.
//
// Workaround: on throw, recompute with the inline style attribute temporarily
// removed and snapshot the result. Class-based styles (all of Tailwind, which
// is where display/visibility actually come from) are preserved; the only thing
// lost is inline safe-area padding, which no assertion cares about.
// Remove this once jsdom fixes the parse.
// Fix the cause, once per element, rather than guarding every read: on the
// first throw, drop just the declarations containing env() from that element's
// inline style and recompute. Everything else inline survives, the element is
// permanently fixed (so getByRole — which touches every element, repeatedly,
// inside waitFor — pays nothing after the first hit), and the only thing lost
// is safe-area padding that no assertion looks at.
const nativeGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = function patchedGetComputedStyle(el, pseudo) {
  try {
    return nativeGetComputedStyle(el, pseudo);
  } catch (err) {
    const inline = el?.getAttribute?.('style');
    if (!inline) throw err;
    // First try dropping only the env() declarations — that is the known jsdom
    // bug and the narrowest fix. jsdom's length resolution can also throw on
    // other inline combinations, so fall back to dropping the inline style
    // entirely: class-based styles (all of Tailwind, which is where
    // display/visibility actually come from) survive, and the only thing lost
    // is inline styling no assertion looks at.
    const kept = inline
      .split(';')
      .filter((decl) => decl.trim() && !decl.includes('env('))
      .join(';');
    el.setAttribute('style', kept);
    try {
      return nativeGetComputedStyle(el, pseudo);
    } catch {
      el.removeAttribute('style');
      return nativeGetComputedStyle(el, pseudo);
    }
  }
};

// Radix primitives (Select, Dialog) call these during open/close transitions.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
// jsdom implements scrollTo on window but not on elements. The structure
// ribbon scrolls the active section chip into view on mount, so without this
// every test that renders a reading surface throws before its first assertion.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
