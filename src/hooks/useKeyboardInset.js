import { useSyncExternalStore } from 'react';

// How much of the layout viewport the on-screen keyboard covers. iOS (and
// Android since Chrome 108) shrinks only the VISUAL viewport when the keyboard
// opens, so anything pinned to the bottom of the layout viewport ends up
// behind it. Used by the phone Save/Cancel bar (`ui/shadcn/bottom-actions`).

const KEYBOARD_MIN = 80; // smaller gaps are toolbars settling, not a keyboard

function subscribe(cb) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return () => {};
  vv.addEventListener('resize', cb);
  vv.addEventListener('scroll', cb);
  return () => { vv.removeEventListener('resize', cb); vv.removeEventListener('scroll', cb); };
}

function keyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
  return covered > KEYBOARD_MIN ? covered : 0;
}

/** Pixels of the layout viewport hidden by the on-screen keyboard (0 when closed). */
export function useKeyboardInset() {
  return useSyncExternalStore(subscribe, keyboardInset, () => 0);
}

