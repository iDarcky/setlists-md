import { useSyncExternalStore } from 'react';

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}

// Touch tablets (iPad portrait & landscape). `pointer: coarse` keeps this from
// matching desktop browsers at the same widths, so the two-pane tablet shell
// never leaks onto mouse-driven desktops.
export function useIsTablet() {
  return useMediaQuery('(min-width: 768px) and (max-width: 1366px) and (pointer: coarse)');
}

export function useIsLandscape() {
  return useMediaQuery('(orientation: landscape)');
}
