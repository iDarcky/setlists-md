import { useEffect, useState } from 'react';

// Draw a long list a screenful at a time.
//
// The whole library is already in memory (IndexedDB, loaded at launch), so
// nothing here is about LOADING data. It is about DRAWING it: 500 song rows or
// 500 past setlists cost 300–600 ms on a mid-range phone every time the tab
// opened, for rows nobody had scrolled to yet. The first `first` rows draw at
// once; each time the end of the list comes within `margin` of the screen,
// `step` more are added.
//
// `resetKey` (search, sort, filter, tab) starts again from the top. A plain
// data change, such as a sync landing, keeps the rows already shown.
//
// Without IntersectionObserver (old browsers, jsdom in tests) every row draws.
export function useRevealList(total, { first = 40, step = 80, margin = '1200px', resetKey } = {}) {
  const supported = typeof IntersectionObserver !== 'undefined';
  const [count, setCount] = useState(first);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setCount(first);
  }
  const [node, setNode] = useState(null);
  const more = supported && count < total;

  // A fresh observer per step: its first callback reports whether the
  // sentinel is STILL near the screen (a tall phone, a fast fling), so the
  // list keeps growing until it is past the fold.
  useEffect(() => {
    if (!node || !more) return undefined;
    // The margin only widens the ROOT's box, and the app scrolls inside
    // <main>, not the window: watch against the nearest scroller, or the
    // list would only grow once its last row was already on screen.
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setCount(c => c + step);
    }, { root: scrollParent(node), rootMargin: margin });
    io.observe(node);
    return () => io.disconnect();
  }, [node, more, count, step, margin]);

  return {
    /** How many rows to draw now. */
    count: supported ? Math.min(count, total) : total,
    /** Put `<div ref={sentinel} />` after the list while `more` is true. */
    sentinel: setNode,
    more,
  };
}

function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null; // the viewport
}
