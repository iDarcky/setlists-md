import { CHART_FONTS, CHART_COLOR_PALETTE } from '@/data/chartThemes';

/**
 * The small controls `AaMenu` is built out of.
 *
 * Extracted from it when the reader grew its own ☰ menu, so the primitives sit
 * beside the design system rather than inside one panel. Nothing here holds
 * state.
 *
 * The reader's `ReaderMenu` used to keep its OWN copies — the concept mockup's
 * tighter geometry (single-line rows, 27px steppers, small segmented pills) —
 * on the reasoning that one set of controls serving both looks would flatten
 * the difference the mockup existed to make. The owner looked at both on a
 * device and picked these (2026-08-04), so the mockup's copies are gone.
 *
 * ## `size`
 *
 * `md` (default) is the song hub's Aa popover: a panel you lean into on a
 * browsing screen. **`lg` is the reader's ☰**, which is read from a music stand
 * at arm's length — owner, 2026-08-04: *"everything is way too small, we need
 * to make everything bigger"*. It is a size, not a theme: same shapes, same
 * colours, more of them.
 */

/** A ± stepper. `unit` is rendered small after the number ('px', '%', …). */
export function Stepper({ value, min, max, onChange, label, unit = 'px', step = 1, size = 'md' }) {
  const lg = size === 'lg';
  const btn = `${lg ? 'w-12 h-11 text-2xl' : 'w-9 h-8 text-lg'} min-h-0 rounded-md text-[var(--text-1)] leading-none disabled:opacity-30 hover:bg-[var(--bg-2)] cursor-pointer disabled:cursor-not-allowed`;
  return (
    <div className="flex items-center justify-between bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-1">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))} className={btn}>−</button>
      <span className={`${lg ? 'text-label-14' : 'text-label-13'} font-mono font-semibold text-[var(--text-1)] tabular-nums`}>
        {value}{unit && <span className={`text-[var(--text-2)] ${lg ? 'text-label-11' : 'text-label-10'} ml-0.5`}>{unit}</span>}
      </span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))} className={btn}>+</button>
    </div>
  );
}

/** A section label. Tight above its control, generous below the one before. */
export function Label({ children }) {
  return <h3 className="text-label-10 uppercase tracking-wider text-[var(--text-2)] mt-4 first:mt-0 mb-2">{children}</h3>;
}

/** One choice in a row of choices. */
export function Pick({ active, onClick, children, size = 'md' }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`${size === 'lg' ? 'px-4 h-11 text-label-13' : 'px-3 h-8 text-label-12'} min-h-0 rounded-lg border font-semibold cursor-pointer transition-colors ${
        active
          ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
          : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'}`}>
      {children}
    </button>
  );
}

export function FontList({ activeId, onPick }) {
  return (
    <div className="flex flex-col gap-1 max-h-44 overflow-y-auto -mx-0.5 px-0.5">
      {CHART_FONTS.map(f => {
        const on = f.id === activeId;
        return (
          <button key={f.id} type="button" onClick={() => onPick(f.id)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${on ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--border-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'}`}>
            <span className="text-label-13 text-[var(--text-1)]" style={{ fontFamily: f.stack }}>{f.name}</span>
            {on && <span className="text-[var(--color-brand)]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * `wrap={false}` puts the palette on ONE scrolling line instead of letting it
 * reflow into three rows. In the reader's ☰ a wrapping palette was the tallest
 * thing on the Style tab (owner, 2026-08-04: *"we need a way to make colors not
 * take that much place"*).
 */
export function Swatches({ activeValue, onPick, size = 'md', wrap = true }) {
  return (
    <div className={`flex ${wrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto no-scrollbar py-1 -my-1'} ${size === 'lg' ? 'gap-2.5' : 'gap-2'}`}>
      {CHART_COLOR_PALETTE.map(c => {
        const on = (c.value || null) === (activeValue || null);
        const isTheme = c.value === null;
        return (
          <button key={c.id} type="button" onClick={() => onPick(c.value)} title={c.name} aria-label={c.name}
            className={`shrink-0 ${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} min-h-0 rounded-full cursor-pointer`}
            // ONE ring, on the edge, and no border.
            //
            // It used to carry a 2px TRANSPARENT border plus a 1px INSET
            // shadow. Backgrounds paint under a transparent border, so the
            // colour filled the whole circle and the hairline landed 2px inside
            // its edge — a ring floating within the swatch rather than around
            // it. Worst on the split "follow the theme" swatch, where the
            // floating ring also cut across the diagonal (owner, 2026-08-04:
            // "every circle has a strange outline, and it is especially evident
            // at the default color that is split"). Same ring language as the
            // theme tiles now: hairline on the edge, or a gap in the panel's own
            // colour and then the brand line.
            style={{
              background: isTheme
                ? 'linear-gradient(135deg, var(--chart-lyric, var(--chart-text, #888)) 50%, var(--chord, #e0b341) 50%)'
                : c.value,
              boxShadow: on
                ? '0 0 0 2px var(--bg-1), 0 0 0 3.5px var(--color-brand)'
                : 'inset 0 0 0 1px var(--border-2)',
            }} />
        );
      })}
    </div>
  );
}

export function ProHint({ children }) {
  return <p className="text-copy-13 text-[var(--text-2)] m-0">{children}</p>;
}
