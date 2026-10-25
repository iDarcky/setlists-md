import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { toDateStr } from '@/lib/homeData';
import { weekdayLabels, firstDayOffset } from '@/lib/dateFormat';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/navIcons';

// My availability: a month you tap through. Availability is per DAY, so a
// day's answer covers every setlist on it. Pick a day, then Can play / Maybe /
// Can't, or clear it. Dots mark days with a setlist.

const STATUS = [
  { value: 'available', label: 'Can play', cls: 'bg-selected text-link' },
  { value: 'maybe', label: 'Maybe', cls: 'bg-warning/20 text-warning-text' },
  { value: 'unavailable', label: 'Can’t', cls: 'bg-danger/15 text-danger' },
];
const clsFor = (status) => STATUS.find(s => s.value === status)?.cls || '';

export default function AvailabilitySheet({
  open, onOpenChange, mine = {}, busyDates = new Set(), onSet, onClear,
  firstDay = 'sunday', now = Date.now(),
}) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);
  const [month, setMonth] = useState(0); // months from this one
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  const first = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const lead = (first.getDay() - firstDayOffset(firstDay) + 7) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); setPicked(null); } finally { setBusy(false); }
  };
  const navBtn = 'flex size-8 min-h-0 cursor-pointer items-center justify-center rounded-full border border-border bg-transparent p-0 text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setPicked(null); onOpenChange?.(o); }} title="My availability" className="h-auto sm:max-w-[440px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">{title}</span>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" disabled={month <= 0} onClick={() => setMonth(m => m - 1)} className={navBtn}><ChevronLeftIcon /></button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(m => m + 1)} className={navBtn}><ChevronRightIcon /></button>
          </div>
        </div>
        <p className="m-0 text-[14px] text-muted-foreground">Tap a day to say if you can play. Dots are setlists.</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels(firstDay).map((w, i) => (
            <span key={i} className="pb-1 text-[11px] font-semibold text-muted-foreground">{w.slice(0, 1)}</span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`x${i}`} />;
            const date = toDateStr(d);
            const isPast = date < todayStr;
            const status = mine[date];
            return (
              <button
                key={date}
                type="button"
                disabled={isPast}
                aria-pressed={picked === date}
                aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${status ? `, ${STATUS.find(s => s.value === status)?.label}` : ''}${busyDates.has(date) ? ', has a setlist' : ''}`}
                onClick={() => setPicked(date)}
                className={cn(
                  'relative flex h-11 min-h-0 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent font-sans text-[15px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40',
                  status && `${clsFor(status)} font-semibold`,
                  date === todayStr && 'shadow-[inset_0_0_0_1.5px_var(--foreground)]',
                  picked === date && 'shadow-[inset_0_0_0_2px_var(--link)]',
                )}
              >
                {d.getDate()}
                {busyDates.has(date) && <span aria-hidden="true" className="absolute bottom-1.5 size-1 rounded-full bg-muted-foreground" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3.5 text-[12px] text-muted-foreground" aria-hidden="true">
          {STATUS.map(s => (
            <span key={s.value} className="inline-flex items-center gap-1.5"><span className={cn('size-3.5 rounded-[4px]', s.cls)} />{s.label}</span>
          ))}
        </div>
        {picked ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-[14px] font-semibold">
              {new Date(`${picked}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {STATUS.map(s => (
                <Button key={s.value} size="sm" variant={mine[picked] === s.value ? 'default' : 'outline'} disabled={busy} onClick={() => act(() => onSet?.(picked, s.value))}>
                  {s.label}
                </Button>
              ))}
            </div>
            {mine[picked] && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => onClear?.(picked))}>Clear this day</Button>
            )}
          </div>
        ) : (
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>Done</Button>
        )}
      </div>
    </Sheet>
  );
}
