import { serviceColor } from '@/lib/services';
import { DOW, parseDate } from './scheduleFormat';

// Small pieces the services Schedule screens share (MyDates, PlanList,
// Schedule). Sizes follow the "Schedule and services" canvas.

export function Dot({ color, size = 8 }) {
  return <span aria-hidden="true" className="rounded-full shrink-0" style={{ width: size, height: size, background: serviceColor(color) }} />;
}

export function Pill({ bg, fg, children }) {
  return <span className="shrink-0 text-label-12 font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color: fg }}>{children}</span>;
}

/** The 48px day block every list row starts with. */
export function DayBlock({ date }) {
  const d = parseDate(date);
  return (
    <span className="w-12 shrink-0 flex flex-col items-center py-1.5 rounded-xl bg-[var(--modes-surface-strong)]">
      <span className="text-label-11 uppercase font-semibold text-[var(--modes-text-muted)]">{DOW[d.getDay()]}</span>
      <span className="text-[20px] leading-[22px] font-bold text-[var(--modes-text)]">{d.getDate()}</span>
    </span>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-label-13 font-semibold uppercase tracking-[0.06em] text-[var(--modes-text-muted)]">{children}</span>
      {right && <span className="text-label-13 text-[var(--modes-text-muted)]">{right}</span>}
    </div>
  );
}
