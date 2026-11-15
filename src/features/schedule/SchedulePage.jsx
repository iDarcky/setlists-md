import { useState } from 'react';
import { SectionLabel } from '@/ui/shadcn/section-label';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/ui/shadcn/utils';
import { formatClockTime } from '@/lib/dateFormat';
import { ChevronLeftIcon } from '@/app/navIcons';
import { CanYouPlay, AnswerDay } from './CanYouPlay';
import { Segmented } from './ScheduleView';

// Schedule = who plays when (owner, 2026-11-15). Setlists moved to their own
// tab, so this page is only about people: your invites, where you play, your
// availability, and for leaders the Band grid. It opens from Home only.
// Phone: leaders switch Me | Band. From 1024px the two sit side by side.

const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');
const day = (d, opts) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', opts);

const ANSWERS = [
  { value: 'unavailable', label: 'No' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'available', label: 'Yes' },
];

function Label({ children }) {
  return <SectionLabel className="px-0.5">{children}</SectionLabel>;
}

function Invite({ invite, clockFormat, onAnswer }) {
  const [busy, setBusy] = useState(false);
  const { setlist: sl, schedule } = invite;
  const part = [schedule.role, schedule.vocal_part].filter(Boolean).join(' · ');
  const answer = async (value) => {
    setBusy(true);
    try { await onAnswer?.(schedule, value); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-col">
        <span className="text-[14px] font-medium">Can you play {day(sl.date, { weekday: 'short', day: 'numeric', month: 'short' })}?</span>
        <span className="text-[12px] leading-4 text-muted-foreground">{[sl.name || 'Setlist', clock(sl.time, clockFormat), part].filter(Boolean).join(' · ')}</span>
      </div>
      <div role="group" aria-label={`Answer for ${sl.name || 'this setlist'}`} className="grid grid-cols-3 gap-2">
        {ANSWERS.map(a => (
          <button
            key={a.value}
            type="button"
            disabled={busy}
            onClick={() => answer(a.value)}
            className={cn(
              'h-9 min-h-0 cursor-pointer rounded-control border font-sans text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              a.value === 'available' ? 'border-transparent bg-primary text-primary-foreground' : 'border-input bg-transparent text-foreground hover:bg-raised',
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Plays({ plays, clockFormat, onOpen }) {
  return (
    <div className="overflow-hidden rounded-card material-base">
      {plays.map(({ setlist: sl, schedule }) => (
        <button
          key={schedule.id}
          type="button"
          onClick={() => onOpen?.(sl)}
          className="flex w-full min-h-0 cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-3 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex w-10 shrink-0 flex-col items-center leading-none">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">{day(sl.date, { weekday: 'short' })}</span>
            <span className="mt-1 text-[18px] font-semibold">{day(sl.date, { day: 'numeric' })}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-medium">{sl.name || 'Setlist'}</span>
            <span className="text-[12px] leading-4 text-muted-foreground">{[clock(sl.time, clockFormat), schedule.role].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold bg-selected text-link">You play</span>
        </button>
      ))}
    </div>
  );
}

/**
 * @param {object} p
 * @param {boolean} [p.leader]
 * @param {Array<{setlist, schedule}>} p.invites   myAsks()
 * @param {Array<{setlist, schedule}>} p.plays     myServices()
 * @param {Array} [p.canPlay]   canYouPlay() tiles, each with its `setlists`
 * @param {React.ReactNode} p.calendar   My availability, inline
 * @param {React.ReactNode} [p.band]     the Band grid (leaders)
 */
export default function SchedulePage({
  onBack, leader = false, invites = [], plays = [], canPlay, calendar, band = null,
  clockFormat = '12h', onOpen, onAnswer, onAnswerDay, layout = 'auto',
}) {
  const [tab, setTab] = useState('me');
  const [picked, setPicked] = useState(null);
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const showBand = leader && !!band;

  const me = (
    <div className="flex flex-col gap-5">
      {invites.length > 0 && (
        <section aria-label="Can you play?" className="flex flex-col gap-2">
          <Label>Can you play? · {invites.length}</Label>
          <div className="overflow-hidden rounded-card material-base">
            {invites.map(i => <Invite key={i.schedule.id} invite={i} clockFormat={clockFormat} onAnswer={onAnswer} />)}
          </div>
        </section>
      )}
      <CanYouPlay title="Next Sundays" tiles={canPlay} onPick={setPicked} />
      {plays.length > 0 && (
        <section aria-label="You play" className="flex flex-col gap-2">
          <Label>You play</Label>
          <Plays plays={plays} clockFormat={clockFormat} onOpen={onOpen} />
        </section>
      )}
      <section aria-label="My availability" className="flex flex-col gap-2">
        <Label>My availability</Label>
        {calendar}
      </section>
    </div>
  );

  return (
    <div data-slot="schedule" className="bg-background font-sans text-foreground">
      <div className={cn('mx-auto flex w-full flex-col gap-4 px-4 pb-8 pt-1 sm:px-6 sm:pt-6', wide ? 'max-w-[1180px]' : 'max-w-[680px]')}>
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-1 flex min-h-0 w-fit cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent px-1 py-1 font-sans text-[14px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeftIcon />Home
          </button>
        )}
        <h1 className={cn('m-0 font-semibold leading-8 tracking-[-0.5px]', wide ? 'text-[28px]' : 'text-[24px]')}>Schedule</h1>
        {showBand && wide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-6">
            {me}
            <section aria-label="Band" className="flex flex-col gap-2"><Label>Band</Label>{band}</section>
          </div>
        ) : showBand ? (
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'me', label: 'Me' }, { value: 'band', label: 'Band' }]} />
            {tab === 'band' ? band : me}
          </>
        ) : me}
      </div>
      <AnswerDay tile={picked} onClose={() => setPicked(null)} onAnswer={onAnswerDay} clockFormat={clockFormat} />
    </div>
  );
}
