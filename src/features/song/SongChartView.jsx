import { cn } from '@/ui/shadcn/utils';
import { BackIcon } from '@/app/navIcons';
import { KeyChip, ArrangementChip, FullIcon } from './SongView';

// "Open chart": the chart on its own screen, with Key ▾ and the arrangement
// still at hand, and ⤢ for full screen (the reader with its ☰, click and
// track). The chart itself is passed in: Song.jsx gives it the Reader, /design
// gives it a sample.

const iconBtn = 'flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

export default function SongChartView({ title, onBack, keyCtl, arrangements = [], arrangementId, onArrangement, onNewArrangement, onFullScreen, children, embedded = false }) {
  return (
    <div data-slot="song-chart" className={cn('flex h-full min-h-0 flex-col bg-background font-sans text-foreground', embedded && 'absolute inset-0')}>
      <div className="mx-auto flex w-full max-w-[1180px] shrink-0 flex-col px-4 sm:px-6">
        <div className="-mx-2.5 flex h-[52px] items-center justify-between gap-1">
          <button type="button" onClick={onBack} className="flex h-11 min-h-0 min-w-0 cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent pl-0.5 pr-2 font-sans text-[15px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-muted-foreground"><BackIcon size={20} /></span><span className="truncate">{title}</span>
          </button>
          {onFullScreen && <button type="button" aria-label="Full screen" onClick={onFullScreen} className={iconBtn}><FullIcon /></button>}
        </div>
        <div className="flex flex-wrap gap-2 pb-3">
          {keyCtl && <KeyChip {...keyCtl} />}
          <ArrangementChip arrangements={arrangements} current={arrangementId} onPick={onArrangement} onNew={onNewArrangement} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1 border-t border-border">{children}</div>
    </div>
  );
}
