import { useRef } from 'react';

// Long-press to enter iOS-style selection on touch devices. Returns handlers to
// spread on the pressable element plus `consumeClick()` — call it at the top of
// the element's onClick to swallow the click that a long-press's touchend
// synthesizes (so a long-press selects without also opening the item).
export function useLongPress(onLongPress, { delay = 400 } = {}) {
  const timer = useRef(null);
  const firedRef = useRef(false);
  const startPos = useRef(null);

  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  const onTouchStart = (e) => {
    firedRef.current = false;
    const t = e.touches?.[0];
    startPos.current = t ? { x: t.clientX, y: t.clientY } : null;
    clear();
    timer.current = setTimeout(() => { firedRef.current = true; onLongPress?.(); }, delay);
  };
  const onTouchMove = (e) => {
    // Cancel if the finger drifts (it's a scroll, not a press).
    const t = e.touches?.[0];
    if (t && startPos.current) {
      const dx = Math.abs(t.clientX - startPos.current.x);
      const dy = Math.abs(t.clientY - startPos.current.y);
      if (dx > 10 || dy > 10) clear();
    }
  };
  const onTouchEnd = () => clear();

  const consumeClick = () => {
    if (firedRef.current) { firedRef.current = false; return true; }
    return false;
  };

  return { bind: { onTouchStart, onTouchMove, onTouchEnd }, consumeClick };
}
