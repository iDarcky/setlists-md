import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/ui/shadcn/page-header';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { Plus, Calendar, CalendarDays, SearchX } from 'lucide-react';
import { Search } from '@/ui/blocks/Search';
import { chipClass } from '@/ui/shadcn/chip';
import { Segmented as Seg2 } from '@/ui/shadcn/segmented';
import { useRevealList } from '@/hooks/useRevealList';
import BackToTop from '@/ui/BackToTop';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { churchInitials } from '@/lib/joinLink';
import { formatClockTime, dateFormatter } from '@/lib/dateFormat';
import { CanYouPlay, AnswerDay } from './CanYouPlay';

// Schedule, built from zero (canvas → Schedule page). Pure view: Schedule.jsx
// works out the rows, /design renders this with samples.
//
// Top: the "Can you play?" strip (next five Sundays + any day you're asked),
// with "All dates" opening My availability.
// Members: every setlist coming up, each with where they stand (You · Keys,
// Asked with Yes/Maybe/No in the row, Can't, Not playing), and My
// availability. Leaders: the same list with band faces and Draft/Ready, and
// filters for what needs people and what is still a draft.

const day = (dateStr, opts) => dateFormatter('en-GB', opts).format(new Date(`${dateStr}T12:00:00`));
const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');

const CHIP = {
  playing: 'bg-selected text-link',
  asked: 'bg-warning-fill text-warning-text',
  maybe: 'bg-warning-fill text-warning-text',
  cant: 'bg-danger-fill text-danger-text',
  not: 'bg-raised text-muted-foreground',
  draft: 'bg-raised text-muted-foreground',
  ready: 'bg-selected text-link',
};
const Chip = ({ kind, children }) => (
  <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold', CHIP[kind])}>{children}</span>
);

function myChip(me) {
  if (me.kind === 'playing') return <Chip kind="playing">{me.part ? `You · ${me.part}` : 'You play'}</Chip>;
  if (me.kind === 'asked') return <Chip kind="asked">Invited</Chip>;
  if (me.kind === 'maybe') return <Chip kind="maybe">Maybe</Chip>;
  if (me.kind === 'cant') return <Chip kind="cant">Can’t</Chip>;
  return <Chip kind="not">Not playing</Chip>;
}

function Faces({ band }) {
  return (
    <span className="flex">
      {band.slice(0, 6).map((b, i) => (
        <span
          key={b.id}
          title={b.name}
          className={cn(
            'flex size-[22px] items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold',
            i > 0 && '-ml-1.5',
            b.yes ? 'bg-link text-background' : 'bg-raised text-foreground',
          )}
        >
          {churchInitials(b.name)}
        </span>
      ))}
    </span>
  );
}

const ANSWERS = [
  { value: 'available', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'unavailable', label: 'No' },
];

