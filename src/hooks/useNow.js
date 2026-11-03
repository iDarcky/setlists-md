import { useEffect, useState } from 'react';

/** The current time, re-read every `ms` while `enabled` (first tick after `ms`). */
export function useNow(ms = 15000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}
