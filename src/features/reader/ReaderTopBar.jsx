import { forwardRef } from 'react';
import { IconButton } from '@/ui/IconButton';

/**
 * Element 1 — the top bar. ONE component, so a song and a break cannot drift
 * apart: the break screen used to hand-roll its own bar, which is how it ended
 * up with no menu button and the title in a different place.
 *
 * Fixed by decision — no density knob, no auto-hide. It is: menu · tools ·
 * title · meta · exit, and whatever `children` the caller pins under it (the
 * ribbon).
 *
 * `tools` is element 12's switch, and sits BESIDE the menu by decision — the
 * left cluster is where controls live. Nothing goes near the ✕: a mis-tap on
 * the right-hand edge leaves the service.
 */
const ReaderTopBar = forwardRef(function ReaderTopBar(
  { title, meta = null, onMenu, onExit, tools = null, children }, ref,
) {
  return (
    <div
      ref={ref}
      className="reader-head sticky top-0 z-20 shrink-0 flex flex-col border-b"
      style={{
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      <div className="wide-container flex items-center gap-2 py-1.5">
        {onMenu && (
          <IconButton
            size="sm"
            aria-label="Display options"
            onClick={(e) => {
              // Read the rect synchronously: React nulls currentTarget once the
              // handler returns, so a lazy state updater would see null.
              onMenu(e.currentTarget.getBoundingClientRect());
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {tools}

        {/* Title and meta are ONE group that takes the leftover width, so the
            title can never be squeezed to nothing and the key stays beside it
            rather than out by the exit — the key is the only live control here
            and a mis-tap next to ✕ leaves the service. */}
        <span className="min-w-0 flex items-center gap-2.5">
          <span
            className="truncate text-label-13 font-semibold"
            style={{
              // Explicit colour and a real flex basis: inheriting the colour
              // and shrinking from `auto` are both ways this has vanished.
              color: 'var(--chart-text, #111111)',
              // Never grow: growing is what pushed the key over to the ✕.
              flex: '0 1 auto',
              minWidth: '3rem',
              maxWidth: '22rem',
            }}
          >
            {title}
          </span>
          {meta}
        </span>

        <span className="flex-1" />

        {onExit && (
          <IconButton size="sm" aria-label="Exit" onClick={onExit}>
            <CloseIcon />
          </IconButton>
        )}
      </div>

      {children}
    </div>
  );
});

export function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default ReaderTopBar;
