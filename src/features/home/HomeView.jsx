import { useState } from 'react';
import { PageHeader } from '@/ui/shadcn/page-header';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { AnimatePresence, motion as Motion } from 'motion/react';
import {
  Calendar, Check, ChevronLeft, ChevronRight, FileCheck, List, Music, Play, Plus, Users,
} from 'lucide-react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { churchInitials } from '@/lib/joinLink';
import { formatClockTime } from '@/lib/dateFormat';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { timeAgo } from '@/lib/homeData';
import { partLabel } from '@/data/instruments';

// Home, built from zero a second time (components overhaul, canvas "Home from
// zero", owner 2026-11-15). Pure view: Home.jsx works out the data.
//
// Order (owner): the one-time checklist, Next up, Needs you, your two weeks,
// Recent activity. One Home for leaders and members; the leader just sees more
// rows. Who can play went to Schedule → Band, and "What do you play?" became a
// checklist step.
//
// Five text sizes only: 24 title, 18 card title, 16, 14, 12 (the UPPERCASE
// labels). Lucide icons at stroke 1.8. Corners: 8 controls, 12 cards.

const STROKE = 1.8;
const day = (dateStr, opts) => new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', opts);
const shortDate = d => day(d, { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (t, fmt) => (t ? formatClockTime(t, fmt) : '');

// ── Small parts ─────────────────────────────────────────────────────────────

const Label = ({ children, className }) => (
  <h2 className={cn('m-0 text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground', className)}>{children}</h2>
);

function Section({ label, action, children, className }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className="flex h-7 items-center justify-between gap-2 px-0.5">
        <Label>{label}</Label>
        {action}
      </div>
      {children}
    </section>
  );
}

const Card = ({ className, children, ...props }) => (
  <div className={cn('overflow-hidden rounded-card border border-border bg-card', className)} {...props}>{children}</div>
);

const TextLink = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-1 py-1 font-sans text-[14px] font-medium text-link outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
    {children}
  </button>
);

// One list row: 60px, a 36px leading tile or face, two lines, a trailing bit.
const row = 'flex w-full min-h-[60px] items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-2.5 text-left font-sans text-foreground outline-none first:border-t-0';
const tappable = 'cursor-pointer transition-colors hover:bg-raised focus-visible:bg-raised';

function Tile({ icon: Icon, tone = 'plain' }) {
  return (
    <span className={cn(
      'flex size-9 shrink-0 items-center justify-center rounded-control',
      tone === 'warn' ? 'bg-warning-fill text-warning-text' : 'bg-raised text-foreground',
    )}>
      <Icon size={18} strokeWidth={STROKE} aria-hidden="true" />
    </span>
  );
}

function Lines({ title, sub, strike }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn('truncate text-[14px] font-medium leading-5', strike && 'text-muted-foreground line-through decoration-input')}>{title}</span>
      {sub && <span className="truncate text-[12px] leading-4 text-muted-foreground">{sub}</span>}
    </span>
  );
}

const Chevron = () => <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />;

