import { BackIcon } from '@/app/navIcons';
import { cn } from './utils';

// The one page header (owner, 2026-11-15: "make all the pages the same").
// A 56px row: [← back] Title [count] ............ [actions, 44px buttons]
// Title = 24 on a phone, 28 from 1024px; the row is the same height on every
// page so the title and the + sit at the same spot when you switch tabs.
// `sub` (Home's date and sync line) sits UNDER the row, never inside it, so
// it can't push the title up. Tabs (Home, Setlists, Songs) and the pages
// under You (Settings, Schedule) all use it; a song or setlist page keeps its
// big object title, because there the title is the content, not the page.
// `wide` pins 24/28 (the /design preview); left out, the window decides.

function PageHeader({ title, count, sub, onBack, backLabel = 'Back', actions, children, wide, sticky = false, ref, className }) {
  const size = wide === true ? 'text-[28px] leading-9' : wide === false ? 'text-title leading-8' : 'text-title leading-8 lg:text-[28px] lg:leading-9';
  const row = (
    <header
      ref={ref}
      className={cn(
        'relative flex min-h-14 items-center justify-between gap-2 py-1',
        sticky && 'sticky top-0 z-sticky bg-background',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            title={backLabel}
            className="-ml-2.5 flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BackIcon />
          </button>
        )}
        <h1 className={cn('m-0 flex min-w-0 items-baseline gap-2 font-semibold tracking-[-0.5px]', size)}>
          <span className="truncate">{title}</span>
          {count != null && <span className="shrink-0 text-small font-medium tracking-normal text-muted-foreground">{count}</span>}
        </h1>
      </div>
      {(actions || children) && <div className="flex shrink-0 items-center gap-2">{actions}{children}</div>}
    </header>
  );
  if (!sub) return row;
  return (
    <div className="flex flex-col">
      {row}
      <div className="-mt-1 flex flex-wrap items-center gap-x-2 text-small text-muted-foreground">{sub}</div>
    </div>
  );
}

export { PageHeader };
