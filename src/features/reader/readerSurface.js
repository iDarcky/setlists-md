/**
 * The reader's two surfaces, as style objects.
 *
 * Extracted 2026-08-03 because "the same header everywhere" is not only about
 * which buttons are in the bar — it is about the bar looking the same. The
 * remap below lived inline in `Reader` alone, so `BreakScreen` and
 * `MissingSongScreen` painted their ☰ and ✕ in APP colours on a CHART
 * background: `IconButton`'s ghost variant reads `--ds-gray-700` /
 * `--ds-gray-1000`, and only `Reader` re-pointed those at the chart tokens. On
 * a light chart theme inside a dark app the break's buttons were all but
 * invisible.
 *
 * ⚠ EVERY FALLBACK HERE MUST BE A LITERAL.
 * `--ds-gray-1000: var(--chart-text, var(--ds-gray-1000))` is a dependency
 * cycle, and a cyclic custom property is *invalid at computed-value time* —
 * it becomes **unset for the entire subtree**, taking the title's colour with
 * it. Name a different property, or name a colour. Never itself.
 */

/**
 * A performance surface owns the screen, so it wears the CHART theme and
 * re-maps the app's foreground tokens onto it — the way `StageHeader` does.
 * Without the remap, anything reading `--bg-1` / `--border-1` / `--text-*`
 * (the structure ribbon, most notably) renders in the APP theme, which put
 * dark pills on white paper.
 */
export const chartSurface = {
  // No text selection anywhere in the reader (owner, 2026-08-04: "being a PWA,
  // when you drag, it wants to select a text"). A long press is now a real
  // gesture here — the song map's drag — and on iOS a long press on text raises
  // the selection handles and the callout menu, which fight it and win. Nobody
  // selects lyrics off a chart mid-service; the gesture is worth more than the
  // selection. Inputs opt back in (see `index.css`).
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  background: 'var(--chart-bg, var(--ds-background-100))',
  color: 'var(--chart-text, var(--ds-gray-1000))',
  '--bg-1': 'var(--chart-bg, #ffffff)',
  '--bg-2': 'var(--chart-bg, #ffffff)',
  '--border-1': 'var(--chart-rule, rgba(0,0,0,.14))',
  '--border-3': 'var(--chart-subtle, rgba(0,0,0,.3))',
  '--text-1': 'var(--chart-text, #111111)',
  '--text-2': 'var(--chart-subtle, #6b6b6b)',
  '--ds-gray-1000': 'var(--chart-text, #111111)',
  '--ds-gray-700': 'var(--chart-subtle, #6b6b6b)',
  // The INTERACTION greys, and they are not optional.
  //
  // `IconButton`'s ghost variant hovers to `bg-[var(--ds-gray-200)]`. That one
  // was left out of this remap, so it kept coming from the APP theme: in a dark
  // app on a light chart theme it painted a near-BLACK pill under an icon that
  // (correctly) stayed dark — the icon vanished on hover. Owner, 2026-08-03:
  // "on light mode the hover is black but the icon doesn't change colors to
  // white."
  //
  // Inverting the icon would be the wrong fix — it makes the hover state depend
  // on knowing the pill's brightness. A tint DERIVED from the chart's own text
  // colour is correct in every theme by construction: always a faint wash of
  // the foreground over the chart's background, never a slab.
  '--ds-gray-100': 'color-mix(in srgb, var(--chart-text, #111111) 6%, transparent)',
  '--ds-gray-200': 'color-mix(in srgb, var(--chart-text, #111111) 12%, transparent)',
  '--ds-gray-300': 'var(--chart-rule, rgba(0,0,0,.14))',
  '--ds-gray-400': 'var(--chart-subtle, #6b6b6b)',
};

/**
 * The reader's chrome when it is PORTALED — the ☰ menu, and anything else that
 * renders into `document.body` rather than inside the reader's scroller.
 *
 * Owner, 2026-08-04: the ☰ wears the READER theme, not the app's. A portal
 * escapes the reader's subtree, so it inherits nothing from `chartSurface` and
 * came out app-coloured with two chart-coloured details leaking through it
 * (`--chord` and `--chart-text`, both set on `:root` by `useChartTheme`) — a
 * dark panel with cream details on it, or the reverse.
 *
 * `chartSurface` alone is not enough, because it re-points the tokens the CHART
 * body uses and a panel uses three more. Each addition below is a token the
 * chart never reads and a panel cannot do without.
 *
 * ⚠ Same literal-fallback rule as above. Note also that `hubSurface` points
 * `--chart-bg` back at `--ds-background-100`: applying that and this to the
 * same subtree would be a cycle. It cannot happen — the hub's reader is
 * `embedded`, and `embedded` has no ☰ — but do not "simplify" them together.
 */
export const chartOverlaySurface = {
  ...chartSurface,
  // The panel's own paper. Every panel in the app paints itself
  // `--ds-background-100`, which `chartSurface` does not remap — so the menu
  // stayed app-coloured while everything inside it went chart-coloured.
  '--ds-background-100': 'var(--chart-bg, #ffffff)',
  // `--border-2` resolves through `--ds-gray-500`, and `chartSurface` remaps
  // 100–400 only. Both are set: the raw one so anything reading it follows,
  // the semantic one so the substitution can't be missed.
  '--ds-gray-500': 'color-mix(in srgb, var(--chart-text, #111111) 26%, transparent)',
  '--border-2': 'color-mix(in srgb, var(--chart-text, #111111) 26%, transparent)',
  // Field labels and the muted small print.
  '--ds-gray-600': 'var(--chart-subtle, #6b6b6b)',
  // HOVER, and it is not optional. `chartSurface` maps `--bg-2` onto the
  // chart's own background so the chart body carries no stray fills; inside a
  // panel that makes every hover invisible, because the hover colour and the
  // panel colour become the same value. A faint wash of the chart's own
  // foreground is correct on every theme by construction — the same derivation
  // `--ds-gray-100/200` already use above.
  '--bg-2': 'color-mix(in srgb, var(--chart-text, #111111) 8%, transparent)',
};

/**
 * Embedded (the Song Hub's chart tab, the side peek, the editor preview) the
 * reader wears the APP theme instead — `docs/READER.md`: "a white chart card
 * sitting inside a dark app reads as broken rather than as a stage."
 *
 * `undefined` was NOT enough to undo the stage look: the `--chart-*` tokens
 * live on `:root`, so everything inside kept reading them and the card stayed
 * themed. They have to be re-pointed here.
 */
export const hubSurface = {
  background: 'var(--ds-background-100)',
  color: 'var(--ds-gray-1000)',
  '--chart-bg': 'var(--ds-background-100)',
  '--chart-text': 'var(--ds-gray-1000)',
  '--chart-subtle': 'var(--ds-gray-700)',
  '--chart-rule': 'var(--ds-gray-300)',
};
