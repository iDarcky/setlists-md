import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { dayLabel as longDay, parseTime, typeTime } from '@/lib/newSetlist';

// Our own small date and time pickers (canvas → New setlist, NS1Pick), so
// "Other…" looks the same on every phone instead of the system wheels.

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (date) => new Date(`${date}T12:00:00`);

/** A chip row value: one tap picks it. */
export function Chip({ on, dashed, children, className, ...p }) {
  return (
    <button type="button" aria-pressed={on} {...p}
      className={cn('flex h-9 min-h-0 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-3.5 font-sans text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-link bg-selected text-foreground' : dashed ? 'border-dashed border-input bg-transparent text-muted-foreground' : 'border-border bg-card text-foreground',
        className)}>
      {children}
    </button>
  );
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A month, Monday first, with `marked` weekday (0 = Sunday) dotted. */
export function DateSheet({ open, onOpenChange, title = 'Date', value, marked = null, onPick }) {
  const start = value ? dayOf(value) : new Date();
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const [pick, setPick] = useState(value || '');
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(month); d.setDate(1 - lead + i); return d; });
  const today = ymd(new Date());
  const step = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto max-h-[92dvh] sm:max-w-[420px]">
      <div className="flex flex-col gap-3 font-sans">
        <div className="flex items-center justify-between">
          <b className="text-[15px] font-semibold">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
          <span className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => step(-1)}>‹</Button>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => step(1)}>›</Button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEK.map((w, i) => <span key={i} className="h-6 text-[11px] text-muted-foreground">{w}</span>)}
          {cells.map(d => {
            const k = ymd(d);
            const out = d.getMonth() !== month.getMonth();
            const on = k === pick;
            const dot = marked != null && d.getDay() === marked && !out;
            return (
              <button key={k} type="button" onClick={() => setPick(k)} aria-pressed={on} aria-label={longDay(k)}
                className={cn('relative flex h-10 min-h-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent font-sans text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'bg-link font-semibold text-background' : out ? 'text-input' : k < today ? 'text-muted-foreground' : 'text-foreground')}>
                {d.getDate()}
                {dot && <span className={cn('absolute bottom-1 size-1 rounded-full', on ? 'bg-background' : 'bg-link')} />}
              </button>
            );
          })}
        </div>
        <Button className="h-11" disabled={!pick} onClick={() => onPick(pick)}>{pick ? longDay(pick) : 'Pick a day'}</Button>
      </div>
    </Sheet>
  );
}

/** Tap the hour, then the minutes. */
export function TimeSheet({ open, onOpenChange, title = 'Time', value, onPick }) {
  const [h0, m0] = (value || '10:00').split(':');
  const [h, setH] = useState(Number(h0) || 10);
  const [m, setM] = useState(Number(m0) || 0);
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const mins = [0, 15, 30, 45];
  const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto max-h-[92dvh] sm:max-w-[420px]">
      <div className="flex flex-col gap-3 font-sans">
        <div className="grid grid-cols-4 gap-2">
          {hours.map(x => <Chip key={x} on={x === h} className="justify-center" onClick={() => setH(x)}>{String(x).padStart(2, '0')}</Chip>)}
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
          {(mins.includes(m) ? mins : [...mins, m].sort((a, b) => a - b)).map(x => <Chip key={x} on={x === m} className="justify-center" onClick={() => setM(x)}>:{String(x).padStart(2, '0')}</Chip>)}
        </div>
        <Button className="h-11" onClick={() => onPick(val)}>{val}</Button>
      </div>
    </Sheet>
  );
}

/** A time typed on the keyboard: tap, type 1030, done. Tidied on blur. */
export function TimeInput({ value, onChange, className, ...p }) {
  const [text, setText] = useState(value || '');
  const [bad, setBad] = useState(false);
  const commit = () => {
    if (!text.trim()) { setBad(false); onChange(''); return; }
    const v = parseTime(text);
    if (v) { setText(v); setBad(false); onChange(v); } else setBad(true);
  };
  return (
    <input type="text" inputMode="numeric" autoComplete="off" placeholder="10:00" maxLength={5} value={text} aria-invalid={bad || undefined}
      onChange={e => { setText(typeTime(e.target.value, text)); setBad(false); }} onBlur={commit}
      // Tapping a filled box selects it, so typing replaces the old time.
      onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={cn('h-10 w-[88px] rounded-control border bg-transparent px-3 font-mono text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        bad ? 'border-danger' : 'border-input', className)} {...p} />
  );
}
