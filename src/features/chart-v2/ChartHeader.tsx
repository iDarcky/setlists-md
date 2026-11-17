import { X } from 'lucide-react';

interface Props {
  title: string;
  songKey?: string;
  tempo?: number | string;
  time?: string;
  onClose: () => void;
}

/**
 * Header C (owner, 2026-11-18): the title centred, Key · BPM · Time as three
 * small pills under it, and the ✕ that stays even live. No "2 of 6 ·
 * Practice" line: where you are in the set is the footer's job.
 */
export function ChartHeader({ title, songKey, tempo, time, onClose }: Props) {
  const pills: Array<{ text: string; gold?: boolean; label: string }> = [];
  if (songKey) pills.push({ text: `Key ${songKey}`, gold: true, label: `Key ${songKey}` });
  if (Number(tempo) > 0) pills.push({ text: `${tempo} BPM`, label: `${tempo} beats per minute` });
  if (time) pills.push({ text: String(time), label: `Time ${time}` });
  return (
    <header className="flex h-16 items-center gap-0.5 px-1.5">
      {/* Balances the ✕ so the title is centred on the screen, not on what is left. */}
      <span aria-hidden className="size-11 shrink-0" />
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

/** The songs of the set, above the header; it scrolls away with it. */
export function SetlistBar({ titles, current, onPick }: { titles: string[]; current: number; onPick: (i: number) => void }) {
  return (
    <nav aria-label="Songs in this setlist" className="flex gap-1 overflow-x-auto px-2.5 pt-1.5 [scrollbar-width:none]">
      {titles.map((t, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-current={i === current ? 'true' : undefined}
          className={`inline-flex h-[30px] shrink-0 items-center rounded-control px-2.5 text-[13px] ${i === current ? 'bg-raised font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}
        >
          {t}
        </button>
      ))}
    </nav>
  );
}
