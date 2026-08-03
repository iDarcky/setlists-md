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
