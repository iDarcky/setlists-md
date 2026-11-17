import { useEffect, useRef, type ReactNode } from 'react';
import { Pause, X } from 'lucide-react';

interface Props {
  title: string;
  songKey?: string;
  tempo?: number | string;
  time?: string;
  onClose: () => void;
  /** Left of the title; the ✕ sits on the right. */
  leading?: ReactNode;
}

/**
 * Header C (owner, 2026-11-18): the title centred, Key · BPM · Time as three
 * small pills under it, and the ✕ that stays even live. No "2 of 6 ·
 * Practice" line: where you are in the set is the footer's job.
 */
export function ChartHeader({ title, songKey, tempo, time, onClose, leading }: Props) {
  const pills: Array<{ text: string; gold?: boolean; label: string }> = [];
  if (songKey) pills.push({ text: `Key ${songKey}`, gold: true, label: `Key ${songKey}` });
  if (Number(tempo) > 0) pills.push({ text: `${tempo} BPM`, label: `${tempo} beats per minute` });
  if (time) pills.push({ text: String(time), label: `Time ${time}` });
  return (
    <header className="flex h-16 items-center gap-0.5 px-1.5">
      {/* Same width as the ✕, so the title is centred on the screen. */}
      {leading ?? <span aria-hidden className="size-11 shrink-0" />}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <h1 className="max-w-full truncate text-body font-semibold text-foreground">{title}</h1>
        {pills.length > 0 && (
          <div className="flex gap-1">
            {pills.map(p => (
              <span
                key={p.text}
                aria-label={p.label}
                className={`inline-flex h-6 items-center rounded-[6px] bg-raised px-2 text-caption font-semibold ${p.gold ? 'text-warning-text' : 'text-foreground'}`}
              >
                {p.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Leave setlist"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground"
      >
        <X size={22} strokeWidth={1.8} />
      </button>
    </header>
  );
}

export interface BarItem { label: string; isBreak: boolean; songKey?: string }

/**
 * The whole set above the header (it scrolls away with it). Songs are
 * numbered and carry their key; moments are not numbered, dashed and italic,
 * so a 9-song set with two moments still reads as 9 songs. The current one is
 * filled and kept in view.
 */
export function SetlistBar({ items, current, onPick }: { items: BarItem[]; current: number; onPick: (i: number) => void }) {
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current]);
  const numbers = items.reduce<number[]>((acc, it) => [...acc, (acc[acc.length - 1] || 0) + (it.isBreak ? 0 : 1)], []);
  return (
    <nav aria-label="Setlist" className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2 pb-1 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_12px,#000_calc(100%-12px),transparent)]">
      {items.map((it, i) => {
        const on = i === current;
        const base = 'flex h-8 min-h-0 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-caption whitespace-nowrap';
        if (it.isBreak) {
          return (
            <button
              key={i} ref={on ? active : undefined} type="button" onClick={() => onPick(i)}
              aria-current={on ? 'true' : undefined} aria-label={`Moment: ${it.label}`}
              className={`${base} border border-dashed italic ${on ? 'border-foreground font-semibold text-foreground' : 'border-border text-muted-foreground'}`}
            >
              <Pause size={11} strokeWidth={2.4} aria-hidden />
              {it.label}
            </button>
          );
        }
        return (
          <button
            key={i} ref={on ? active : undefined} type="button" onClick={() => onPick(i)}
            aria-current={on ? 'true' : undefined}
            className={`${base} border ${on ? 'border-transparent bg-foreground font-semibold text-background' : 'border-border text-foreground'}`}
          >
            <span className={`font-mono font-semibold tabular-nums ${on ? 'text-background' : 'text-muted-foreground'}`}>{String(numbers[i]).padStart(2, '0')}</span>
            {it.label}
            {it.songKey && <span className={`font-mono font-semibold ${on ? 'text-background' : 'text-warning-text'}`}>{it.songKey}</span>}
          </button>
        );
      })}
    </nav>
  );
}
