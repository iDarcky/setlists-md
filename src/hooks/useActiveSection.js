import { useState, useEffect } from 'react';

// Scroll-spy for the structure ribbon. Computes the active section straight from
// the scroll position (a "reading line" ~28% down the viewport) rather than an
// IntersectionObserver band — so it behaves the same regardless of where the
// header/ribbon sits (top, or floated to a side/bottom), and the final sections
// still light up at the end of the song. `resetKey` re-binds on song/layout
// changes so the element list is fresh.
//
// `lineFraction` is where down the viewport the "you are here" line sits.
// 0.28 is the historic default. The reader passes ~0 because its section
// headings are STICKY: a heading pins at the very top and stays until the next
// one pushes it out, so the pinned heading and the highlighted ribbon chip must
// answer "which section am I in?" identically. With the line at 28% they
// disagree whenever several short sections share the screen — the heading says
// Chorus while the ribbon still says Verse 2.
//
// `enabled` turns scroll-spy OFF, and it returns `null` — no section is active.
// Static surfaces (the editor preview, the Song Hub's chart tab, the side peek)
// show a whole song at rest; there is no "where am I", so highlighting one
// section there is a claim about the reader's attention that nothing supports.
//
// Returns the active section index, or `null` when there isn't one. Callers must
// treat `null` as "highlight nothing" — not as index 0.
export function useActiveSection(scrollRef, resetKey, lineFraction = 0.28, enabled = true) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const root = scrollRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll('[data-section-index]'));
    if (!els.length) return undefined;
    const lastIdx = els.length - 1;

    let raf = 0;
    const compute = () => {
      raf = 0;
      // Nothing to spy on when the content fits: with no overflow there is no
      // scroll position, so no section is more "current" than any other.
      //
      // This guard is the whole bug. The snap-to-last rule below reads
      // `scrollTop + clientHeight >= scrollHeight - 16`, which for a song that
      // fits is `0 + h >= h - 16` — TRUE on the very first frame. So a short
      // song lit up its LAST section immediately, on the ribbon and the song map
      // alike, and looked like the scroll-spy was reading backwards.
      const scrollable = root.scrollHeight - root.clientHeight > 24;
      if (!scrollable) { setActive(null); return; }

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
  }, [scrollRef, resetKey, lineFraction, enabled]);

  // Masked on the way out rather than zeroed in state: setting state inside the
  // effect to express "disabled" is a cascading render, and the value is a pure
  // function of a prop anyway.
  return enabled ? active : null;
}
