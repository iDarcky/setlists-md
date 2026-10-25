import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { churchInitials } from '@/lib/joinLink';
import { formatClockTime } from '@/lib/dateFormat';
import { useMediaQuery } from '@/lib/useMediaQuery';
import {
  CalendarIcon, MusicIcon, TeamIcon, ChevronRightIcon, ChevronLeftIcon, CheckIcon,
  ClockIcon, PinIcon, PlayIcon,
} from '@/app/navIcons';

// Home, built from zero (canvas "Signed out and joining" → Home, v2). Pure
// view: Home.jsx works out the data, /design renders this with samples.
//
// Order, top to bottom (phone): hello + sync, Needs you (leaders), Can you
// play?, Next up, your two weeks, Who can play (leaders), Get set up, Latest
// in the library. From 1024px the asks and the leader's lists move to a right
// column.

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
  { value: 'available', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'unavailable', label: 'No' },
];

function Asks({ asks, onAnswer, onOpen, limit = 3 }) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(null);
  if (!asks?.length) return null;
  const shown = all ? asks : asks.slice(0, limit);
  const answer = async (id, value) => {
    setBusy(id);
    try { await onAnswer?.(id, value); } finally { setBusy(null); }
  };
  return (
    <section aria-label="Can you play?" className="overflow-hidden rounded-card border border-link bg-selected">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3.5">
        <Eyebrow accent>Can you play?</Eyebrow>
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-link px-1.5 text-[12px] font-bold text-background">{asks.length}</span>
      </div>
      {shown.map(({ schedule, setlist }) => {
        const part = [schedule.role, schedule.vocal_part].filter(Boolean).join(' · ');
        return (
          <div key={schedule.id} className="flex items-center gap-3 border-t border-border px-4 py-2.5 first-of-type:border-t-0">
            <button type="button" onClick={() => onOpen?.(setlist)} className="flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left font-sans text-foreground">
              <span className="truncate text-[15px] font-semibold">{shortDate(setlist.date)}</span>
              <span className="truncate text-[13px] text-muted-foreground">{[setlist.name, part].filter(Boolean).join(' · ')}</span>
            </button>
            <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Answer for ${shortDate(setlist.date)}`}>
              {ANSWERS.map(a => (
                <button
                  key={a.value}
                  type="button"
                  disabled={busy === schedule.id}
                  onClick={() => answer(schedule.id, a.value)}
                  className="h-9 min-h-0 cursor-pointer rounded-full border border-input bg-card px-3 font-sans text-[14px] font-semibold text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {asks.length > limit && (
        <button type="button" onClick={() => setAll(v => !v)} className="w-full min-h-0 cursor-pointer border-0 border-t border-border bg-transparent px-4 py-3 text-left font-sans text-[14px] font-medium text-link">
          {all ? 'Show fewer' : `See all ${asks.length}`}
        </button>
      )}
    </section>
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

// ── Your two weeks ──────────────────────────────────────────────────────────

function TwoWeeks({ days, offset, onOffset, selected, onSelect, clockFormat, onOpen }) {
  if (!days?.length) return null;
  const sel = days.find(d => d.date === selected) || null;
  const lines = sel
    ? [
        ...sel.services.map(sl => ({ sl, title: sl.name || 'Service', sub: [clock(sl.time, clockFormat), sel.play ? 'You play' : sel.asked ? 'Asked' : null].filter(Boolean).join(' · ') })),
        ...sel.rehearsals.map(sl => ({ sl, title: `Rehearsal · ${sl.name || 'Service'}`, sub: [clock(sl.rehearsalTime, clockFormat), sl.rehearsalLocation].filter(Boolean).join(' · ') })),
      ]
    : [];
  const navBtn = 'flex size-8 min-h-0 cursor-pointer items-center justify-center rounded-full border border-border bg-transparent p-0 text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <section aria-label="Your two weeks" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{offset === 0 ? 'Your next two weeks' : `${shortDate(days[0].date)} – ${shortDate(days[13].date)}`}</Eyebrow>
        <div className="flex gap-1">
          <button type="button" aria-label="Earlier" disabled={offset <= 0} onClick={() => onOffset?.(offset - 1)} className={cn(navBtn, 'disabled:opacity-40')}><ChevronLeftIcon /></button>
          <button type="button" aria-label="Later" onClick={() => onOffset?.(offset + 1)} className={navBtn}><ChevronRightIcon /></button>
        </div>
      </div>
      {[days.slice(0, 7), days.slice(7)].map((week, w) => (
        <div key={w} className="grid grid-cols-7 gap-1">
          {week.map(d => {
            const on = d.date === selected;
            const label = `${d.weekday} ${d.day}${d.play ? ', you play' : d.asked ? ', asked' : ''}${d.services.length || d.rehearsals.length ? '' : ', nothing on'}`;
            return (
              <button
                key={d.date}
                type="button"
                aria-label={label}
                aria-pressed={on}
                onClick={() => onSelect?.(d.date)}
                className={cn(
                  'relative flex h-16 min-h-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[10px] border-0 bg-transparent p-0 font-sans outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  d.isToday && 'bg-raised',
                  d.play && 'bg-selected',
                  d.asked && 'shadow-[inset_0_0_0_1.5px_var(--warning-text)]',
                  on && 'shadow-[inset_0_0_0_2px_var(--foreground)]',
                  d.isPast && 'opacity-45',
                )}
              >
                <span className="text-[11px] font-semibold text-muted-foreground">{d.weekday}</span>
                <span className={cn('text-[17px] font-semibold', d.isToday ? 'text-link' : 'text-foreground')}>{d.day}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    d.play ? 'bg-link' : d.asked ? 'bg-warning-text' : d.services.length || d.rehearsals.length ? 'bg-input' : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>
      ))}
      <div className="flex flex-wrap gap-3.5 text-[12px] text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-selected" />You play</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1.5px_var(--warning-text)]" />Asked</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-input" />Something on</span>
      </div>
      {sel && (
        <div className="-mx-4 flex flex-col border-t border-border">
          {lines.length === 0 ? (
            <p className="m-0 px-4 pt-3 text-[14px] text-muted-foreground">{shortDate(sel.date)}: nothing on.</p>
          ) : lines.map((l, i) => (
            <button key={i} type="button" onClick={() => onOpen?.(l.sl)} className={cn(rowButton, 'min-h-[52px] border-t-0 py-2')}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{shortDate(sel.date)} · {l.title}</span>
                {l.sub && <span className="truncate text-[13px] text-muted-foreground">{l.sub}</span>}
              </span>
              <span className="text-input"><ChevronRightIcon /></span>
            </button>
          ))}
        </div>
      )}
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

// ── Get set up / nothing planned / latest songs ─────────────────────────────

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

function Latest({ songs, onOpenSong, onOpenSongs }) {
  if (!songs?.length) return null;
  return (
    <Section title="Latest in the library" action={onOpenSongs && <TextLink onClick={onOpenSongs}>Songs</TextLink>}>
      <List>
        {songs.map(s => (
          <button key={s.id} type="button" onClick={() => onOpenSong?.(s)} className={rowButton}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">{s.title}</span>
              {s.artist && <span className="truncate text-[13px] text-muted-foreground">{s.artist}</span>}
            </span>
            {s.key && <span className="font-mono text-[13px] font-semibold text-[var(--chord)]">{s.key}</span>}
          </button>
        ))}
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
 * @param {Array} [p.asks]                from myAsks()
 * @param {object} [p.next]               { setlist, part, band, days }
 * @param {object} [p.strip]              { days, offset, onOffset, selected, onSelect }
 * @param {Array} [p.whoCanPlay]          from whoCanPlay()
 * @param {Array} [p.setup]               [{ id, label, hint, done, onClick }]
 * @param {Array} [p.latest]              songs
 * @param {boolean} [p.showNothingPlanned]
 */
export default function HomeView({
  name, dateLabel, sync, leader = false, clockFormat = '12h',
  needs, onNeed, asks, onAnswer, next, onOpenSetlist, onMarkReady,
  strip, whoCanPlay, onOpenSchedule, setup, latest, onOpenSong, onOpenSongs,
  showNothingPlanned = false, embedded = false, layout = 'auto',
}) {
  // One tree, picked by width (rendering both and hiding one would mount the
  // asks' own state twice). `layout` pins it for /design's frames.
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
  const asksEl = <Asks asks={asks} onAnswer={onAnswer} onOpen={onOpenSetlist} />;
  const nextEl = <NextUp next={next} leader={leader} clockFormat={clockFormat} onOpen={onOpenSetlist} onMarkReady={onMarkReady} />;
  const stripEl = strip && <TwoWeeks {...strip} clockFormat={clockFormat} onOpen={onOpenSetlist} />;
  const whoEl = leader && <WhoCanPlay rows={whoCanPlay} onOpen={onOpenSetlist} onOpenSchedule={onOpenSchedule} />;
  const setupEl = <GetSetUp items={setup} />;
  const emptyEl = showNothingPlanned && <NothingPlanned onBrowse={onOpenSongs} />;
  const latestEl = <Latest songs={latest} onOpenSong={onOpenSong} onOpenSongs={onOpenSongs} />;

  return (
    <div data-slot="home" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full max-w-[1040px] flex-col gap-3 pb-8', wide ? 'px-8 pt-8' : layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-4')}>
        {hello}
        {wide ? (
          // From 1024px: the service and your weeks on the left, asks and lists on the right.
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-5">
            <div className="flex min-w-0 flex-col gap-4">{needsEl}{nextEl}{emptyEl}{stripEl}</div>
            <div className="flex min-w-0 flex-col gap-4">{asksEl}{whoEl}{setupEl}{latestEl}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {needsEl}{asksEl}{nextEl}{emptyEl}{stripEl}{whoEl}{setupEl}{latestEl}
          </div>
        )}
      </div>
    </div>
  );
}
