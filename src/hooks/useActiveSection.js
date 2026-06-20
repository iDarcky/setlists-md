import { useState, useEffect } from 'react';

// Scroll-spy for the structure ribbon: watches the rendered section elements
// (tagged with `data-section-index`) inside a scroll container and returns the
// index of the one currently near the top of the view. `resetKey` should change
// when the rendered sections change (song switch, display-mode/column change) so
// the observer re-binds to the new DOM.
export function useActiveSection(scrollRef, resetKey) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const els = root.querySelectorAll('[data-section-index]');
    if (!els.length) return undefined;

    const visible = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number(e.target.getAttribute('data-section-index'));
          if (Number.isNaN(idx)) return;
          if (e.isIntersecting) visible.set(idx, e.intersectionRatio);
          else visible.delete(idx);
        });
        if (visible.size) setActive(Math.min(...visible.keys()));
      },
      // Active band sits just below the header (10%) and spans to ~30% of the
      // viewport, so the section crossing the top is what's highlighted.
      { root, rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scrollRef, resetKey]);

  return active;
}