function Row({ row, leader, past, clockFormat, onOpen, onAnswer }) {
  const [busy, setBusy] = useState(false);
  const { setlist: sl, me, summary, faces, songCount } = row;
  const meta = [
    clock(sl.time, clockFormat),
    !leader && sl.location,
    songCount ? `${songCount} song${songCount === 1 ? '' : 's'}` : leader && !past ? 'no songs yet' : null,
  ].filter(Boolean).join(' · ');
  const rehearsal = !leader && !past && sl.rehearsalDate
    ? `Rehearsal ${day(sl.rehearsalDate, { weekday: 'short', day: 'numeric', month: 'short' })}${sl.rehearsalTime ? ` · ${clock(sl.rehearsalTime, clockFormat)}` : ''}`
    : null;
  const answer = async (value) => {
    setBusy(true);
    try { await onAnswer?.(me.schedule, value); } finally { setBusy(false); }
  };
  const asked = !leader && !past && me?.kind === 'asked';
  return (
    <div className={cn('flex min-h-14 flex-wrap items-start gap-x-3 gap-y-2 border-t border-border px-4 py-3 first:border-t-0', row.selected && 'bg-selected')}>
      <button
        type="button"
        onClick={() => onOpen?.(sl)}
        className="flex min-h-0 min-w-0 flex-1 cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex w-11 shrink-0 flex-col items-center pt-0.5 leading-none">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">{day(sl.date, { weekday: 'short' })}</span>
          <span className={cn('mt-1 text-[22px] font-semibold tracking-[-0.5px]', past && 'text-muted-foreground')}>{day(sl.date, { day: 'numeric' })}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-semibold">{sl.name || 'Setlist'}</span>
          {meta && <span className="text-small text-muted-foreground">{meta}</span>}
          {rehearsal && <span className="text-small text-muted-foreground">{rehearsal}</span>}
          {leader && !past && (
            summary.total === 0 ? (
              <span className="text-small font-medium text-danger">No band yet{summary.free ? ` · ${summary.free} free that day` : ''}</span>
            ) : (
              <span className="mt-1 flex items-center gap-2">
                <Faces band={faces} />
                <span className="text-small text-muted-foreground">
                  {summary.yes === summary.total ? 'All in' : `${summary.yes} of ${summary.total} said yes`}
                </span>
              </span>
            )
          )}
        </span>
      </button>
      <div className="flex flex-col items-end gap-1.5 pt-0.5">
        {leader ? (!past && <Chip kind={sl.status === 'ready' ? 'ready' : 'draft'}>{sl.status === 'ready' ? 'Ready' : 'Draft'}</Chip>) : (me && (!past || me.kind === 'playing') && myChip(me))}
      </div>
      {asked && (
        <div role="group" aria-label={`Answer for ${sl.name || 'this setlist'}`} className="flex basis-full gap-1.5 pl-14">
          {ANSWERS.map(a => (
            <button
              key={a.value}
              type="button"
              disabled={busy}
              onClick={() => answer(a.value)}
              className="h-8 min-h-0 cursor-pointer rounded-full border border-input bg-card px-3 font-sans text-small font-semibold text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Segmented({ value, options, onChange }) {
  return <Seg2 tabs fill value={value} options={options} onChange={onChange} />;
}

// The first `n` rows across the month groups, months kept whole up to the cut.
function cutGroups(groups, n) {
  const out = [];
  let left = n;
  for (const g of groups) {
    if (left <= 0) break;
    out.push(g.rows.length <= left ? g : { ...g, rows: g.rows.slice(0, left) });
    left -= g.rows.length;
  }
  return out;
}

function FilterChip({ on, onClick, children, count }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={chipClass(on)}
    >
      {children}
      {count > 0 && <span className="text-caption font-semibold text-link">{count}</span>}
    </button>
  );
}

/**
 * @param {object} p
 * @param {boolean} [p.leader]
 * @param {'upcoming'|'past'} p.tab
 * @param {'all'|'needs'|'drafts'} [p.filter]   leaders only
 * @param {{needs:number, drafts:number}} [p.counts]
 * @param {Array<{month, rows}>} p.groups   rows: { setlist, me, summary, faces, songCount }
 * @param {Array} [p.canPlay]   canYouPlay() tiles, each with its `setlists`
 * @param {React.ReactNode} [p.band]   the Band grid, shown on the Band tab
 */
export default function ScheduleView({
  leader = false, tab = 'upcoming', onTab, showBand = false, filter = 'all', onFilter, counts = {},
  groups = [], clockFormat = '12h', onOpen, onAnswer, onNew, onAvailability,
  canPlay, onAnswerDay, band = null, embedded = false, layout = 'auto', onBack,
  title = 'Schedule', newLabel = 'New', searchable = false,
}) {
  // Search (Setlists tab): same Bencho block as Songs, filters by name, place and date.
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const headRef = useRef(null);
  const [headWidth, setHeadWidth] = useState(320);
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setHeadWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const q = query.trim().toLowerCase();
  if (q) {
    groups = groups
      .map(g => ({ ...g, rows: g.rows.filter(r => [r.setlist.name, r.setlist.location, r.setlist.date, g.month].filter(Boolean).join(' ').toLowerCase().includes(q)) }))
      .filter(g => g.rows.length);
  }
  const past = tab === 'past';
  const isBand = tab === 'band' && band;
  const [picked, setPicked] = useState(null);
  // A screenful of rows first, the rest as you scroll: Past grows by a
  // service a week, forever (see useRevealList).
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const { count: shown, more, sentinel } = useRevealList(total, { resetKey: `${tab}|${filter}` });
  const shownGroups = shown >= total ? groups : cutGroups(groups, shown);
  // Same frame as Songs (owner, 2026-11-14: "match them on desktop/tablet as
  // well … songs"): 680px on phones and tablets, 1180px with a 28px title from
  // 1024px, so the title and buttons don't jump when you switch tabs.
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  return (
    <div data-slot="schedule" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      {past && <BackToTop />}
      <div className={cn('mx-auto flex w-full flex-col gap-3 pb-8', wide ? 'max-w-[1180px]' : 'max-w-[680px]', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6')}>
        {/* Pinned while the list scrolls; search and + like Songs and Home.
            Opened from Home, so ← says where Back goes. */}
        <PageHeader ref={headRef} sticky title={title} onBack={onBack} backLabel="Home" wide={layout === 'auto' ? undefined : wide}
          className={layout === 'phone' ? '-mx-4 px-4' : '-mx-4 px-4 sm:-mx-6 sm:px-6'}>
            {searchable && (
              <div data-search="header" className={cn(searchOpen ? cn('absolute inset-y-0 z-10 flex items-center bg-background', layout === 'phone' ? 'inset-x-4' : 'inset-x-4 sm:inset-x-6') : 'shrink-0')}>
                <Search inline keyboard give={30} spring={30} value={query} onValueChange={setQuery} onOpenChange={setSearchOpen}
                  placeholder="Search setlists" width={headWidth} />
              </div>
            )}
            {onAvailability && (
              <Button variant="outline" size="icon" className="size-11 rounded-control" onClick={onAvailability} aria-label="My availability">
                <Calendar size={20} strokeWidth={1.8} aria-hidden="true" />
              </Button>
            )}
            {leader && onNew && <Button size="icon" className="size-11 shrink-0 rounded-control" aria-label={newLabel} onClick={onNew}><Plus size={20} strokeWidth={2} aria-hidden="true" /></Button>}
        </PageHeader>
        {!past && !isBand && <CanYouPlay tiles={canPlay} onPick={setPicked} onAll={onAvailability} />}
        <Segmented
          value={tab}
          onChange={onTab}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            ...(showBand ? [{ value: 'band', label: 'Band' }] : []),
            { value: 'past', label: 'Past' },
          ]}
        />
        {leader && !past && !isBand && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip on={filter === 'all'} onClick={() => onFilter?.('all')}>All</FilterChip>
            <FilterChip on={filter === 'needs'} onClick={() => onFilter?.('needs')} count={counts.needs}>Needs people</FilterChip>
            <FilterChip on={filter === 'drafts'} onClick={() => onFilter?.('drafts')} count={counts.drafts}>Drafts</FilterChip>
          </div>
        )}
        {isBand ? band : groups.length === 0 ? (
          <EmptyState icon={q ? <SearchX strokeWidth={1.8} /> : <CalendarDays strokeWidth={1.8} />}
            title={q ? 'No setlists match' : past ? 'Nothing played yet' : filter !== 'all' ? 'Nothing here' : 'Nothing planned yet'}>
            {q ? 'Try another name, place or date.' : past ? 'Setlists you have played show up here.' : leader ? 'Make a setlist with a date and it shows up here.' : 'When your church plans a setlist, it shows up here.'}
          </EmptyState>
        ) : shownGroups.map(g => (
          <section key={g.month} aria-label={g.month} className="flex flex-col gap-2">
            <h2 className="m-0 px-0.5 pt-1.5 text-label text-muted-foreground">{g.month}</h2>
            <div className="overflow-hidden rounded-card material-base">
              {g.rows.map(r => (
                <Row key={r.setlist.id} row={r} leader={leader} past={past} clockFormat={clockFormat} onOpen={onOpen} onAnswer={onAnswer} />
              ))}
            </div>
          </section>
        ))}
        {!isBand && more && <div ref={sentinel} aria-hidden="true" className="h-px" />}
      </div>
      <AnswerDay tile={picked} onClose={() => setPicked(null)} onAnswer={onAnswerDay} clockFormat={clockFormat} />
    </div>
  );
}
