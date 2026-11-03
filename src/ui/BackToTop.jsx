import { useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';

// The nearest ancestor that scrolls: the app's <main>, a page that scrolls
// itself (`embedded`), or the window.
function scrollParent(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return window;
}

// A round ↑ that appears once a long list is scrolled well down, and brings
// it back to the top. Put it first inside the page: it marks where "top" is.
//
// ⚠ It reads the scroll position, not an IntersectionObserver. The observer
// version never showed in the app: the list scrolls inside <main>, which
// starts below the top bar, so the marker left view while still below the
// window's top edge and the observer never fired again.
export default function BackToTop({ after = 600, className }) {
  const markRef = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const scroller = scrollParent(markRef.current);
    const read = () => setShow((scroller === window ? window.scrollY : scroller.scrollTop) > after);
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [after]);
  return (
    <>
      <div ref={markRef} aria-hidden="true" />
      {show && (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={cn('fixed bottom-[calc(env(safe-area-inset-bottom)+96px)] right-4 z-30 flex size-11 min-h-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card p-0 text-foreground shadow-[0_6px_20px_rgba(0,0,0,.3)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6', className)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      )}
    </>
  );
}
