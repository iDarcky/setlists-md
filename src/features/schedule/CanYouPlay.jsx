import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { formatClockTime } from '@/lib/dateFormat';
import { ChevronRightIcon } from '@/app/navIcons';

// The "Can you play?" strip at the top of Schedule: the next five Sundays plus
// any weekday you are asked for (canYouPlay() in scheduleData). Tap a day to
// answer it; "All dates" opens the whole month in My availability.

const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');

const ANSWERS = [
  { value: 'available', label: 'Yes, I can play' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'unavailable', label: 'No, I can’t' },
];

// What the bottom of a tile says. An unanswered ask outranks everything.
function tileState(t) {
  if (t.asks.length) return { label: 'Answer', cls: 'border border-dashed border-input text-muted-foreground' };
  if (t.status === 'unavailable') return { label: 'Can’t', cls: 'bg-danger/15 text-danger' };
  if (t.status === 'maybe') return { label: 'Maybe', cls: 'bg-warning/20 text-warning-text' };
  if (t.playing) return { label: 'Playing', cls: 'bg-link text-background' };
  if (t.status === 'available') return { label: 'Free', cls: 'bg-selected text-link' };
  return { label: 'Tap', cls: 'border border-dashed border-input text-muted-foreground' };
}

export function CanYouPlay({ tiles, onPick, onAll }) {
  if (!tiles?.length) return null;
  return (
    <section aria-label="Can you play?" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Can you play?</span>
        {onAll && (
          <button type="button" onClick={onAll} className="flex min-h-0 cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-link hover:underline">
            All dates<ChevronRightIcon size={16} />
          </button>
        )}
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 pt-2.5 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {tiles.map(t => {
          const st = tileState(t);
          const asked = t.asks.length > 0;
          return (
            <button
              key={t.date}
              type="button"
              onClick={() => onPick?.(t)}
              aria-label={`${t.weekday} ${t.day}${t.names.length ? `, ${t.names.join(' and ')}` : ''}: ${asked ? 'you are asked to play' : st.label}`}
              className={cn(
                'relative flex w-[92px] min-h-0 shrink-0 snap-start cursor-pointer flex-col items-center gap-0.5 rounded-card border border-border bg-card px-2 pb-2 pt-2.5 font-sans text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring',
                asked && 'border-warning-text shadow-[inset_0_0_0_1px_var(--warning-text)]',
              )}
            >
              {asked && (
                <span className="absolute -top-2 left-1/2 flex h-4 -translate-x-1/2 items-center rounded-full bg-warning-text px-1.5 text-[10px] font-bold text-background">Asked</span>
              )}
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">{t.weekday}</span>
              <span className="text-[22px] font-semibold leading-[26px] tracking-[-0.5px]">{t.day}</span>
              <span className="line-clamp-2 h-7 max-w-full text-center text-[11px] leading-[14px] text-muted-foreground">{t.names.join(' + ') || 'Nothing yet'}</span>
              <span className={cn('mt-1.5 flex h-[22px] w-full items-center justify-center rounded-[6px] text-[11px] font-semibold', st.cls)}>{st.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The Yes / Maybe / No sheet for one day. */
export function AnswerDay({ tile, onClose, onAnswer, clockFormat }) {
  const [busy, setBusy] = useState(null);
  const title = tile ? new Date(`${tile.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const answer = async (value) => {
    setBusy(value);
    try { await onAnswer?.(tile, value); onClose(); } finally { setBusy(null); }
  };
  const current = tile && (tile.asks.length ? null : tile.status || (tile.playing ? 'available' : null));
  return (
    <Sheet open={!!tile} onOpenChange={(o) => { if (!o) onClose(); }} title={title} className="h-auto sm:max-w-[420px]">
      {tile && (
        <div className="flex flex-col gap-3">
          {tile.setlists?.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] text-muted-foreground">
              {tile.setlists.map(sl => {
                const ask = tile.asks.find(a => a.setlist.id === sl.id);
                const part = ask ? [ask.schedule.role, ask.schedule.vocal_part].filter(Boolean).join(' · ') : '';
                return (
                  <li key={sl.id}>
                    <span className="font-medium text-foreground">{sl.name || 'Setlist'}</span>
                    {sl.time ? ` · ${clock(sl.time, clockFormat)}` : ''}
                    {ask ? ` · you’re asked${part ? ` for ${part}` : ''}` : ''}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-col gap-2">
            {ANSWERS.map(a => (
              <Button
                key={a.value}
                variant={(current || 'available') === a.value ? 'default' : 'outline'}
                disabled={!!busy}
                aria-pressed={current === a.value}
                onClick={() => answer(a.value)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <p className="m-0 text-[13px] text-muted-foreground">Your answer covers everything on that day.</p>
        </div>
      )}
    </Sheet>
  );
}
