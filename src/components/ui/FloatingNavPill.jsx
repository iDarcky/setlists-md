export default function FloatingNavPill({ current, total, nextLabel, onPrev, onNext, hasPrev, hasNext, onFinish }) {
  // When the user has reached the last item and a finish handler is wired,
  // the next-arrow slot turns into a Finish action instead of a dead arrow.
  const showFinish = !hasNext && typeof onFinish === 'function';
  return (
    <div
      className="fixed left-0 right-0 flex justify-center z-[100] pointer-events-none"
      style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="pointer-events-auto flex items-stretch h-16 rounded-2xl border border-[var(--ds-gray-400)] shadow-xl overflow-hidden select-none"
        style={{
          background: 'var(--header-bg-blur)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          minWidth: '240px',
          maxWidth: '92vw',
        }}
      >
        {/* Prev button */}
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous song"
          style={{ minWidth: 72, border: 'none', background: 'transparent', cursor: hasPrev ? 'pointer' : 'default' }}
          className="flex items-center justify-center px-5 transition-colors duration-150 disabled:opacity-25 hover:bg-[var(--ds-gray-100)] active:bg-[var(--ds-gray-200)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--ds-gray-900)]">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <div className="w-px shrink-0 bg-[var(--ds-gray-400)]" />

        {/* Center: position + optional next label */}
        <div className="flex items-center gap-2.5 px-5 min-w-0">
          <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] tabular-nums whitespace-nowrap">
            {current} / {total}
          </span>
          {nextLabel && hasNext && (
            <span className="hidden sm:block text-label-13 text-[var(--ds-gray-600)] truncate max-w-[180px] whitespace-nowrap">
              · Next: {nextLabel}
            </span>
          )}
        </div>

        <div className="w-px shrink-0 bg-[var(--ds-gray-400)]" />

        {/* Next / Finish button */}
        {showFinish ? (
          <button
            onClick={onFinish}
            aria-label="Finish session"
            style={{ minWidth: 96, border: 'none', cursor: 'pointer', background: 'var(--color-brand)' }}
            className="flex items-center justify-center gap-1.5 px-5 transition-opacity duration-150 hover:opacity-90 active:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-label-14 font-semibold tracking-wide" style={{ color: 'white' }}>Finish</span>
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next song"
            style={{ minWidth: 72, border: 'none', background: 'transparent', cursor: hasNext ? 'pointer' : 'default' }}
            className="flex items-center justify-center px-5 transition-colors duration-150 disabled:opacity-25 hover:bg-[var(--ds-gray-100)] active:bg-[var(--ds-gray-200)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--ds-gray-900)]">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
