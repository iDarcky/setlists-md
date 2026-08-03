import { forwardRef } from 'react';
import { IconButton } from '@/ui/IconButton';

/**
 * The chrome's icon buttons, sized honestly — the `min-h-0` trap again
 * (`docs/READER.md`), this time in the bar itself rather than in the ribbon.
 *
 * `IconButton size="sm"` says `h-8` (32px), but `styles/index.css` carries in
 * `@layer base`:
 *
 *     button                          { min-height: 36px }
 *     @media (max-width: 639px) button { min-height: 44px }
 *
 * `min-height` beats `height`, so the ☰ and ✕ were **44px tall on a phone** and
 * the bar was `6 + 44 + 6 = 56px` — not the 44px the classes read like. That is
 * where the reader's chrome height was actually going; the padding was never
 * the problem. Owner, 2026-08-03, asking whether the header was aligned by
 * height and whether the bottom bar could be smaller: it is centred (every row
 * is `items-center`), it was just taller than it looked.
 *
 * 36px here, opting out of the phone floor. The ☰ and ✕ are reached between
 * songs, not mid-song — unlike the footer's prev/next, which keep a bigger
 * target because they are hit in the dark (see `ReaderFooter`).
 */
export const BAR_BUTTON = 'min-h-0 h-9 w-9 text-[var(--chart-text,var(--ds-gray-1000))]';

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
  { title, meta = null, onMenu, onExit, tools = null, leading = null, aboveBar = null, children }, ref,
) {
  return (
    <div
      ref={ref}
      className="reader-head sticky top-0 z-20 shrink-0 flex flex-col border-b"
      // The brand-tinted divider closes the WHOLE sticky block — bar plus
      // whatever is pinned under it — rather than sitting between the two.
      // Element 2's decision is that the bar and the ribbon are ONE piece of
      // chrome that travels together; a line between them argues the opposite,
      // and it landed as an underline for the song title. The boundary that
      // actually exists is chrome ↔ chart, and this is it. (2026-08-01, after
      // one round with the line in the other place.)
      style={{
        borderColor: 'var(--chart-divider, var(--chart-rule, var(--ds-gray-300)))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      {/* Element 8b's setlist bar, when it's on. ABOVE the title row, inside
          the same sticky block: SET / HEADER / STRUCTURE. */}
      {aboveBar}

      {/* py-1, not py-1.5 — see BAR_BUTTON on where the height actually comes
          from. */}
      <div className="wide-container flex items-center gap-2 py-1">
        {onMenu && (
          <IconButton
            size="sm"
            className={BAR_BUTTON}
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

        {/* The setlist rail. On the RIGHT (owner, 2026-08-03) — which does bend
            element 1's "nothing goes near the ✕", so it is separated from it by
            the gap and it opens a panel rather than doing anything destructive.
            A mis-tap here costs you a panel, not the service. */}
        {leading}

        {onExit && (
          <IconButton size="sm" className={BAR_BUTTON} aria-label="Exit" onClick={onExit}>
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
