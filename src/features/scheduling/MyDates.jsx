import { useState } from 'react';
import BottomSheet from '@/ui/BottomSheet';
import { formatClockTime } from '@/lib/dateFormat';
import { serviceColor, shortTime, dateState } from '@/lib/services';

// The member half of Schedule once a Space has services (20261020_team_services):
// "Can you play?" — a card per date of the services you're on — and "Coming
// up", the same dates with what has happened since (asked, playing, band not
// picked yet). Tapping a card opens a Yes / Maybe / No sheet; nothing cycles on
// tap, so an answer is always a deliberate choice.
//
// Answers are per DATE (team_availability is unchanged), so a Yes for Sunday
// covers every Sunday service you're on. Two of your services on one day show
// two cards with the same answer.

const ANSWERS = [
  { value: 'available', label: 'Yes', icon: '✓', fg: 'var(--ds-green-800)', bg: 'var(--ds-green-100)', on: 'var(--ds-green-600)' },
  { value: 'maybe', label: 'Maybe', icon: '?', fg: 'var(--ds-amber-900)', bg: 'var(--ds-amber-100)', on: 'var(--ds-amber-600)' },
  { value: 'unavailable', label: 'No', icon: '×', fg: 'var(--ds-red-800)', bg: 'var(--ds-red-100)', on: 'var(--ds-red-700)' },
];
const ANSWER = Object.fromEntries(ANSWERS.map(a => [a.value, a]));

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function longDate(str) {
  return parseDate(str).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function Dot({ color }) {
  return <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: serviceColor(color) }} />;
}

function Pill({ status }) {
  const a = ANSWER[status];
  if (!a) {
    return <span className="text-label-12 font-semibold px-2.5 py-1 rounded-full bg-[var(--modes-surface-strong)] text-[var(--modes-text-muted)]">Answer</span>;
  }
  return <span className="text-label-12 font-semibold px-2.5 py-1 rounded-full" style={{ background: a.bg, color: a.fg }}>{a.label}</span>;
}

