import { forwardRef } from 'react';
import { IconButton } from '@/ui/IconButton';
import { BAR_BUTTON, EDIT_ACCENT, EDIT_INK, EDIT_CHROME, SAFE_TOP } from './readerChrome';

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
    // Tapping the title unfolds the song's own facts under the ribbon. Null on
    // any surface that has nothing to unfold — see the title block below.
    onTitleTap = null, infoOpen = false,
    // Painted INTO the sticky block's top-right corner, outside the layout —
    // so it costs the title not one pixel. The reader's live fold is the only
    // user; see `LiveFold`.
    cornerMark = null,
    aboveBar = null, editing = false, exitDisabled = false, exitLabel = 'Exit', progress = null, children,
    // Element 28: the ☰ LIGHTS UP while its menu is open — the same treatment
    // element 12's practice icon uses. It was briefly a ✕ (the owner's first
    // idea), which put two ✕ in one bar: the menu's on the left and Exit on
    // the right, same glyph, opposite meanings, next to a control whose whole
    // rule is "a mis-tap on the right-hand edge leaves the service". Owner,
    // 2026-08-04, on seeing that: *"let's do the lighting up like the practice
    // icon"*. The docked menu has no drag and no scrim, so this button is
    // still the way out of it — it just doesn't pretend to be an exit.
    menuOpen = false,
    // True where the open panel leaves the ☰ reachable (the desktop/landscape
    // side panel). The ☰ then shows an ✕ and the panel drops its own.
    menuClosesInPlace = false,
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
        // ⚠ The status bar of an INSTALLED app is painted OVER this. In a
        // browser tab the inset is 0 and this is a no-op, which is why it went
        // unnoticed until the owner ran the installed app on an iPad — see
        // `SAFE_TOP`. It is padding on the sticky block itself, so the bar's
        // background fills the strip rather than leaving the status bar over
        // bare chart.
        paddingTop: SAFE_TOP,
        // ⚠ NO `position` here. This block is `sticky top-0`, and `sticky` is
        // already a positioned element — an absolutely-positioned child
        // resolves against it for free. Adding `position: relative` to "make
        // the corner mark work" would OVERRIDE the sticky and un-pin the whole
        // header, which is the kind of change that looks fine in a screenshot
        // and only shows up when you scroll.
      }}
    >
      {cornerMark}
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
          {onMenu && (
            <IconButton
              size="sm"
              className={BAR_BUTTON}
              aria-label={menuOpen ? 'Close display options' : 'Display options'}
              aria-expanded={menuOpen}
              style={menuOpen ? { color: 'var(--chord)' } : undefined}
              // ⚠ The reader passes `onMenu = null` while editing, so this is
              // absent there — not disabled. See `Reader`.
              onClick={(e) => {
                // Read the rect synchronously: React nulls currentTarget once
                // the handler returns, so a lazy state updater would see null.
                onMenu?.(e.currentTarget.getBoundingClientRect());
              }}
            >
              {/* ⚠ The ☰ BECOMES an ✕ while the panel is open (owner,
                  2026-08-21: *"the ☰ should transform in an X or something and
                  we should remove the x next to the tabs"*).

                  It has always been a toggle; it just did not look like one, so
                  the panel carried a second close control beside its tabs to
                  say what the ☰ was already doing. One control, two states, and
                  the thing you opened it with is the thing you close it with.
                  `menuClosesInPlace` is set only where the ☰ stays reachable
                  from the open panel — the desktop/landscape side panel —
                  because on the phone dock the ☰ is a full screen away from the
                  thumb, which is why that dock keeps its own chevron. */}
              {menuOpen && menuClosesInPlace ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          )}
          {tools}
        </span>

        {/* Title and meta are ONE group that takes the leftover width, so the
            title can never be squeezed to nothing and the key stays beside it
            rather than out by the exit — the key is the only live control here
            and a mis-tap next to ✕ leaves the service. */}
        <span className="min-w-0 flex items-center gap-2.5">
          {/* ── The title opens the song's own panel ──────────────────────
              Owner, 2026-08-21: *"The tap target should be the title
              everywhere"*. It was the widest, safest thing in the bar and it
              did nothing at all; "what is this song" is what a title is for,
              so the panel costs no new chrome and needs no icon to explain it.
              `SongInfoSheet` says what is in it and why it is not `SongDetails`.

              A <button> only when there is somewhere to go — a title styled as
              a control that does nothing is READER.md's trap 23, and this bar
              is rendered on the shared-link surface too. */}
          {(() => {
            const titleStyle = {
              // Explicit colour and a real flex basis: inheriting the colour
              // and shrinking from `auto` are both ways this has vanished.
              color: 'var(--chart-text, #111111)',
              // Never grow: growing is what pushed the key over to the ✕.
              flex: '0 1 auto',
              minWidth: '3rem',
              maxWidth: '22rem',
            };
            if (!onTitleTap) {
              return <span className="truncate text-label-14 font-semibold" style={titleStyle}>{title}</span>;
            }
            // ── Saying that it is a control ──────────────────────────
            // Owner, 2026-08-23: *"How do we hint to the user that they can
            // tap on the title?"* — and the honest answer was that we did not.
            // It was a `<button>` that looked exactly like the `<span>` in the
            // branch above it: same weight, same colour, same everything. The
            // only hint was a `title` attribute, which a tablet has no pointer
            // to hover with.
            //
            // A CARET, and specifically the key pill's caret — same glyph, same
            // 13px, three inches to the right in this same row. The bar already
            // teaches "a caret means this opens"; borrowing it costs the reader
            // no new vocabulary, and consistency inside one row of chrome beats
            // inventing a second mark for the same idea.
            //
            // ⚠ NOT an ⓘ, and not an underline. An info glyph is a new icon in
            // a bar that element 1 says takes no additions, and an underline
            // reads as a hyperlink — the one thing in a native-feeling reader
            // that says "this is a web page".
            //
            // The price, measured: 17px off a TRUNCATING title (13px glyph +
            // the 4px gap), at 390px and at 1024px alike — about a character
            // and a half. A title with room to spare loses 1px. That is what
            // the smallest honest affordance costs in the row that has least to
            // give.
            //
            // It ROTATES on `aria-expanded`, which the button was already
            // setting. That is what makes it self-explaining rather than
            // decorative: closed it points down at the panel that will appear,
            // open it points back at the title that closes it.
            //
            // ⚠ `shrink-0`, and OUTSIDE the truncating span. Inside it, the
            // caret is the first thing an ellipsis eats — so on the phone,
            // where the hint is needed most, it would be the width that
            // disappears.
            return (
              <button
                type="button"
                onClick={onTitleTap}
                // A disclosure, not a dialog opener: it toggles a row of this
                // same block, so it says so to a screen reader too.
                aria-expanded={infoOpen}
                aria-label={`${title} — song info`}
                title="Song info"
                className="min-h-0 flex items-center gap-1 bg-transparent border-none p-0 text-left cursor-pointer"
                style={titleStyle}
              >
                <span className="truncate text-label-14 font-semibold">{title}</span>
                <svg
                  className="shrink-0 transition-transform duration-200"
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    opacity: 0.5,
                    transform: infoOpen ? 'rotate(180deg)' : 'none',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            );
          })()}
          {meta}
        </span>

        <span className="flex-1" />

        {/* The setlist rail. On the RIGHT (owner, 2026-08-03) — which does bend
            element 1's "nothing goes near the ✕", so it is separated from it by
            the gap and it opens a panel rather than doing anything destructive.
            A mis-tap here costs you a panel, not the service. */}
        {leading}

        {/* ── The right-hand slot: ✕ while reading, the word "Cancel" while
            editing ──────────────────────────────────────────────────────────
            The slot used to be DISABLED in edit mode (owner, 2026-08-03: "it
            should not allow me to leave while I have the editor open"), which
            left dead pixels in the most reachable spot on the screen. The guard
            was right; the answer was wrong. It is Cancel now.

            ⚠ But it is WORDS, not the ✕. The deleted edit bar had already
            settled this: *"only undo is an icon, because the curved arrow is
            universal — everything else is text. 'Which one discards my work' is
            a question no 16px glyph answers."* Keeping ✕ here made the same
            glyph mean "leave the song" and "throw away what you just did"
            depending on a mode, in the one corner where muscle memory is
            strongest. The word costs a few pixels of a bar that carries no
            tools in this mode anyway. */}
        {onExit && (editing ? (
          <button
            type="button"
            onClick={onExit}
            className="min-h-0 h-9 shrink-0 px-3 rounded-lg border text-label-13 font-semibold cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'rgba(255,255,255,0.45)',
              color: '#fff',
            }}
          >
            Cancel
          </button>
        ) : (
          <IconButton
            size="sm"
            className={BAR_BUTTON}
            aria-label={exitLabel}
            disabled={exitDisabled}
            title={exitDisabled ? 'Finish editing first' : undefined}
            onClick={onExit}
          >
            <CloseIcon />
          </IconButton>
        ))}
        </div>
      </div>

      {/* The song map, on the chart's own paper in every mode. */}
      {children}
    </div>
  );
});

function MenuIcon() {
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
