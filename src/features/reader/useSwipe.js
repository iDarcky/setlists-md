import { useCallback, useRef } from 'react';

/**
 * A horizontal-dominant swipe → onLeft / onRight. The same thresholds the
 * Reader has always used for songs (60px, and clearly more sideways than
 * down), shared so a break or a missing song moves the same way a song does.
 * Returns touch props to spread on the screen's root; empty when there is no
 * handler, so a screen without swipe nav costs nothing.
 */
// A drag that starts inside something that scrolls sideways (a wide guitar
// tab, the structure strip) is that thing's scroll, never a page turn.
function inSideScroller(el, root) {
  for (let n = el; n && n !== root && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

export function useSwipe(onLeft, onRight) {
  const start = useRef(null);
  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    start.current = t && !inSideScroller(e.target, e.currentTarget) ? { x: t.clientX, y: t.clientY } : null;
  }, []);
  const onTouchEnd = useCallback((e) => {
    const s = start.current;
    start.current = null;
    const t = e.changedTouches?.[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0) onLeft?.(); else onRight?.();
  }, [onLeft, onRight]);
  return onLeft || onRight ? { onTouchStart, onTouchEnd } : {};
}
