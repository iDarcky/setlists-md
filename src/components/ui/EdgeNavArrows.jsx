import { useRef, useState, useCallback } from 'react';

// Prev/next navigation as low-opacity chevrons pinned to the side edges and
// vertically centred (kept clear of the top-corner close button), overlaid
// above the chart so they persist even when the header collapses.
// A quick tap navigates; press-and-hold peeks the song title on that side.
export default function EdgeNavArrows({ onPrev, onNext, hasPrev, hasNext, onFinish, nextLabel, prevLabel }) {
  const showFinish = !hasNext && typeof onFinish === 'function';
  const [peek, setPeek] = useState(null); // 'prev' | 'next' | null
  const timerRef = useRef(null);
  const longRef = useRef(false);

  const startHold = useCallback((side, label) => {
    if (!label) return;
    longRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { longRef.current = true; setPeek(side); }, 300);
  }, []);
  const endHold = useCallback(() => {
    clearTimeout(timerRef.current);
    setPeek(null);
  }, []);
  // Suppress the navigation click that follows a press-and-hold peek.
  const guardedClick = useCallback((fn) => () => {
    if (longRef.current) { longRef.current = false; return; }
    fn?.();
  }, []);

  const edgeBtn = 'pointer-events-auto flex items-center justify-center w-16 h-28 text-[var(--chart-text,var(--ds-gray-900))] opacity-30 hover:opacity-100 active:opacity-100 transition-all duration-150 disabled:opacity-10 disabled:pointer-events-none';
  const peekChip = 'pointer-events-none absolute top-full mt-2 max-w-[55vw] truncate px-2.5 py-1 rounded-lg text-label-12 font-semibold bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] shadow-lg';

  return (
    <div
      className="fixed left-0 right-0 top-0 bottom-0 z-[90] flex items-center justify-between pointer-events-none"
    >
      <div className="relative">
        <button
          type="button"
          onClick={guardedClick(onPrev)}
          onPointerDown={() => hasPrev && startHold('prev', prevLabel)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onContextMenu={(e) => e.preventDefault()}
          disabled={!hasPrev}
          aria-label={prevLabel ? `Previous: ${prevLabel}` : 'Previous song'}
          className={`${edgeBtn} pl-1`}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {peek === 'prev' && <span className={`${peekChip} left-1`}>{prevLabel}</span>}
      </div>

      <div className="relative">
        {showFinish ? (
          <button
            type="button"
            onClick={onFinish}
            aria-label="Finish set"
            className={`${edgeBtn} pr-1`}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={guardedClick(onNext)}
            onPointerDown={() => hasNext && startHold('next', nextLabel)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!hasNext}
            aria-label={nextLabel ? `Next: ${nextLabel}` : 'Next song'}
            className={`${edgeBtn} pr-1`}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
        {peek === 'next' && <span className={`${peekChip} right-1`}>{nextLabel}</span>}
      </div>
    </div>
  );
}
