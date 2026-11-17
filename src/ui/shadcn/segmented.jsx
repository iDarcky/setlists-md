import { cn } from './utils';

// Two to four choices in one pill (Light / Dark / Auto, Me / Band, Chart / Info).
// Track = raised, 2px inset; the picked one = card fill + hairline + small
// shadow. Text 14 medium on both states so the width never jumps.
//   default: 40px track (settings, sheets)   sm: 32px track (toolbars)
// `fill` stretches to the parent's width with equal parts.
// `tabs` switches the ARIA to tablist/tab for a control that swaps the view.

// eslint-disable-next-line react-refresh/only-export-components
export const segTrack = (size = 'default', fill = false) => cn(
  'shrink-0 gap-0.5 rounded-control bg-raised p-0.5',
  fill ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex',
  size === 'sm' ? 'h-8' : 'h-10',
);

// eslint-disable-next-line react-refresh/only-export-components
export const segItem = (on) => cn(
  'flex h-full min-h-0 min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border-0 px-3 font-sans text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40',
  on ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,.18)]' : 'bg-transparent text-muted-foreground hover:text-foreground',
);

function Segmented({ value, options, onChange, label, size = 'default', fill = false, tabs = false, className, itemClassName }) {
  return (
    <div role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} className={cn(segTrack(size, fill), className)}>
      {options.map((o) => {
        const v = o.value ?? o.id;
        const on = v === value;
        return (
          <button
            key={String(v)}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            aria-checked={tabs ? undefined : on}
            aria-selected={tabs ? on : undefined}
            aria-label={o.aria || undefined}
            title={o.title || undefined}
            disabled={o.disabled}
            onClick={() => onChange?.(v)}
            className={cn(segItem(on), itemClassName)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented };
