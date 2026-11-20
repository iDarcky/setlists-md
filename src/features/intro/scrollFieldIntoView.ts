import type { FocusEvent } from 'react';

/** Bring a focused field above the on-screen keyboard once it has opened. */
export function scrollFieldIntoView(e: FocusEvent<HTMLInputElement>) {
  const el = e.target;
  setTimeout(() => {
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ }
  }, 300);
}
