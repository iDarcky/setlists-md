import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

/**
 * Element 10 — how you get to the next song.
 *
 * One component, used unchanged on songs AND on breaks. A break used to draw
 * its own bar with the exit sitting in it, so the row moved and changed shape
 * halfway through a service — exactly the thing the reader exists to prevent.
 * Exit belongs to the top bar in both cases; this row is navigation only.
 *
 * Two treatments, `config.footer`:
 *   'count' — ← · 3 / 9 · →           the minimum, and the narrowest
 *   'next'  — ← · 3 / 9 · Next: Name (G) · →
 * Both are always visible; the reader pins this row to the bottom of the
 * screen rather than to the end of the song.
 */
export default function ReaderFooter({
  index, total, style = 'next',
  nextLabel = null, nextKey = null,
  onPrev, onNext, onFinish, onOpenSetlist,
}) {
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';

  return (
    <>
      <IconButton
        size="sm"
        aria-label="Previous song"
        disabled={atStart}
        onClick={onPrev}
        style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}
      >
        <Chevron dir="left" />
      </IconButton>

      {/* The centre is one min-w-0 group so a long song title truncates
          instead of pushing the arrows off a phone. It is also the way into
          the setlist — prev/next is for the running order, the rail is for the
          closing song they just cut. */}
      <Centre onClick={onOpenSetlist}>
        <span className="shrink-0 text-label-11 font-mono tabular-nums" style={{ color: muted }}>
          {index + 1} / {total}
        </span>
        {style === 'next' && (
          atEnd ? (
            <span className="truncate text-label-11" style={{ color: muted }}>· Last song</span>
          ) : nextLabel ? (
            <span className="min-w-0 flex items-center gap-1.5">
              <span className="shrink-0 text-label-11" style={{ color: muted }}>· Next</span>
              <span
                className="truncate text-label-12 font-medium"
                style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}
              >
                {nextLabel}
              </span>
              {nextKey && (
                <span className="shrink-0 text-label-11 font-mono font-bold" style={{ color: 'var(--chord)' }}>
                  {nextKey}
                </span>
              )}
            </span>
          ) : null
        )}
      </Centre>

      {atEnd && onFinish ? (
        <Button size="sm" variant="brand" onClick={onFinish}>Finish</Button>
      ) : (
        <IconButton
          size="sm"
          aria-label="Next song"
          disabled={atEnd}
          onClick={onNext}
          style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}
        >
          <Chevron dir="right" />
        </IconButton>
      )}
    </>
  );
}

// A button only when there's a setlist to open — a dead button in the middle
// of the bar reads as broken.
function Centre({ onClick, children }) {
  const cls = 'flex-1 min-w-0 flex items-center justify-center gap-2';
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open setlist"
      className={`${cls} bg-transparent border-none p-0 cursor-pointer`}
    >
      {children}
    </button>
  );
}

function Chevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {dir === 'left'
        ? <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        : <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />}
    </svg>
  );
}
