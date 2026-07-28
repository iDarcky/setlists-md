import { useState, useEffect } from 'react';

// Scroll-spy for the structure ribbon. Computes the active section straight from
// the scroll position (a "reading line" ~28% down the viewport) rather than an
// IntersectionObserver band — so it behaves the same regardless of where the
// header/ribbon sits (top, or floated to a side/bottom), and the final sections
// still light up at the end of the song. `resetKey` re-binds on song/layout
// changes so the element list is fresh.
// `lineFraction` is where down the viewport the "you are here" line sits.
// 0.28 is the historic default. The reader passes ~0 because its section
// headings are STICKY: a heading pins at the very top and stays until the next
// one pushes it out, so the pinned heading and the highlighted ribbon chip must
// answer "which section am I in?" identically. With the line at 28% they
// disagree whenever several short sections share the screen — the heading says
// Chorus while the ribbon still says Verse 2.
export function useActiveSection(scrollRef, resetKey, lineFraction = 0.28) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll('[data-section-index]'));
    if (!els.length) return undefined;
    const lastIdx = els.length - 1;

    let raf = 0;
    const compute = () => {
      raf = 0;
      const rootTop = root.getBoundingClientRect().top;
      const line = root.clientHeight * lineFraction;
      // The active section is the last one whose top has scrolled above the
      // reading line. Sections are stacked, so once one is below it the rest are.
      let current = 0;
      for (const el of els) {
        const top = el.getBoundingClientRect().top - rootTop;
        if (top - line <= 1) current = Number(el.getAttribute('data-section-index'));
        else break;
      }
      // Near the bottom the tail can't reach the line — snap to the last section.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 16) current = lastIdx;
      if (!Number.isNaN(current)) setActive(current);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(compute); };

    compute();
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, resetKey, lineFraction]);

  return active;
}
