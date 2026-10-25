import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { churchInitials } from '@/lib/joinLink';
import { formatClockTime } from '@/lib/dateFormat';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { timeAgo } from '@/lib/homeData';
import {
  CalendarIcon, MusicIcon, TeamIcon, ChevronRightIcon, CheckIcon,
  ClockIcon, PinIcon, PlayIcon,
} from '@/app/navIcons';

// Home, built from zero (canvas "Signed out and joining" → Home, v2). Pure
// view: Home.jsx works out the data, /design renders this with samples.
//
// Order, top to bottom (phone): hello + sync, Can you play? (the next five
// Sundays and any ask), Needs you (leaders), Next up, Who can play (leaders),
// Get set up, Recent activity. From 1024px the strip spans the top and the
// leader's lists move to a right column.

const day = (dateStr, opts) => new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', opts);
const shortDate = d => day(d, { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');

function Section({ title, action, children, className }) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      {(title || action) && (
        <div className="flex items-baseline justify-between px-0.5">
          <h2 className="m-0 text-[16px] font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const List = ({ children, className }) => (
  <div className={cn('overflow-hidden rounded-card border border-border bg-card', className)}>{children}</div>
);

const Eyebrow = ({ children, accent }) => (
  <span className={cn('text-[12px] font-semibold uppercase tracking-[0.06em]', accent ? 'text-link' : 'text-muted-foreground')}>{children}</span>
);

const TextLink = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-link hover:underline">
    {children}
  </button>
);

const rowButton = 'flex w-full min-h-14 cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-2.5 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised';

function SyncLine({ sync }) {
  if (!sync) return null;
  const dot = { ok: 'bg-success', pending: 'bg-warning', offline: 'bg-muted-foreground', error: 'bg-danger' }[sync.state] || 'bg-muted-foreground';
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={cn('size-2 rounded-full', dot)} />
      {sync.label}
    </span>
  );
}

// ── Needs you (leaders) ─────────────────────────────────────────────────────

function NeedsYou({ items, onOpen }) {
  if (!items?.length) return null;
  const view = (it) => {
    if (it.kind === 'join') {
      return {
        icon: <TeamIcon />,
        title: it.count === 1 ? '1 person wants to join' : `${it.count} people want to join`,
        sub: it.names.slice(0, 3).join(', ') + (it.names.length > 3 ? '…' : ''),
      };
    }
    const sl = it.setlist;
    const when = shortDate(sl.date);
    if (it.kind === 'noband') return { icon: <CalendarIcon size={20} />, title: `${when} has no band yet`, sub: sl.name || 'Service' };
    return { icon: <MusicIcon size={20} />, title: `${sl.name || 'Service'} has no songs`, sub: when };
  };
  return (
    <Section title="Needs you">
      <List>
        {items.map((it, i) => {
          const v = view(it);
          return (
            <button key={i} type="button" onClick={() => onOpen?.(it)} className={rowButton}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-raised text-link">{v.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{v.title}</span>
                {v.sub && <span className="truncate text-[13px] text-muted-foreground">{v.sub}</span>}
              </span>
              <span className="text-input"><ChevronRightIcon /></span>
            </button>
          );
        })}
      </List>
    </Section>
  );
}

// ── Can you play? ───────────────────────────────────────────────────────────

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

function CanYouPlay({ tiles, onPick }) {
  if (!tiles?.length) return null;
  return (
    <section aria-label="Can you play?" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <Eyebrow>Can you play?</Eyebrow>
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
function AnswerDay({ tile, onClose, onAnswer, clockFormat }) {
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

// ── Next up ─────────────────────────────────────────────────────────────────

function inDays(n) {
  if (n == null) return '';
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

function Faces({ band }) {
  const yes = band.filter(b => b.yes).length;
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex">
        {band.slice(0, 6).map((b, i) => (
          <span
            key={b.id}
            title={b.name}
            className={cn(
              'flex size-[26px] items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold',
              i > 0 && '-ml-1.5',
              b.yes ? 'bg-link text-background' : 'bg-raised text-foreground',
            )}
          >
            {churchInitials(b.name)}
          </span>
        ))}
      </div>
      <span className="text-[13px] text-muted-foreground">{yes} of {band.length} said yes</span>
    </div>
  );
}

function NextUp({ next, leader, clockFormat, onOpen, onMarkReady }) {
  if (!next) return null;
  const { setlist: sl, part, band, days } = next;
  const rehearsal = sl.rehearsalDate
    ? `Rehearsal ${shortDate(sl.rehearsalDate)}${sl.rehearsalTime ? ` · ${clock(sl.rehearsalTime, clockFormat)}` : ''}`
    : null;
  const canMarkReady = leader && onMarkReady && sl.status === 'draft';
  return (
    <section aria-label="Next up" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Next up · {inDays(days)}</Eyebrow>
        {leader && sl.status === 'ready' && (
          <span className="rounded-full bg-selected px-2.5 py-0.5 text-[12px] font-semibold text-link">Ready</span>
        )}
      </div>
      <h2 className="m-0 text-[22px] font-semibold leading-7 tracking-[-0.4px]">{sl.name || 'Service'}</h2>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[14px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><ClockIcon />{shortDate(sl.date)}{sl.time ? ` · ${clock(sl.time, clockFormat)}` : ''}</span>
        {sl.location && <span className="inline-flex items-center gap-1.5"><PinIcon />{sl.location}</span>}
        {rehearsal && <span className="inline-flex items-center gap-1.5"><CalendarIcon size={16} />{rehearsal}</span>}
      </div>
      {part && <div><span className="inline-flex h-[26px] items-center rounded-full bg-selected px-2.5 text-[13px] font-semibold">You: {part}</span></div>}
      {leader && band?.length > 0 && <Faces band={band} />}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onOpen?.(sl)}><PlayIcon />Open setlist</Button>
        {canMarkReady && <Button variant="outline" className="flex-1" onClick={() => onMarkReady(sl)}>Mark ready</Button>}
      </div>
    </section>
  );
}

// ── Who can play (leaders) ──────────────────────────────────────────────────

function WhoCanPlay({ rows, onOpen, onOpenSchedule }) {
  if (!rows?.length) return null;
  const pct = (n, t) => (t ? `${(n / t) * 100}%` : '0%');
  return (
    <Section title="Who can play" action={onOpenSchedule && <TextLink onClick={onOpenSchedule}>Schedule</TextLink>}>
      <List>
        {rows.map(r => (
          <button key={r.setlist.id} type="button" onClick={() => onOpen?.(r.setlist)} className={cn(rowButton, 'flex-col items-stretch gap-2 py-3')}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-semibold">{shortDate(r.setlist.date)} · {r.setlist.name || 'Service'}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground">{r.total - r.noAnswer} of {r.total} answered</span>
            </span>
            <span className="flex h-2 w-full overflow-hidden rounded-full bg-raised" aria-hidden="true">
              <span className="h-full bg-link" style={{ width: pct(r.yes, r.total) }} />
              <span className="h-full bg-warning-text" style={{ width: pct(r.maybe, r.total) }} />
              <span className="h-full bg-danger" style={{ width: pct(r.no, r.total) }} />
            </span>
            <span className="flex flex-wrap gap-x-2.5 text-[12px] text-muted-foreground">
              <span><b className="font-semibold text-foreground">{r.yes}</b> yes</span>
              <span><b className="font-semibold text-foreground">{r.maybe}</b> maybe</span>
              <span><b className="font-semibold text-foreground">{r.no}</b> no</span>
              <span><b className="font-semibold text-foreground">{r.noAnswer}</b> no answer</span>
            </span>
          </button>
        ))}
      </List>
    </Section>
  );
}

// ── Get set up / nothing planned / recent activity ─────────────────────────────

function GetSetUp({ items }) {
  if (!items?.length || items.every(i => i.done)) return null;
  const done = items.filter(i => i.done).length;
  return (
    <Section title="Get set up" action={<span className="text-[13px] text-muted-foreground">{done} of {items.length}</span>}>
      <List>
        {items.map(it => (
          <button key={it.id} type="button" disabled={it.done} onClick={it.onClick} className={cn(rowButton, 'disabled:cursor-default disabled:hover:bg-transparent')}>
            <span className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]', it.done ? 'border-link bg-link text-background' : 'border-input')}>
              {it.done && <CheckIcon size={14} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-medium">{it.label}</span>
              {it.hint && !it.done && <span className="text-[13px] text-muted-foreground">{it.hint}</span>}
            </span>
            {!it.done && <span className="text-input"><ChevronRightIcon /></span>}
          </button>
        ))}
      </List>
    </Section>
  );
}

function NothingPlanned({ onBrowse }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-7 text-center">
      <h2 className="m-0 text-[17px] font-semibold">Nothing planned for you yet</h2>
      <p className="m-0 max-w-[340px] text-[15px] leading-[21px] text-muted-foreground">When a leader asks you to play, it shows up here. You can still open any song.</p>
      {onBrowse && <Button variant="outline" className="mt-2 w-full max-w-[340px]" onClick={onBrowse}>Browse songs</Button>}
    </section>
  );
}

function Activity({ items, now, onOpen, onOpenSongs }) {
  if (!items?.length) return null;
  return (
    <Section title="Recent activity" action={onOpenSongs && <TextLink onClick={onOpenSongs}>Songs</TextLink>}>
      <List>
        {items.map(it => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', it.actor === 'You' ? 'bg-selected text-link' : 'bg-raised text-foreground')}
              >
                {churchInitials(it.actor)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px]">
                  <span className="font-medium">{it.actor}</span>
                  <span className="text-muted-foreground"> {it.verb}</span>
                  {it.object && <span className={cn('font-medium', it.removed && 'line-through decoration-muted-foreground')}> {it.object}</span>}
                </span>
                <span className="text-[12px] text-muted-foreground">{timeAgo(it.at, now)}</span>
              </span>
            </>
          );
          const canOpen = onOpen && !it.removed && it.kind !== 'member';
          return canOpen ? (
            <button key={it.id} type="button" onClick={() => onOpen(it)} className={rowButton}>{body}</button>
          ) : (
            <div key={it.id} className={cn(rowButton, 'cursor-default hover:bg-transparent')}>{body}</div>
          );
        })}
      </List>
    </Section>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {string} p.name                 first name for "Hi …"
 * @param {string} p.dateLabel            "Sunday, 25 October"
 * @param {{state, label}} [p.sync]
 * @param {boolean} [p.leader]
 * @param {Array} [p.needs]               from needsYou()
 * @param {Array} [p.canPlay]             from canYouPlay(), each with its `setlists`
 * @param {object} [p.next]               { setlist, part, band, days }
 * @param {Array} [p.whoCanPlay]          from whoCanPlay()
 * @param {Array} [p.setup]               [{ id, label, hint, done, onClick }]
 * @param {Array} [p.activity]            from recentActivity() / activityFromSongs()
 * @param {boolean} [p.showNothingPlanned]
 */
export default function HomeView({
  name, dateLabel, sync, leader = false, clockFormat = '12h',
  needs, onNeed, canPlay, onAnswerDay, next, onOpenSetlist, onMarkReady,
  whoCanPlay, onOpenSchedule, setup, activity, now, onOpenActivity, onOpenSongs,
  showNothingPlanned = false, embedded = false, layout = 'auto',
}) {
  // One tree, picked by width (rendering both and hiding one would mount the
  // answer sheet twice). `layout` pins it for /design's frames.
  const [picked, setPicked] = useState(null);
  const wideScreen = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'auto' ? wideScreen : layout === 'wide';
  const hello = (
    <header className="flex flex-col gap-0.5 pb-1">
      <h1 className={cn('m-0 font-semibold', wide ? 'text-[32px] leading-10 tracking-[-1px]' : 'text-[24px] leading-8 tracking-[-0.5px]')}>Hi {name}</h1>
      <div className="flex flex-wrap items-center gap-x-2 text-[14px] text-muted-foreground">
        <span>{dateLabel}</span>
        {sync && <><span aria-hidden="true" className="text-border">·</span><SyncLine sync={sync} /></>}
      </div>
    </header>
  );
  const needsEl = leader && <NeedsYou items={needs} onOpen={onNeed} />;
  const canPlayEl = <CanYouPlay tiles={canPlay} onPick={setPicked} />;
  const nextEl = <NextUp next={next} leader={leader} clockFormat={clockFormat} onOpen={onOpenSetlist} onMarkReady={onMarkReady} />;
  const whoEl = leader && <WhoCanPlay rows={whoCanPlay} onOpen={onOpenSetlist} onOpenSchedule={onOpenSchedule} />;
  const setupEl = <GetSetUp items={setup} />;
  const emptyEl = showNothingPlanned && <NothingPlanned onBrowse={onOpenSongs} />;
  const activityEl = <Activity items={activity} now={now} onOpen={onOpenActivity} onOpenSongs={onOpenSongs} />;

  return (
    <div data-slot="home" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full max-w-[1040px] flex-col gap-3 pb-8', wide ? 'px-8 pt-8' : layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-4')}>
        {hello}
        {wide && canPlayEl}
        {wide ? (
          // From 1024px: the service on the left, the leader's lists on the right.
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-5">
            <div className="flex min-w-0 flex-col gap-4">{needsEl}{nextEl}{emptyEl}</div>
            <div className="flex min-w-0 flex-col gap-4">{whoEl}{setupEl}{activityEl}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {canPlayEl}{needsEl}{nextEl}{emptyEl}{whoEl}{setupEl}{activityEl}
          </div>
        )}
      </div>
      <AnswerDay tile={picked} onClose={() => setPicked(null)} onAnswer={onAnswerDay} clockFormat={clockFormat} />
    </div>
  );
}
