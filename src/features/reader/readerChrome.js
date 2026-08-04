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

/**
 * Edit mode's TITLE ROW — a real orange header, not a tint (owner, 2026-08-04:
 * *"I don't know if just a line is enough for it. Let's create a special orange
 * header for editing"*).
 *
 * The earlier attempts both failed for the same reason: a `color-mix` wash is a
 * blend of orange with **whatever the chart theme's background is**, so it lands
 * differently on every theme and drags the foreground's contrast with it. This
 * pins BOTH sides — a fixed orange ground and fixed near-black ink — so the
 * contrast ratio is a constant (about 8:1) that no theme can touch.
 *
 * The tokens are re-pointed for the row's subtree, so the title, the icons, the
 * meta and the key chip all read from them without knowing about edit mode. As
 * everywhere else in this file: **every fallback is a literal**, because a
 * custom property inside its own fallback is a cycle and a cyclic property is
 * unset for the whole subtree (`docs/READER.md`).
 *
 * Only the TITLE ROW. The progress line, the set bar and the structure ribbon
 * keep the chart's own background — the ribbon's chips carry section colours
 * that would be mud on orange, and the map is the one thing you are looking at
 * while you edit.
 */
export const EDIT_ROW = {
  background: EDIT_ACCENT,
  '--chart-text': '#1a1004',
  '--chart-subtle': 'rgba(26,16,4,0.72)',
  '--chart-rule': 'rgba(26,16,4,0.30)',
  '--chart-bg': EDIT_ACCENT,
  '--ds-gray-1000': '#1a1004',
  '--ds-gray-700': 'rgba(26,16,4,0.72)',
  '--ds-gray-400': 'rgba(26,16,4,0.30)',
  '--ds-gray-200': 'rgba(26,16,4,0.14)',
  // The key chip fills with `--chord`. Gold on orange is illegible, so in this
  // row it becomes white — the chip keeps its near-black text and reads as a
  // white pill on orange.
  '--chord': '#ffffff',
};
