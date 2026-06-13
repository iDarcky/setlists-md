// Prev/next navigation as low-opacity chevrons pinned to the top corners,
// overlaid above the chart so they persist even when the header collapses.
// They brighten on press; the next arrow can peek the upcoming song's title.
// Used when the user picks the "Edge arrows" navigation style.
export default function EdgeNavArrows({ onPrev, onNext, hasPrev, hasNext, onFinish, nextLabel }) {
  const showFinish = !hasNext && typeof onFinish === 'function';
  const edgeBtn = 'pointer-events-auto flex items-center justify-center w-12 h-16 text-[var(--ds-gray-900)] opacity-30 hover:opacity-100 active:opacity-100 active:scale-95 transition-all duration-150 disabled:opacity-10 disabled:pointer-events-none';

  return (
    <div
      className="fixed left-0 right-0 z-[90] flex items-start justify-between pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
      aria-hidden={false}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous song"
        className={`${edgeBtn} pl-1`}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {showFinish ? (
        <button
          type="button"
          onClick={onFinish}
          aria-label="Finish set"
          className={`${edgeBtn} pr-1`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label={nextLabel ? `Next: ${nextLabel}` : 'Next song'}
          title={nextLabel ? `Next: ${nextLabel}` : 'Next song'}
          className={`${edgeBtn} pr-1`}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
