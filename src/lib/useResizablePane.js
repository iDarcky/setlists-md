import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Width state for a right-hand detail pane with a draggable divider.
 *
 * The pane sits on the right of a flex row (the list column is flex-1), so
 * dragging the divider left widens the pane. Width is clamped to [min, max]
 * and remembered per device under `storageKey`.
 *
 * Returns `{ width, onPointerDown }` — spread the handler onto the divider.
 */
export function useResizablePane({ storageKey, defaultWidth = 460, min = 360, max = 860 }) {
  const [width, setWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(storageKey), 10);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defaultWidth;
    } catch {
      return defaultWidth;
    }
  });

  const dragRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, String(width)); } catch { /* private mode */ }
  }, [storageKey, width]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const next = d.startW - (ev.clientX - d.startX);
      setWidth(Math.min(max, Math.max(min, next)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, min, max]);

  return { width, onPointerDown };
}
