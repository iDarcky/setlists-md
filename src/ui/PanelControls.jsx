import { CHART_FONTS, CHART_COLOR_PALETTE } from '@/data/chartThemes';

/**
 * The small controls `AaMenu` is built out of.
 *
 * Extracted from it when the reader grew its own ☰ menu, so the primitives sit
 * beside the design system rather than inside one panel. The reader's
 * `ReaderMenu` deliberately does NOT use these: it follows the concept
 * mockup's tighter geometry (single-line rows, 27px steppers, small segmented
 * pills), and forcing one set of controls to serve both looks would flatten the
 * difference the mockup exists to make. Nothing here holds state.
 */

/** A ± stepper. `unit` is rendered small after the number ('px', '%', …). */
export function Stepper({ value, min, max, onChange, label, unit = 'px', step = 1 }) {
  return (
    <div className="flex items-center justify-between bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-1">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-8 min-h-0 rounded-md text-[var(--text-1)] text-lg leading-none disabled:opacity-30 hover:bg-[var(--bg-2)] cursor-pointer disabled:cursor-not-allowed">−</button>
      <span className="text-label-13 font-mono font-semibold text-[var(--text-1)] tabular-nums">
        {value}{unit && <span className="text-[var(--text-2)] text-label-10 ml-0.5">{unit}</span>}
      </span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-9 h-8 min-h-0 rounded-md text-[var(--text-1)] text-lg leading-none disabled:opacity-30 hover:bg-[var(--bg-2)] cursor-pointer disabled:cursor-not-allowed">+</button>
    </div>
  );
}

/** A section label. Tight above its control, generous below the one before. */
export function Label({ children }) {
  return <h3 className="text-label-10 uppercase tracking-wider text-[var(--text-2)] mt-4 first:mt-0 mb-2">{children}</h3>;
}

/** One choice in a row of choices. */
export function Pick({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-3 h-8 min-h-0 rounded-lg border text-label-12 font-semibold cursor-pointer transition-colors ${
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

export function Swatches({ activeValue, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHART_COLOR_PALETTE.map(c => {
        const on = (c.value || null) === (activeValue || null);
        const isTheme = c.value === null;
        return (
          <button key={c.id} type="button" onClick={() => onPick(c.value)} title={c.name} aria-label={c.name}
            className="w-8 h-8 min-h-0 rounded-full cursor-pointer"
            style={{
              background: isTheme
                ? 'linear-gradient(135deg, var(--chart-text, #888) 50%, var(--chord, #e0b341) 50%)'
                : c.value,
              border: '2px solid ' + (on ? 'var(--text-1)' : 'transparent'),
              boxShadow: on ? '0 0 0 2px var(--bg-1), 0 0 0 3px var(--color-brand)' : 'inset 0 0 0 1px var(--border-2)',
            }} />
        );
      })}
    </div>
  );
}

export function ProHint({ children }) {
  return <p className="text-copy-13 text-[var(--text-2)] m-0">{children}</p>;
}
