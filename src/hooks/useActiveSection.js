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

    const lastIdx = els.length - 1;
    // Are we scrolled to (within a few px of) the bottom? The final sections
    // can't reach the active band — there's no content below to push them up —
    // so at the bottom we snap to the last section instead of leaving the tail
    // permanently un-highlighted.
    const atBottom = () => root.scrollTop + root.clientHeight >= root.scrollHeight - 8;

    const visible = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number(e.target.getAttribute('data-section-index'));
          if (Number.isNaN(idx)) return;
          if (e.isIntersecting) visible.set(idx, e.intersectionRatio);
          else visible.delete(idx);
        });
        if (atBottom()) setActive(lastIdx);
        else if (visible.size) setActive(Math.min(...visible.keys()));
      },
      // Active band sits just below the header (10%) and spans to ~30% of the
      // viewport, so the section crossing the top is what's highlighted.
      { root, rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));

    // The observer only fires when a section crosses the band, so scrolling the
    // last few px into the bottom region (without any band crossing) wouldn't
    // update the highlight. A passive scroll listener snaps to the last section
    // once we hit the bottom.
    const onScroll = () => { if (atBottom()) setActive(lastIdx); };
    root.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, [scrollRef, resetKey]);

  return active;
}