/** A person: their photo, else initials. */
function Face({ name, url, you = false, size = 32, ring = false, className }) {
  return (
    <AvatarPrimitive.Root
      title={name}
      className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', ring && 'border-2 border-card', className)}
      style={{ width: size, height: size }}
    >
      {url && <AvatarPrimitive.Image src={url} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className={cn(
          'flex size-full items-center justify-center text-[12px] font-semibold',
          you ? 'bg-selected text-link' : 'bg-raised text-foreground',
        )}
      >
        {churchInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function SyncLine({ sync }) {
  if (!sync) return null;
  const tone = { ok: 'text-success-text', pending: 'text-warning-text', offline: 'text-muted-foreground', error: 'text-danger-text' }[sync.state] || 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1.5', tone)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {sync.label}
    </span>
  );
}

// ── Create (the + by the hello) ─────────────────────────────────────────────

/**
 * The + opens a small menu that springs from the button (the bencho create
 * menu's rows, corners and timing; anchored instead of centred, because a
 * header has no room for the block's 244px stage). The + never turns into an
 * ✕ (owner, 2026-11-15: "Don't rotate the +").
 */
function CreateButton({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" aria-label="Create" className="size-11 shrink-0 rounded-control">
          <Plus size={20} strokeWidth={2} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <AnimatePresence>
        {open && (
          <PopoverContent forceMount asChild align="end" sideOffset={8} className="w-[236px] p-1.5">
            <Motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ transformOrigin: 'top right' }}
            >
              {items.map((it, i) => (
                <div key={it.label}>
                  {it.divider && i > 0 && <div className="mx-1.5 my-1 h-px bg-border" />}
                  <button
                    type="button"
                    onClick={() => { setOpen(false); it.onSelect(); }}
                    className="flex h-9 w-full min-h-0 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[14px] font-medium text-foreground outline-none hover:bg-raised focus-visible:bg-raised"
                  >
                    <it.icon size={18} strokeWidth={STROKE} aria-hidden="true" />
                    {it.label}
                  </button>
                </div>
              ))}
            </Motion.div>
          </PopoverContent>
        )}
      </AnimatePresence>
    </Popover>
  );
}

// ── 1 · Get ready (once) ────────────────────────────────────────────────────

function SetupCard({ title, steps, onStep, onHide }) {
  if (!steps?.length) return null;
  const done = steps.filter(s => s.done).length;
  return (
    <Card aria-label={title} className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 text-[18px] font-semibold leading-[26px] tracking-[-0.2px]">{title}</h2>
          <p className="m-0 text-[14px] leading-5 text-muted-foreground">{done} of {steps.length} done</p>
        </div>
        <button type="button" onClick={onHide} className="min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-1 py-1 font-sans text-[14px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          Hide
        </button>
      </div>
      <div className="mx-4 mb-1.5 mt-3 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="h-full rounded-full bg-link transition-[width] duration-300" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <div className="flex flex-col pb-1">
        {steps.map(s => (
          <button
            key={s.id}
            type="button"
            disabled={s.done}
            onClick={() => onStep?.(s.id)}
            className={cn(row, 'min-h-[52px] border-t-0 py-2', !s.done && tappable, s.done && 'cursor-default')}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-full',
                s.done ? 'bg-link text-background' : 'shadow-[inset_0_0_0_1.5px_var(--input)]',
              )}
            >
              {s.done && <Check size={13} strokeWidth={3} />}
            </span>
            <Lines title={s.title} sub={s.sub} strike={s.done} />
            {!s.done && <Chevron />}
            <span className="sr-only">{s.done ? 'done' : 'not done yet'}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── 2 · Next up ─────────────────────────────────────────────────────────────

function inDays(n) {
  if (n == null) return '';
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

function NextUp({ next, leader, clockFormat, onOpen, onPlay, onMarkReady }) {
  if (!next) return null;
  const { setlist: sl, part, band = [], days, onNow } = next;
  const when = onNow
    ? `Started ${clock(sl.time, clockFormat)}`
    : [shortDate(sl.date), clock(sl.time, clockFormat), inDays(days)].filter(Boolean).join(' · ');
  const songs = (sl.items || []).filter(it => it?.type !== 'break').length;
  const sub = [songs ? `${songs} song${songs === 1 ? '' : 's'}` : 'No songs yet', part ? `you play ${part}` : null, sl.location].filter(Boolean).join(' · ');
  const yes = band.filter(b => b.yes);
  const canMarkReady = leader && onMarkReady && sl.status === 'draft';
  return (
    <Section label={onNow ? 'On now' : 'Next up'}>
      <Card className="flex flex-col gap-3.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-link">{when}</span>
            <h3 className="m-0 truncate text-[18px] font-semibold leading-[26px] tracking-[-0.2px]">{sl.name || 'Service'}</h3>
            <p className="m-0 truncate text-[14px] leading-5 text-muted-foreground">{sub}</p>
          </div>
          {sl.status === 'ready' && (
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-success-fill px-2.5 text-[12px] font-semibold text-success-text">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />Ready
            </span>
          )}
        </div>
        {band.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex">
              {band.slice(0, 5).map((b, i) => (
                <Face key={b.id} name={b.name} url={b.avatarUrl} ring className={cn(i > 0 && '-ml-2', !b.yes && 'opacity-50')} />
              ))}
              {band.length > 5 && (
                <span className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-card bg-raised text-[12px] font-semibold">+{band.length - 5}</span>
              )}
            </div>
            <span className="text-[14px] text-muted-foreground">
              {yes.length === band.length ? `${band.length} in the band` : `${yes.length} of ${band.length} said yes`}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpen?.(sl)}>Open</Button>
          {canMarkReady ? (
            <Button onClick={() => onMarkReady(sl)}><Check size={16} strokeWidth={2} aria-hidden="true" />Mark ready</Button>
          ) : (
            <Button onClick={() => (onPlay || onOpen)?.(sl)}><Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />Play</Button>
          )}
        </div>
      </Card>
    </Section>
  );
}

// ── 3 · Needs you ───────────────────────────────────────────────────────────

const ANSWERS = [
  { value: 'unavailable', label: 'No' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'available', label: 'Yes', primary: true },
];

function AskRow({ ask, onAnswer, onOpen }) {
  const [busy, setBusy] = useState(false);
  const { schedule, setlist } = ask;
  const answer = async (value) => {
    setBusy(true);
    try { await onAnswer?.(schedule.id, value); } finally { setBusy(false); }
  };
  // The question gets the whole line, the three answers sit under it: on a
  // phone the buttons beside it cut "Can you play Sun 22 Nov?" to "Can you pla…".
  return (
    <div className={cn(row, 'flex-col items-stretch gap-2.5 py-3')}>
      <button type="button" onClick={() => onOpen?.(setlist)} className="flex min-h-0 min-w-0 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none">
        <Tile icon={Calendar} tone="warn" />
        <Lines title={`Can you play ${shortDate(setlist.date)}?`} sub={[setlist.name, partLabel(schedule)].filter(Boolean).join(' · ')} />
      </button>
      <div className="grid grid-cols-3 gap-1.5 pl-12" role="group" aria-label={`Answer for ${shortDate(setlist.date)}`}>
        {ANSWERS.map(a => (
          <Button key={a.value} size="sm" variant={a.primary ? 'default' : 'outline'} disabled={busy} onClick={() => answer(a.value)} className="h-9">
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function needView(it) {
  const names = it.names ? it.names.slice(0, 3).join(', ') + (it.names.length > 3 ? '…' : '') : null;
  if (it.kind === 'join') return { icon: Users, title: it.count === 1 ? '1 person wants to join' : `${it.count} people want to join`, sub: names };
  if (it.kind === 'parts') return { icon: Users, title: it.count === 1 ? '1 person hasn’t said what they play' : `${it.count} people haven’t said what they play`, sub: names };
  if (it.kind === 'check') return { icon: FileCheck, title: it.count === 1 ? '1 imported song to check' : `${it.count} imported songs to check`, sub: 'Open each one and fix what’s off' };
  const sl = it.setlist;
  const when = shortDate(sl.date);
  if (it.kind === 'noband') return { icon: List, title: `${sl.name || 'Service'} has no band yet`, sub: when };
  return { icon: Music, title: `${sl.name || 'Service'} has no songs`, sub: when };
}

function NeedsYou({ asks = [], needs = [], onAnswer, onOpenSetlist, onNeed, limit = 4 }) {
  const [all, setAll] = useState(false);
  const total = asks.length + needs.length;
  if (!total) return null;
  const rows = [
    ...asks.map(a => ({ key: `ask-${a.schedule.id}`, ask: a })),
    ...needs.map((n, i) => ({ key: `need-${n.kind}-${n.setlist?.id || i}`, need: n })),
  ];
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <Section label={`Needs you · ${total}`}>
      <Card>
        {shown.map(r => {
          if (r.ask) return <AskRow key={r.key} ask={r.ask} onAnswer={onAnswer} onOpen={onOpenSetlist} />;
          const v = needView(r.need);
          return (
            <button key={r.key} type="button" onClick={() => onNeed?.(r.need)} className={cn(row, tappable)}>
              <Tile icon={v.icon} />
              <Lines title={v.title} sub={v.sub} />
              <Chevron />
            </button>
          );
        })}
        {rows.length > limit && (
          <button type="button" onClick={() => setAll(v => !v)} className={cn(row, tappable, 'min-h-11 text-[14px] font-medium text-link')}>
            {all ? 'Show fewer' : `See all ${rows.length}`}
          </button>
        )}
      </Card>
    </Section>
  );
}

// ── 4 · Your two weeks ──────────────────────────────────────────────────────

function TwoWeeks({ days, offset, onOffset, selected, onSelect, clockFormat, onOpen }) {
  if (!days?.length) return null;
  const sel = days.find(d => d.date === selected) || null;
  const lines = sel
    ? [
        ...sel.services.map(sl => ({ sl, title: sl.name || 'Service', sub: [clock(sl.time, clockFormat), sel.play ? 'You play' : sel.asked ? 'You’re invited' : null].filter(Boolean).join(' · ') })),
        ...sel.rehearsals.map(sl => ({ sl, title: `Rehearsal · ${sl.name || 'Service'}`, sub: [clock(sl.rehearsalTime, clockFormat), sl.rehearsalLocation].filter(Boolean).join(' · ') })),
      ]
    : [];
  const arrow = 'flex size-8 min-h-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent';
  const label = offset === 0 ? 'Your two weeks' : `${shortDate(days[0].date)} – ${shortDate(days[13].date)}`;
  return (
    <Section
      label={label}
      action={(
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Earlier" disabled={offset <= 0} onClick={() => onOffset?.(offset - 1)} className={arrow}><ChevronLeft size={16} strokeWidth={2} /></button>
          <button type="button" aria-label="Later" onClick={() => onOffset?.(offset + 1)} className={arrow}><ChevronRight size={16} strokeWidth={2} /></button>
        </div>
      )}
    >
      <Card className="flex flex-col gap-1 px-2.5 pb-1 pt-3">
        {[days.slice(0, 7), days.slice(7)].map((week, w) => (
          <div key={w} className="grid grid-cols-7 gap-1">
            {week.map(d => {
              const on = d.date === selected;
              const busy = d.services.length || d.rehearsals.length;
              const aria = `${d.weekday} ${d.day}${d.play ? ', you play' : d.asked ? ', invited' : ''}${busy ? '' : ', nothing on'}`;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={aria}
                  aria-pressed={on}
                  onClick={() => onSelect?.(d.date)}
                  className={cn(
                    'relative flex h-[52px] min-h-0 cursor-pointer flex-col items-center justify-center rounded-control border-0 bg-transparent p-0 font-sans text-foreground outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring',
                    on && 'bg-selected shadow-[inset_0_0_0_1.5px_var(--link)] hover:bg-selected',
                    d.isPast && 'opacity-40',
                  )}
                >
                  <span className="text-[12px] font-medium leading-4 text-muted-foreground">{d.weekday}</span>
                  <span className={cn('text-[16px] font-semibold leading-[22px]', d.isToday && 'text-link')}>{d.day}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute bottom-1 size-[5px] rounded-full',
                      d.play ? 'bg-link' : d.asked ? 'bg-warning-text' : busy ? 'bg-input' : 'hidden',
                    )}
                  />
                </button>
              );
            })}
          </div>
        ))}
        {sel && (
          <div className="-mx-2.5 mt-2 flex flex-col border-t border-border">
            {lines.length === 0 ? (
              <p className="m-0 px-4 py-3 text-[14px] leading-5 text-muted-foreground">{shortDate(sel.date)}: nothing on.</p>
            ) : lines.map((l, i) => (
              <button key={i} type="button" onClick={() => onOpen?.(l.sl)} className={cn(row, tappable, 'min-h-[52px] py-2')}>
                <Lines title={`${shortDate(sel.date)} · ${l.title}`} sub={l.sub} />
                <Chevron />
              </button>
            ))}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-0.5 text-[12px] leading-4 text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-link" />You play</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning-text" />Invited</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-input" />Something on</span>
      </div>
    </Section>
  );
}

// ── 5 · Recent activity ─────────────────────────────────────────────────────

/** Three rows show; the rest scroll inside the card (owner, 2026-11-15). */
function Activity({ items, now, onOpen, onOpenSongs }) {
  if (!items?.length) return null;
  return (
    <Section label="Recent activity" action={onOpenSongs && <TextLink onClick={onOpenSongs}>Songs</TextLink>}>
      <Card className="max-h-[182px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {items.map(it => {
          const body = (
            <>
              <Face name={it.actor} url={it.avatarUrl} you={it.actor === 'You'} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] leading-5">
                  <span className="font-medium">{it.actor}</span>
                  <span className="text-muted-foreground"> {it.verb}</span>
                  {it.object && <span className={cn('font-medium', it.removed && 'line-through decoration-muted-foreground')}> {it.object}</span>}
                </span>
                <span className="text-[12px] leading-4 text-muted-foreground">{timeAgo(it.at, now)}</span>
              </span>
            </>
          );
          const canOpen = onOpen && !it.removed && it.kind !== 'member';
          return canOpen ? (
            <button key={it.id} type="button" onClick={() => onOpen(it)} className={cn(row, tappable)}>{body}</button>
          ) : (
            <div key={it.id} className={row}>{body}</div>
          );
        })}
      </Card>
    </Section>
  );
}

// ── Sync trouble / nothing planned ──────────────────────────────────────────

// Sync has been failing for minutes: say what that means for the band, and
// what to try. Edits are still safe on this device.
export function SyncProblem({ onRetry }) {
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-fill p-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[16px] font-semibold leading-6 text-danger-text">Your changes aren’t reaching the church</h2>
        <p className="m-0 text-[14px] leading-5 text-muted-foreground">They’re saved on this device, but the band won’t see them until sync works again. If trying again doesn’t help, close the app and open it again.</p>
      </div>
      {onRetry && <Button size="sm" className="self-start" onClick={onRetry}>Try again</Button>}
    </section>
  );
}

function NothingPlanned({ onBrowse }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-5 py-7 text-center">
      <span className="flex size-10 items-center justify-center rounded-control bg-raised text-muted-foreground"><Calendar size={20} strokeWidth={STROKE} aria-hidden="true" /></span>
      <h2 className="m-0 text-[16px] font-semibold leading-6">Nothing planned for you yet</h2>
      <p className="m-0 max-w-[340px] text-[14px] leading-5 text-muted-foreground">When a leader invites you to play, it shows up here. You can still open any song.</p>
      {onBrowse && <Button variant="outline" className="mt-2 w-full max-w-[340px]" onClick={onBrowse}>Browse songs</Button>}
    </Card>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {string} p.name                 first name for "Hi …"
 * @param {string} p.dateLabel            "Sunday 15 November"
 * @param {{state, label}} [p.sync]
 * @param {{onRetry}} [p.syncProblem]     sync failing for minutes
 * @param {{title, steps, onStep, onHide}} [p.setup]  the one-time checklist
 * @param {boolean} [p.leader]
 * @param {Array} [p.needs]               from needsYou()
 * @param {Array} [p.asks]                from myAsks()
 * @param {object} [p.next]               { setlist, part, band, days }
 * @param {object} [p.strip]              { days, offset, onOffset, selected, onSelect }
 * @param {Array} [p.activity]            from recentActivity() / activityFromSongs()
 * @param {Array} [p.create]              the + menu: [{ icon, label, onSelect, divider }]
 */
export default function HomeView({
  name, dateLabel, sync, syncProblem, setup, leader = false, clockFormat = '12h',
  needs, onNeed, asks, onAnswer, next, onOpenSetlist, onPlaySetlist, onMarkReady,
  strip, onOpenSchedule, activity, now, onOpenActivity, onOpenSongs,
  showNothingPlanned = false, create = [], startChurch = null, embedded = false, layout = 'auto',
}) {
  const wideScreen = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'auto' ? wideScreen : layout === 'wide';
  // The shared page header (owner, 2026-11-15: Home, Setlists and Songs the
  // same); the date and sync line sit under it.
  const hello = (
    <PageHeader
      title={`Hi ${name}`}
      wide={layout === 'auto' ? undefined : wide}
      sub={<><span>{dateLabel}</span><SyncLine sync={sync} /></>}
    >
      {/* Schedule's door (owner, 2026-11-15): a calendar button beside the +,
          not a row in the two weeks. Schedule is not a nav tab. */}
      {onOpenSchedule && (
        <Button variant="outline" size="icon" aria-label="Schedule" title="Schedule" onClick={onOpenSchedule} className="size-11 rounded-control">
          <Calendar size={20} strokeWidth={STROKE} aria-hidden="true" />
        </Button>
      )}
      <CreateButton items={create} />
    </PageHeader>
  );
  const setupEl = setup && <SetupCard {...setup} />;
  const nextEl = <NextUp next={next} leader={leader} clockFormat={clockFormat} onOpen={onOpenSetlist} onPlay={onPlaySetlist} onMarkReady={onMarkReady} />;
  const needsEl = <NeedsYou asks={asks} needs={leader ? needs : []} onAnswer={onAnswer} onOpenSetlist={onOpenSetlist} onNeed={onNeed} />;
  const emptyEl = showNothingPlanned && !setup && <NothingPlanned onBrowse={onOpenSongs} />;
  const stripEl = strip && <TwoWeeks {...strip} clockFormat={clockFormat} onOpen={onOpenSetlist} />;
  const activityEl = <Activity items={activity} now={now} onOpen={onOpenActivity} onOpenSongs={onOpenSongs} />;

  return (
    <div data-slot="home" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className={cn('mx-auto flex w-full flex-col gap-6 pb-8', wide ? 'max-w-[1180px]' : 'max-w-[680px]', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6')}>
        {hello}
        {syncProblem && <SyncProblem {...syncProblem} />}
        {startChurch}
        {setupEl}
        {wide ? (
          // From 1024px: your service and what needs you on the left, the
          // calendar and the library's news on the right.
          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-6">
            <div className="flex min-w-0 flex-col gap-6">{nextEl}{needsEl}{emptyEl}</div>
            <div className="flex min-w-0 flex-col gap-6">{stripEl}{activityEl}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {nextEl}{needsEl}{emptyEl}{stripEl}{activityEl}
          </div>
        )}
      </div>
    </div>
  );
}

