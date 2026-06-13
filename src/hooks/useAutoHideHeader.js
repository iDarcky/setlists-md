import { useState, useEffect, useRef, useCallback } from 'react';

// Auto-hide the performance/practice header after a spell of inactivity, and
// reveal it again on interaction. Returns `[collapsed, setCollapsed,
// onActivity]`:
//   - `collapsed` drives the header's compact state.
//   - `setCollapsed` lets the manual chevron toggle it directly.
//   - `onActivity` reveals the header and re-arms the idle timer; wire it to a
//     tap/pointer on the chart area.
// When `enabled` is false the header never auto-collapses (manual control only).
export function useAutoHideHeader(enabled, { delay = 4000 } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clear();
    if (!enabled) return;
    timerRef.current = setTimeout(() => setCollapsed(true), delay);
  }, [enabled, delay, clear]);

  const onActivity = useCallback(() => {
    setCollapsed(false);
    arm();
  }, [arm]);

  useEffect(() => {
    // Only the enabled path arms a timer; when disabled we leave the header in
    // whatever state the manual chevron set it to (it never auto-collapses).
    if (!enabled) return undefined;
    arm();
    return clear;
  }, [enabled, arm, clear]);

  return [collapsed, setCollapsed, onActivity];
}
