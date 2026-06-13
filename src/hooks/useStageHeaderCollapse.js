import { useState, useEffect, useRef } from 'react';

// Collapse the stage header's title + meta rows down to just the structure
// ribbon, driven by scroll direction (down hides, up reveals; at the very top
// it always shows) with an idle-timer fallback. Gated by `enabled` (the
// Auto-hide title bar setting). Returns [collapsed, setCollapsed] so a manual
// control can still override.
export function useStageHeaderCollapse(scrollRef, enabled, { idleDelay = 4000 } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const lastYRef = useRef(0);
  const idleRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const armIdle = () => {
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => setCollapsed(true), idleDelay);
    };
    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastYRef.current;
      if (y < 8) setCollapsed(false);          // at the top → always show
      else if (dy > 6) setCollapsed(true);     // scrolling down → hide
      else if (dy < -6) setCollapsed(false);   // scrolling up → reveal
      lastYRef.current = y;
      armIdle();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    armIdle();
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(idleRef.current);
    };
  }, [scrollRef, enabled, idleDelay]);

  return [collapsed, setCollapsed];
}
