import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reusable drag-to-reorder for a vertical list — desktop HTML5 drag on a grip
 * handle plus a native, non-passive touch drag (so the page doesn't scroll or
 * select text under the finger) with edge autoscroll. Mirrors the pattern in
 * editor/ArrangeTabV2.jsx.
 *
 * Usage:
 *   const dnd = useDragReorder(onReorder, scrollRef);
 *   <div {...dnd.getRowProps(idx)}> ... <span {...dnd.getGripProps(idx)} /> </div>
 *   // dnd.dragIdx / dnd.dragOverIdx drive the visual feedback.
 *
 * `onReorder(from, to)` is called once on drop. `scrollRef` is optional — when
 * absent, edge autoscroll drives the document scrolling element.
 */
export function useDragReorder(onReorder, scrollRef) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const autoScrollRef = useRef({ raf: 0, v: 0 });
  const rowRefs = useRef({});

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current.raf) cancelAnimationFrame(autoScrollRef.current.raf);
    autoScrollRef.current = { raf: 0, v: 0 };
  }, []);

  const updateAutoScroll = useCallback((clientY) => {
    const el = scrollRef?.current || document.scrollingElement || document.documentElement;
    if (!el) return;
    const r = scrollRef?.current
      ? el.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const EDGE = 64, MAX = 16;
    let v = 0;
    if (clientY < r.top + EDGE) v = -Math.ceil(MAX * Math.min(1, (r.top + EDGE - clientY) / EDGE));
    else if (clientY > r.bottom - EDGE) v = Math.ceil(MAX * Math.min(1, (clientY - (r.bottom - EDGE)) / EDGE));
    autoScrollRef.current.v = v;
    if (v && !autoScrollRef.current.raf) {
      const tick = () => {
        const node = scrollRef?.current || document.scrollingElement || document.documentElement;
        const vel = autoScrollRef.current.v;
        if (node && vel) { node.scrollTop += vel; autoScrollRef.current.raf = requestAnimationFrame(tick); }
        else autoScrollRef.current.raf = 0;
      };
      autoScrollRef.current.raf = requestAnimationFrame(tick);
    }
  }, [scrollRef]);

  const pointToDropTarget = useCallback((clientX, clientY) => {
    const row = document.elementFromPoint(clientX, clientY)?.closest('[data-drag-idx]');
    if (row) setDragOverIdx(parseInt(row.dataset.dragIdx, 10));
  }, []);

  const endDrag = useCallback(() => {
    setDragIdx(from => {
      setDragOverIdx(to => {
        if (from != null && to != null && from !== to) onReorder(from, to);
        return null;
      });
      return null;
    });
    stopAutoScroll();
  }, [onReorder, stopAutoScroll]);

  const beginTouchDrag = useCallback((idx) => {
    setDragIdx(idx);
    const onMove = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      updateAutoScroll(e.touches[0].clientY);
      pointToDropTarget(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      endDrag();
    };
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [updateAutoScroll, pointToDropTarget, endDrag]);

  const onGripDragStart = useCallback((idx, e) => {
    setDragIdx(idx);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* noop */ }
      const card = rowRefs.current[idx];
      if (card) e.dataTransfer.setDragImage(card, 24, 16);
    }
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const getRowProps = useCallback((idx) => ({
    'data-drag-idx': idx,
    ref: (el) => { rowRefs.current[idx] = el; },
    onDragEnter: () => setDragOverIdx(idx),
    onDragEnd: endDrag,
    onDragOver: (e) => e.preventDefault(),
  }), [endDrag]);

  const getGripProps = useCallback((idx) => ({
    draggable: true,
    onDragStart: (e) => onGripDragStart(idx, e),
    onTouchStart: () => beginTouchDrag(idx),
    style: { touchAction: 'none', cursor: 'grab' },
  }), [onGripDragStart, beginTouchDrag]);

  return { dragIdx, dragOverIdx, getRowProps, getGripProps };
}
