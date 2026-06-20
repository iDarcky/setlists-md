import { useState, useEffect, useRef, useCallback } from 'react';

// Collapse the stage header's title + meta rows down to just the structure
// ribbon. Driven by scroll DIRECTION with hysteresis so momentum scrolling
// doesn't make it flip-flop ("spasms"), plus an idle-timer fallback. Tapping
// the chart calls `reveal()` to bring it back. Gated by `enabled` (the
// Auto-hide title bar setting).
//
// Returns [collapsed, setCollapsed, reveal].
export function useStageHeaderCollapse(scrollRef, enabled, { idleDelay = 4000 } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const lastYRef = useRef(0);
  const accumRef = useRef(0);
  const idleRef = useRef(null);
  const lockUntilRef = useRef(0);

  const apply = useCallback((next) => {
    if (collapsedRef.current === next) return;
    collapsedRef.current = next;
    setCollapsed(next);
    accumRef.current = 0;
    // Ignore scroll for a beat so the layout shift from collapsing doesn't
    // immediately re-trigger the opposite direction.
    lockUntilRef.current = Date.now() + 350;
  }, []);

  const armIdle = useCallback(() => {
    clearTimeout(idleRef.current);
    if (!enabled) return;
    idleRef.current = setTimeout(() => apply(true), idleDelay);
  }, [enabled, idleDelay, apply]);

  // Reveal on interaction (tap), and re-arm the idle timer.
  const reveal = useCallback(() => {
    apply(false);
    armIdle();
  }, [apply, armIdle]);

  useEffect(() => {
    if (!enabled) {
      collapsedRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false);
      return undefined;
    }
    const el = scrollRef.current;
    if (!el) return undefined;
    lastYRef.current = el.scrollTop;

    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastYRef.current;
      lastYRef.current = y;
      if (Date.now() < lockUntilRef.current) return;       // settle after a toggle
      if (y < 16) { apply(false); return; }                // near the top → show
      if (dy === 0) return;
      // Accumulate movement in one direction; reset when direction flips. (No
      // per-event deadzone — smooth/trackpad scroll fires many sub-pixel deltas
      // that must still add up, or it never crosses the threshold.)
      accumRef.current = Math.sign(dy) === Math.sign(accumRef.current) ? accumRef.current + dy : dy;
      if (accumRef.current > 36) apply(true);              // sustained down → hide
      else if (accumRef.current < -36) apply(false);       // sustained up → show
      armIdle();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    armIdle();
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(idleRef.current);
    };
  }, [scrollRef, enabled, idleDelay, apply, armIdle]);

  return [collapsed, setCollapsed, reveal];
}
