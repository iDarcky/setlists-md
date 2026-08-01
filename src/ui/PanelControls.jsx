import { CHART_FONTS, CHART_COLOR_PALETTE } from '@/data/chartThemes';

/**
 * The small controls that settings panels are built out of.
 *
 * Extracted from `AaMenu` when the reader grew its own ☰ menu: the two panels
 * share a visual language, and two private copies of a stepper drift within a
 * release. Nothing here holds state — every control is value + onChange.
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

/** A labelled row of `Pick`s bound to one setting key. */
export function PickRow({ label, options, value, onChange }) {
  return (
    <>
      <Label>{label}</Label>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(([v, l]) => (
          <Pick key={v} active={value === v} onClick={() => onChange(v)}>{l}</Pick>
        ))}
      </div>
    </>
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

/** An on/off switch for a single boolean setting. */
export function Switch({ checked, onChange, label, description }) {
  return (
    <button
      type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
      className="w-full min-h-0 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)] text-left cursor-pointer hover:border-[var(--border-3)] transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-label-13 font-medium text-[var(--text-1)]">{label}</span>
        {description && <span className="block text-copy-13 text-[var(--text-2)] mt-0.5">{description}</span>}
      </span>
      <span
        className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors"
        style={{ background: checked ? 'var(--color-brand)' : 'var(--border-2)' }}
      >
        <span
          className="block w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'none' }}
        />
      </span>
    </button>
  );
}
