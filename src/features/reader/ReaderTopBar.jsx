import { forwardRef } from 'react';
import { IconButton } from '@/ui/IconButton';
import { BAR_BUTTON, EDIT_ACCENT, EDIT_INK, EDIT_CHROME } from './readerChrome';

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
  {
    title, meta = null, onMenu, onExit, tools = null, leading = null,
    aboveBar = null, editing = false, exitDisabled = false, progress = null, children,
  }, ref,
) {
  return (
    <div
      ref={ref}
      className="reader-head sticky top-0 z-20 shrink-0 flex flex-col border-b transition-colors"
      // The brand-tinted divider closes the WHOLE sticky block — bar plus
      // whatever is pinned under it — rather than sitting between the two.
      // Element 2's decision is that the bar and the ribbon are ONE piece of
      // chrome that travels together; a line between them argues the opposite,
      // and it landed as an underline for the song title. The boundary that
      // actually exists is chrome ↔ chart, and this is it. (2026-08-01, after
      // one round with the line in the other place.)
      // Edit mode colours the CHROME rather than adding an element to it:
      // element 1 is fixed and takes no additions, so a mode it can be in has
      // to be a STATE of the bar, not a new thing in it. (Same principle the
      // owner picked for the follow-the-leader indicator, 2026-08-03.) The
      // divider stays orange even though the map below it is not — it closes
      // the block, and an orange line under the map says the map belongs to
      // the mode, which it does: it is the thing you edit the play order with.
      style={{
        borderColor: editing
          ? EDIT_ACCENT
          : 'var(--chart-divider, var(--chart-rule, var(--ds-gray-300)))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      {/* ── The ORANGE part of the block: progress · set · title row ────────
          The set and the header, and NOT the song map (owner, 2026-08-04,
          after a round with the whole block orange). The map is the one thing
          you are looking at while you edit — it is where the play order is
          changed — and it reads best on the chart's own paper, in the same
          section colours it has everywhere else in the app. Painting it too
          meant inverting every chip to survive the ground, which is a second
          appearance for the map nobody asked to learn.

          A SOLID ground, never a tint: 9% orange mixed into the chart's own
          background is nearly invisible over cream and muddy over near-black,
          and it drags the title's contrast with it (owner: "if we use this
          opacity it will look different for each theme and some might not be
          readable"). `EDIT_CHROME` pins the ground AND the ink, so this reads
          identically on every chart theme.

          One wrapper for all three rows rather than a style on each: the token
          re-points have to reach the set bar's subtree, and re-pointing them
          BACK for the ribbon underneath would mean `--chart-bg: var(--chart-bg)`
          — a cycle, which is invalid at computed-value time and unsets the
          whole subtree (`docs/READER.md`, trap 2). Keeping the ribbon outside
          the wrapper is the only version that cannot hit that. */}
      <div className="flex flex-col transition-colors" style={editing ? EDIT_CHROME : undefined}>
        {/* How far through the SET you are. It used to belong to
            `ReaderSetlistBar`, so turning the set bar off took the progress
            with it (owner, 2026-08-03). It lives here now — top of the sticky
            block, exactly where it always appeared — so it survives every
            combination. The top, not the bottom nav: two of the four nav
            styles (pill, swipe) have no bottom bar to put it on. */}
        {progress != null && (
          <div className="h-0.5 w-full shrink-0" style={{ background: 'var(--chart-rule, var(--ds-gray-300))' }}>
            <div
              className="h-full transition-[width] duration-300"
              // Orange on orange is nothing, so on the edit ground the filled
              // part of the line becomes the ink — the same swap the key chip
              // makes.
              style={{ width: `${progress}%`, background: editing ? EDIT_INK : 'var(--color-brand)' }}
            />
          </div>
        )}

        {/* Element 8b's setlist bar, when it's on. ABOVE the title row, inside
            the same sticky block: SET / HEADER / STRUCTURE. */}
        {aboveBar}

        {/* py-1, not py-1.5 — see BAR_BUTTON on where the height actually comes
            from. */}
        <div className="wide-container flex items-center gap-1.5 py-1.5 sm:py-1">
        {/* ONE cluster, not three separate buttons (owner, 2026-08-03: the
            icons "are a bit too big and they are too separate"). At 36px with
            an 8px gap they read as three unrelated controls; 32px with a 2px
            gap reads as one group of tools, and gives 24px back to the title. */}
        <span className="shrink-0 flex items-center gap-0.5">
          {(onMenu || editing) && (
            <IconButton
              size="sm"
              className={BAR_BUTTON}
              aria-label="Display options"
              // Dead, not GONE. Dropping the button while editing would change
              // the bar's shape the moment you press edit and everything else
              // would jump left.
              disabled={!onMenu}
              onClick={(e) => {
                // Read the rect synchronously: React nulls currentTarget once
                // the handler returns, so a lazy state updater would see null.
                onMenu?.(e.currentTarget.getBoundingClientRect());
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {tools}
        </span>

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

        {/* You cannot walk out of edit mode through the exit (owner,
            2026-08-03: "it should not allow me to leave while I have the editor
            open"). Leaving mid-edit stranded the change — applied, but with no
            way back to Cancel it. Finish or discard first; both are one tap
            away in the edit row. */}
        {onExit && (
          <IconButton
            size="sm"
            className={BAR_BUTTON}
            aria-label="Exit"
            disabled={exitDisabled}
            title={exitDisabled ? 'Finish editing first' : undefined}
            onClick={onExit}
          >
            <CloseIcon />
          </IconButton>
        )}
        </div>
      </div>

      {/* The song map, on the chart's own paper in every mode. */}
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
