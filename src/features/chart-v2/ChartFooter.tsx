import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  index: number;
  total: number;
  prevTitle?: string;
  nextTitle?: string;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}

/**
 * Previous · "2 / 6" · Next, with how far through the set you are as a 3px
 * bar along its top edge (the old 2px line at the top was too thin to read).
 */
export function ChartFooter({ index, total, prevTitle, nextTitle, onPrev, onNext, onFinish }: Props) {
  const last = index >= total - 1;
  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;
  return (
    <footer className="shrink-0 bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="h-[3px] bg-border" role="progressbar" aria-label="Through the setlist" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1}>
        <div className="h-[3px] bg-link transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex h-[60px] items-center gap-2 px-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          aria-label={prevTitle ? `Previous: ${prevTitle}` : 'Previous song'}
          className="flex h-11 min-w-0 flex-1 basis-0 items-center gap-0.5 px-1 text-[13px] text-muted-foreground disabled:invisible"
        >
          <ChevronLeft size={18} strokeWidth={1.8} className="shrink-0" />
          <span className="truncate">{prevTitle}</span>
        </button>
        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{index + 1} / {total}</span>
        <div className="flex min-w-0 flex-1 basis-0 justify-end">
          <button
            type="button"
            onClick={last ? onFinish : onNext}
            className="flex h-11 min-w-0 items-center gap-1 rounded-[10px] bg-raised pr-2 pl-3 text-[13px] text-foreground"
          >
            <span className="flex min-w-0 flex-col items-end leading-[1.15]">
              <span className="text-[11px] text-muted-foreground">{last ? 'End of set' : 'Next'}</span>
              <span className="max-w-full truncate font-semibold">{last ? 'Finish' : nextTitle}</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.8} className="shrink-0" />
          </button>
        </div>
      </div>
    </footer>
  );
}
