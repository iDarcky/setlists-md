import { useRef, useState } from 'react';

// Drag to reorder by a grip handle, with pointer events so the same code works
// for a mouse, a pen and a finger — including an installed iPhone PWA, where
// HTML5 drag-and-drop does nothing. The grip sets `touch-action: none`, so a
// drag that starts on it never scrolls the page; anywhere else still scrolls.
//
// Rows are found by `data-drag-row` inside the list element.

export function useDragReorder(onMove) {
  const listRef = useRef(null);
  const state = useRef(null);
  const [drag, setDrag] = useState(null); // { from, over, dy }

  const overFor = (y) => {
    const s = state.current;
    let over = s.from;
    s.mids.forEach((mid, i) => {
      if (i < s.from && y < mid) over = Math.min(over, i);
      if (i > s.from && y > mid) over = Math.max(over, i);
    });
    return over;
  };

  const gripProps = (index) => ({
    style: { touchAction: 'none', cursor: 'grab' },
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const rows = [...(listRef.current?.querySelectorAll('[data-drag-row]') || [])];
      if (!rows[index]) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const rects = rows.map(r => r.getBoundingClientRect());
      state.current = { from: index, startY: e.clientY, mids: rects.map(r => r.top + r.height / 2), height: rects[index].height };
      setDrag({ from: index, over: index, dy: 0, h: rects[index].height });
    },
    onPointerMove: (e) => {
      const s = state.current;
      if (!s) return;
      const dy = e.clientY - s.startY;
      s.over = overFor(s.mids[s.from] + dy);
      setDrag({ from: s.from, over: s.over, dy, h: s.height });
    },
    onPointerUp: () => {
      const s = state.current;
      state.current = null;
      setDrag(null);
      if (s && s.over != null && s.over !== s.from) onMove(s.from, s.over);
    },
    onPointerCancel: () => { state.current = null; setDrag(null); },
  });

  /** Style for row `i` while dragging: the picked row follows the finger, the rest make room. */
  const rowStyle = (i) => {
    if (!drag) return undefined;
    const h = drag.h || 0;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 2, boxShadow: '0 8px 24px rgba(0,0,0,.25)' };
    if (drag.from < drag.over && i > drag.from && i <= drag.over) return { transform: `translateY(${-h}px)`, transition: 'transform 120ms' };
    if (drag.from > drag.over && i < drag.from && i >= drag.over) return { transform: `translateY(${h}px)`, transition: 'transform 120ms' };
    return { transition: 'transform 120ms' };
  };

  return { listRef, drag, gripProps, rowStyle };
}

/** items with the one at `from` moved to `to`. */
export function moveItem(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
