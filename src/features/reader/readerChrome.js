// The reader's chrome constants — sizes and edit mode's palette.
//
// Their own module because `ReaderTopBar` is a component file, and a
// component file that also exports constants breaks Fast Refresh: the
// bundler cannot tell whether a changed export is a component to hot-swap or
// a value something else depends on, so it falls back to a full reload.

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

/** Edit mode's ink — the one foreground that is legible on `EDIT_ACCENT`. */
export const EDIT_INK = '#1a1004';

/**
 * Edit mode's CHROME — the whole sticky block, not a stripe and not one row
 * (owner, 2026-08-04: *"everything should be made orange, the song map and the
 * set as well, right now it looks strange only the header"*).
 *
 * Right, and the intermediate version was worse than either end: an orange
 * title row between a chart-coloured set bar and a chart-coloured ribbon reads
 * as a band that has landed on the header rather than as the header being in a
 * different mode. Chrome in a mode is chrome in a mode all the way down.
 *
 * The earlier attempts failed for a different reason: a `color-mix` wash is a
 * blend of orange with **whatever the chart theme's background is**, so it lands
 * differently on every theme and drags the foreground's contrast with it. This
 * pins BOTH sides — a fixed orange ground and fixed near-black ink — so the
 * contrast ratio is a constant (about 8:1) that no theme can touch.
 *
 * The tokens are re-pointed for the block's subtree, so the title, the icons,
 * the meta, the key chip AND the set bar all read from them without knowing
 * about edit mode — the set bar was already written entirely in `--chart-*`, so
 * it turns orange for free and its current song stays a dark pill.
 *
 * The one thing that does NOT come free is the structure ribbon: its chips
 * carry per-section colours as TEXT on a transparent ground, which is mud on
 * orange. That is handled where the colours are, by `StructureRibbon`'s
 * `accent` prop — the chips fill and take a white hairline instead. It is the
 * reason this was one row for a round.
 *
 * As everywhere else in this file: **every fallback is a literal**, because a
 * custom property inside its own fallback is a cycle and a cyclic property is
 * unset for the whole subtree (`docs/READER.md`).
 */
export const EDIT_CHROME = {
  background: EDIT_ACCENT,
  '--chart-text': EDIT_INK,
  '--chart-subtle': 'rgba(26,16,4,0.72)',
  '--chart-rule': 'rgba(26,16,4,0.30)',
  '--chart-bg': EDIT_ACCENT,
  '--ds-gray-1000': EDIT_INK,
  '--ds-gray-900': EDIT_INK,
  '--ds-gray-700': 'rgba(26,16,4,0.72)',
  '--ds-gray-600': 'rgba(26,16,4,0.72)',
  '--ds-gray-500': 'rgba(26,16,4,0.60)',
  '--ds-gray-400': 'rgba(26,16,4,0.30)',
  '--ds-gray-300': 'rgba(26,16,4,0.30)',
  '--ds-gray-200': 'rgba(26,16,4,0.14)',
  // The key chip fills with `--chord`. Gold on orange is illegible, so in this
  // block it becomes white — the chip keeps its near-black text and reads as a
  // white pill on orange.
  '--chord': '#ffffff',
};