function AnswerSheet({ entry, status, clockFormat, onAnswer, onClear, onClose, busy }) {
  const { date, service } = entry;
  return (
    <BottomSheet open onClose={onClose} title="Can you play?">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-copy-14 text-[var(--ds-gray-700)]">
            <Dot color={service.color} />{service.name} · {formatClockTime(shortTime(service.start_time), clockFormat)}
          </span>
          <span className="text-heading-20 font-semibold text-[var(--ds-gray-1000)]">{longDate(date)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ANSWERS.map(a => {
            const on = status === a.value;
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => onAnswer(a.value)}
                className="min-h-[88px] rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer border transition-colors disabled:opacity-60"
                style={{
                  background: on ? a.on : 'var(--ds-background-200)',
                  borderColor: on ? a.on : 'var(--ds-gray-400)',
                  color: on ? '#fff' : 'var(--ds-gray-1000)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[17px] font-bold"
                  style={{ background: on ? 'rgba(255,255,255,0.2)' : a.bg, color: on ? '#fff' : a.fg }}
                >
                  {a.icon}
                </span>
                <span className="text-copy-15 font-semibold">{a.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-label-12 text-[var(--ds-gray-700)] m-0">
          Your answer counts for every service you're on that day. The leader picks the band from the people who said Yes.
        </p>
        {status && (
          <button type="button" onClick={onClear} disabled={busy} className="self-start bg-transparent border-none p-0 text-copy-14 text-[var(--ds-gray-700)] underline cursor-pointer">
            Clear my answer
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

export default function MyDates({
  entries,
  myServices,
  availability,
  userId,
  setlists,
  schedules,
  setlistMap,
  clockFormat = '12h',
  onSetStatus,
  onClearStatus,
  onOpenSetlist,
}) {
  const [open, setOpen] = useState(null); // `${date}|${service.id}`
  const [busy, setBusy] = useState(false);
  const statusOf = (date) => availability.find(a => a.user_id === userId && a.date === date)?.status || null;

  const left = new Set(entries.filter(e => !statusOf(e.date)).map(e => e.date)).size;
  const openEntry = entries.find(e => `${e.date}|${e.service.id}` === open) || null;

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setOpen(null);
    } catch (err) {
      console.error('[schedule] answer failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (myServices.length === 0) {
    return (
      <div className="modes-card px-4 py-6 text-copy-14 text-[var(--modes-text-muted)]">
        You're not on a service yet. When a leader adds you to one, its dates show up here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-copy-14 text-[var(--modes-text-muted)]">
        You're on
        {myServices.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-[var(--modes-text)]">
            <Dot color={s.color} />{s.name}{i < myServices.length - 1 ? (i === myServices.length - 2 ? ' and' : ',') : ''}
          </span>
        ))}
      </div>

      <section aria-labelledby="cyp-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cyp-h" className="text-heading-18 font-semibold text-[var(--modes-text)] m-0">Can you play?</h2>
          <span className="text-label-13 text-[var(--modes-text-muted)]">{left === 0 ? 'All answered' : `${left} to answer`}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scroll-px-5 sm:mx-0 sm:px-0 sm:scroll-px-0 snap-x">
          {entries.map(e => {
            const st = statusOf(e.date);
            const d = parseDate(e.date);
            return (
              <button
                key={`${e.date}|${e.service.id}`}
                type="button"
                onClick={() => setOpen(`${e.date}|${e.service.id}`)}
                aria-label={`${e.service.name}, ${longDate(e.date)}: ${ANSWER[st]?.label || 'not answered'}`}
                className="snap-start shrink-0 w-[150px] modes-card flex flex-col gap-2 p-3 text-left cursor-pointer hover:bg-[var(--modes-surface-strong)]"
                style={!st ? { borderColor: 'var(--color-brand)' } : undefined}
              >
                <span className="flex items-center gap-1.5 text-label-12 text-[var(--modes-text-muted)] truncate"><Dot color={e.service.color} /><span className="truncate">{e.service.name}</span></span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-label-12 uppercase font-semibold text-[var(--modes-text-dim)]">{DOW[d.getDay()]}</span>
                  <span className="text-heading-20 font-bold text-[var(--modes-text)]">{d.getDate()}</span>
                  <span className="text-label-12 text-[var(--modes-text-dim)]">{MONTH[d.getMonth()]}</span>
                </span>
                <Pill status={st} />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="cu-h" className="flex flex-col gap-2">
        <h2 id="cu-h" className="text-heading-18 font-semibold text-[var(--modes-text)] m-0 mb-1">Coming up</h2>
        {entries.map(e => {
          const s = dateState({ ...e, setlists, schedules, setlistMap, userId });
          const d = parseDate(e.date);
          const sub = s.kind === 'asked' ? 'You were asked to play · answer on Home'
            : s.kind === 'playing' ? `You're playing${s.schedule?.role ? ` · ${s.schedule.role}` : ''}`
            : s.kind === 'declined' ? "You said you can't make it"
            : 'Band not picked yet';
          const clickable = !!s.setlist && !!onOpenSetlist;
          const Row = clickable ? 'button' : 'div';
          return (
            <Row
              key={`${e.date}|${e.service.id}`}
              {...(clickable ? { type: 'button', onClick: () => onOpenSetlist(s.setlist) } : {})}
              className={`modes-card flex items-center gap-3 px-3 py-2.5 text-left ${clickable ? 'cursor-pointer hover:bg-[var(--modes-surface-strong)]' : ''}`}
            >
              <span className="w-12 shrink-0 flex flex-col items-center py-1 rounded-xl bg-[var(--modes-surface-strong)]">
                <span className="text-label-11 uppercase font-semibold text-[var(--modes-text-dim)]">{DOW[d.getDay()]}</span>
                <span className="text-heading-20 font-bold leading-tight text-[var(--modes-text)]">{d.getDate()}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-copy-15 font-semibold text-[var(--modes-text)] truncate">
                  <Dot color={e.service.color} />{e.service.name} · {formatClockTime(shortTime(e.service.start_time), clockFormat)}
                </span>
                <span className={`block text-label-13 truncate ${s.kind === 'asked' ? 'text-[var(--ds-amber-700)]' : 'text-[var(--modes-text-muted)]'}`}>{sub}</span>
              </span>
              {s.kind === 'asked' && (
                <span className="text-label-12 font-semibold px-2.5 py-1 rounded-full bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]">Asked</span>
              )}
            </Row>
          );
        })}
      </section>

      {openEntry && (
        <AnswerSheet
          entry={openEntry}
          status={statusOf(openEntry.date)}
          clockFormat={clockFormat}
          busy={busy}
          onClose={() => setOpen(null)}
          onAnswer={(v) => run(() => onSetStatus(openEntry.date, v))}
          onClear={() => run(() => onClearStatus(openEntry.date))}
        />
      )}
    </div>
  );
}
