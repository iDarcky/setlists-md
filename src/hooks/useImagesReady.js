import { useEffect, useState } from 'react';

// URLs this page has already loaded (or failed to): asking again is instant.
const settled = new Set();

/**
 * True once every image in `urls` has loaded or failed, so a screen can draw
 * its photos together with everything else instead of popping them in after
 * (owner, 22 Nov 2026: Home's faces came in late after a reload). Empty or
 * falsy URLs are ignored. Callers cap the wait themselves.
 */
export function useImagesReady(urls) {
  const key = [...new Set((urls || []).filter(Boolean))].sort().join('\n');
  const [readyKey, setReadyKey] = useState(null);
  const pending = key ? key.split('\n').filter(u => !settled.has(u)) : [];
  const allSettled = pending.length === 0;

  useEffect(() => {
    if (!key) return undefined;
    const todo = key.split('\n').filter(u => !settled.has(u));
    if (!todo.length) return undefined;
    let live = true;
    let left = todo.length;
    const imgs = todo.map((u) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        settled.add(u);
        left -= 1;
        if (left === 0 && live) setReadyKey(key);
      };
      img.src = u;
      return img;
    });
    return () => { live = false; imgs.forEach((img) => { img.onload = img.onerror = null; }); };
  }, [key]);

  return allSettled || readyKey === key;
}
