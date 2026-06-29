import { useState } from 'react';

/**
 * Device-local persisted view mode (or any nullable string), remembered under
 * `storageKey` in localStorage. NOT synced across devices — this is a per-device
 * preference (e.g. the Songs/Setlists Cards/Compact/Table choice).
 *
 * `null` means "no explicit choice" so callers can fall back to a per-device
 * auto-default. Returns `[value, setValue]`; setting `null` clears the key.
 */
export function usePersistentView(storageKey, initial = null) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : raw;
    } catch {
      return initial;
    }
  });

  const set = (next) => {
    setValue(next);
    try {
      if (next === null || next === undefined) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, next);
    } catch { /* private mode / unavailable */ }
  };

  return [value, set];
}
