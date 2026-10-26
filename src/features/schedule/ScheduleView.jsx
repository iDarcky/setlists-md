import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { churchInitials } from '@/lib/joinLink';
import { formatClockTime } from '@/lib/dateFormat';
import { CalendarIcon, PlusIcon } from '@/app/navIcons';
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

const day = (dateStr, opts) => new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', opts);
const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');

const CHIP = {
  playing: 'bg-selected text-link',
  asked: 'bg-warning/20 text-warning-text',
  maybe: 'bg-warning/20 text-warning-text',
  cant: 'bg-danger/15 text-danger',
  not: 'bg-raised text-muted-foreground',
  draft: 'bg-raised text-muted-foreground',
  ready: 'bg-selected text-link',
};
const Chip = ({ kind, children }) => (
  <span className={cn('inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold', CHIP[kind])}>{children}</span>
);

function myChip(me) {
  if (me.kind === 'playing') return <Chip kind="playing">{me.part ? `You · ${me.part}` : 'You play'}</Chip>;
  if (me.kind === 'asked') return <Chip kind="asked">Asked</Chip>;
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
    <div className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-border px-4 py-3 first:border-t-0', row.selected && 'bg-selected')}>
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
          <span className="truncate text-[15px] font-semibold">{sl.name || 'Setlist'}</span>
          {meta && <span className="text-[13px] text-muted-foreground">{meta}</span>}
          {rehearsal && <span className="text-[13px] text-muted-foreground">{rehearsal}</span>}
          {leader && !past && (
            summary.total === 0 ? (
              <span className="text-[13px] font-medium text-danger">No band yet{summary.free ? ` · ${summary.free} free that day` : ''}</span>
            ) : (
              <span className="mt-1 flex items-center gap-2">
                <Faces band={faces} />
                <span className="text-[13px] text-muted-foreground">
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
              className="h-8 min-h-0 cursor-pointer rounded-full border border-input bg-card px-3 font-sans text-[13px] font-semibold text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div role="tablist" className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[10px] bg-raised p-[3px]">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange?.(o.value)}
          className={cn(
            'h-[34px] min-h-0 cursor-pointer rounded-[8px] border-0 bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value && 'bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,.2)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterChip({ on, onClick, children, count }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex h-8 min-h-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-3 font-sans text-[13px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on && 'border-transparent bg-selected font-semibold text-foreground',
      )}
    >
      {children}
      {count > 0 && <span className="text-[12px] font-bold text-link">{count}</span>}
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
  canPlay, onAnswerDay, band = null, embedded = false, layout = 'auto',
}) {
  const past = tab === 'past';
  const isBand = tab === 'band' && band;
  const [picked, setPicked] = useState(null);
  return (
    <div data-slot="schedule" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full max-w-[680px] flex-col gap-3 pb-8', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6')}>
        <header className="flex items-center justify-between gap-2 pb-0.5 pt-1">
          <h1 className="m-0 text-[24px] font-semibold leading-8 tracking-[-0.5px]">Schedule</h1>
          <div className="flex gap-2">
            {onAvailability && (
              <Button variant="outline" size="sm" onClick={onAvailability} aria-label="My availability">
                <CalendarIcon size={16} /><span className={cn(leader && onNew && 'sr-only sm:not-sr-only')}>My availability</span>
              </Button>
            )}
            {leader && onNew && <Button size="sm" onClick={onNew}><PlusIcon size={16} />New</Button>}
          </div>
        </header>
        {!past && !isBand && <CanYouPlay tiles={canPlay} onPick={setPicked} onAll={onAvailability} />}
        <Segmented
          value={tab}
          onChange={onTab}
          options={[
            { value: 'upcoming', label: leader ? 'Setlists' : 'Coming up' },
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
          <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-7 text-center">
            <b className="text-[17px]">{past ? 'Nothing played yet' : filter !== 'all' ? 'Nothing here' : 'Nothing planned yet'}</b>
            <p className="m-0 max-w-[320px] text-[15px] leading-[21px] text-muted-foreground">
              {past ? 'Setlists you have played show up here.' : leader ? 'Make a setlist with a date and it shows up here.' : 'When your church plans a setlist, it shows up here.'}
            </p>
          </div>
        ) : groups.map(g => (
          <section key={g.month} aria-label={g.month} className="flex flex-col gap-2">
            <h2 className="m-0 px-0.5 pt-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{g.month}</h2>
            <div className="overflow-hidden rounded-card border border-border bg-card">
              {g.rows.map(r => (
                <Row key={r.setlist.id} row={r} leader={leader} past={past} clockFormat={clockFormat} onOpen={onOpen} onAnswer={onAnswer} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <AnswerDay tile={picked} onClose={() => setPicked(null)} onAnswer={onAnswerDay} clockFormat={clockFormat} />
    </div>
  );
}
