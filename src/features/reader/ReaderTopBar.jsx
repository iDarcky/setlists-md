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
 * Opting out of the phone floor, but NOT all the way down: **36px on a phone,
 * 32px from `sm:` up** (owner, 2026-08-04: "make the header with everything a
 * couple pixels bigger on mobile"). The two corrections are not in conflict —
 * "too big and too separate" was about the 8px GAPS between three 36px buttons,
 * which is why they went into a 2px cluster. Tightening the cluster is what
 * bought the room to keep the targets comfortable on the device you actually
 * hold. The ☰ and ✕ are still reached between songs, not mid-song — unlike the
 * footer's prev/next, which keep a bigger target because they are hit in the
 * dark (see `ReaderFooter`).
 */
export const BAR_BUTTON = 'min-h-0 h-9 w-9 sm:h-8 sm:w-8 text-[var(--chart-text,var(--ds-gray-1000))]';

/**
 * Edit mode's colour. ORANGE, not the brand (owner, 2026-08-03: *"maybe we can
 * use an orange color for the header, so we know we're doing something"*) —
 * and that is the right instinct: the brand colour is what the app looks like
 * normally, so tinting the chrome with it says "this app" rather than "you are
 * changing something". Orange is not used anywhere else in the reader, which is
 * the whole job.
 *
 * A literal, deliberately: it must read the same against every chart theme, and
 * a token that follows the theme would be washed out by exactly the pale papers
 * where the warning matters most.
 */
export const EDIT_ACCENT = '#f97316';

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
      className="reader-head sticky top-0 z-20 shrink-0 flex flex-col border-b"
      // The brand-tinted divider closes the WHOLE sticky block — bar plus
      // whatever is pinned under it — rather than sitting between the two.
      // Element 2's decision is that the bar and the ribbon are ONE piece of
      // chrome that travels together; a line between them argues the opposite,
      // and it landed as an underline for the song title. The boundary that
      // actually exists is chrome ↔ chart, and this is it. (2026-08-01, after
      // one round with the line in the other place.)
      // Edit mode colours the CHROME rather than adding an element to it: the
      // divider and the wash go ORANGE (see EDIT_ACCENT). Element 1 is fixed
      // and takes no additions, so a mode it can be in has to be a STATE of the
      // bar, not a new thing in it. (Same principle the owner picked for the
      // follow-the-leader indicator, 2026-08-03.)
      style={{
        borderColor: editing
          ? EDIT_ACCENT
          : 'var(--chart-divider, var(--chart-rule, var(--ds-gray-300)))',
        // The BACKGROUND stays the chart's own, in every mode. A tint mixed
        // into it lands differently on every chart theme — 9% orange over cream
        // is nearly invisible and over near-black is muddy — and it drags the
        // title's contrast with it (owner, 2026-08-04: "if we use this opacity
        // it will look different for each theme and some might not be
        // readable"). The mode is carried by SOLID marks instead: the stripe
        // below and the divider, both `EDIT_ACCENT` at full strength, which
        // read identically against every theme because nothing is mixed in.
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      {/* Edit mode's mark: solid, full-strength, and it cannot fail a contrast
          check because it sits ON the background rather than IN it. */}
      {editing && <div className="h-[3px] w-full shrink-0" style={{ background: EDIT_ACCENT }} />}

      {/* How far through the SET you are. It used to belong to
          `ReaderSetlistBar`, so turning the set bar off took the progress with
          it (owner, 2026-08-03). It lives here now — top of the sticky block,
          exactly where it always appeared — so it survives every combination.
          The top, not the bottom nav: two of the four nav styles (pill, swipe)
          have no bottom bar to put it on. */}
      {progress != null && (
        <div className="h-0.5 w-full shrink-0" style={{ background: 'var(--chart-rule, var(--ds-gray-300))' }}>
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${progress}%`, background: editing ? EDIT_ACCENT : 'var(--color-brand)' }}
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
