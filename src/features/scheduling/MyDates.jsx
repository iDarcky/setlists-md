import { useState } from 'react';
import BottomSheet from '@/ui/BottomSheet';
import { formatClockTime } from '@/lib/dateFormat';
import { shortTime, dateState, shortServiceName, songCountOf, serviceColor } from '@/lib/services';
import { Dot, Pill, DayBlock, SectionLabel } from './scheduleBits';
import { ANSWERS, NO_ANSWER, DOW, parseDate, shortDate, longDate, leftLine } from './scheduleFormat';

// The member half of Schedule once a Space has services (20261020_team_services),
// drawn to the "Schedule and services" canvas: a strip of day cards under
// "Can you play?", and "Coming up" with what has happened since (asked,
// playing, band not picked yet). Tapping a day opens a Yes / Maybe / No sheet;
// nothing cycles on tap, so an answer is always a deliberate choice.
//
// Answers are per DATE (team_availability is unchanged), so a Yes for Sunday
// covers every Sunday service you're on.

const TEAL = '#9CC4B9';
const AMBER = 'var(--ds-amber-900)';

const CHOICES = [
  { value: 'available', label: 'Yes, I can play', hint: 'The leader can pick you for this date' },
  { value: 'maybe', label: 'Maybe', hint: "The leader sees you're not sure yet" },
  { value: 'unavailable', label: "No, I can't", hint: "You won't be picked for this date" },
];

const keyOf = (e) => `${e.date}|${e.service.id}`;

function useStatusOf(availability, userId) {
  return (date) => availability.find(a => a.user_id === userId && a.date === date)?.status || null;
}

/** The Yes / Maybe / No sheet. */
export function AnswerSheet({ entry, status, clockFormat, busy, onAnswer, onClear, onClose }) {
  const { date, service } = entry;
  return (
    <BottomSheet open onClose={onClose} title={`Can you play ${shortDate(date)}?`}>
      <div className="flex flex-col gap-4">
        <span className="flex items-center gap-1.5 text-copy-14 text-[var(--ds-gray-700)] -mt-2">
          <Dot color={service.color} />{service.name} · {formatClockTime(shortTime(service.start_time), clockFormat)}
        </span>
        <div className="flex flex-col gap-2.5">
          {CHOICES.map(c => {
            const a = ANSWERS[c.value];
            const on = status === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => onAnswer(c.value)}
                className="min-h-16 px-4 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer border transition-colors disabled:opacity-60 text-[var(--ds-gray-1000)]"
                style={{ background: on ? a.bg : 'var(--ds-background-200)', borderColor: on ? a.fg : 'var(--ds-gray-400)' }}
              >
                <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[17px] font-bold" style={{ background: a.bg, color: a.fg }}>{a.icon}</span>
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className="text-copy-16 font-semibold">{c.label}</span>
                  <span className="text-label-13 text-[var(--ds-gray-700)]">{c.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-label-13 text-[var(--ds-gray-700)] text-center">The leader sees your answer when planning this date.</span>
        {status && (
          <button type="button" onClick={onClear} disabled={busy} className="self-center bg-transparent border-none p-0 text-copy-14 text-[var(--ds-gray-700)] underline cursor-pointer">
            Clear my answer
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

/** Opens the sheet for one entry and writes the answer. */
function useAnswering(onSetStatus, onClearStatus) {
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
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
  return {
    open, setOpen, busy,
    answer: (date, v) => run(() => onSetStatus(date, v)),
    clear: (date) => run(() => onClearStatus(date)),
  };
}

function DayCard({ entry, status, onOpen, compact = false }) {
  const a = ANSWERS[status] || NO_ANSWER;
  const d = parseDate(entry.date);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${longDate(entry.date)}, ${entry.service.name}: ${ANSWERS[status]?.label || 'no answer yet'}. Tap to answer.`}
      className={`shrink-0 snap-start flex flex-col items-center justify-center gap-1 cursor-pointer text-[var(--modes-text)] ${compact ? 'w-[58px] min-h-[52px] rounded-xl py-1.5 bg-transparent' : 'w-[70px] min-h-[108px] rounded-2xl py-2 bg-[var(--modes-surface)]'}`}
      style={{ border: `1px ${status ? 'solid' : 'dashed'} ${a.ring}` }}
    >
      {compact ? (
        <span className="text-label-11 text-[var(--modes-text-muted)]">{DOW[d.getDay()]} {d.getDate()}</span>
      ) : (
        <>
          <span className="text-label-11 font-semibold max-w-[62px] truncate" style={{ color: serviceColor(entry.service.color) }}>{shortServiceName(entry.service.name)}</span>
          <span className="text-label-12 font-medium text-[var(--modes-text-muted)]">{DOW[d.getDay()]}</span>
          <span className="text-[20px] leading-[22px] font-bold">{d.getDate()}</span>
        </>
      )}
      <span className={`font-semibold rounded-full ${compact ? 'text-label-11 px-[7px] py-0.5' : 'text-label-12 px-[9px] py-[3px]'}`} style={{ background: a.bg, color: a.fg }}>{a.label}</span>
    </button>
  );
}

function ComingUpRow({ entry, ctx, clockFormat, onOpenSetlist }) {
  const s = dateState({ ...entry, ...ctx });
  const sub = s.kind === 'asked' ? "You're asked to play · answer now"
    : s.kind === 'playing' ? `You: ${s.schedule?.role || 'playing'}`
    : s.kind === 'declined' ? "You said you can't make it"
    : 'Band not picked yet';
  const color = s.kind === 'asked' ? AMBER : s.kind === 'playing' ? TEAL : 'var(--modes-text-muted)';
  const clickable = !!s.setlist && !!onOpenSetlist;
  const Row = clickable ? 'button' : 'div';
  return (
    <Row
      {...(clickable ? { type: 'button', onClick: () => onOpenSetlist(s.setlist) } : {})}
      className={`w-full flex items-center gap-3.5 px-1 py-3 min-h-11 text-left bg-transparent border-0 border-b border-solid border-[var(--modes-border)] text-[var(--modes-text)] ${clickable ? 'cursor-pointer' : ''}`}
    >
      <DayBlock date={entry.date} />
      <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="flex items-center gap-1.5 text-copy-15 font-semibold truncate">
          <Dot color={entry.service.color} />
          <span className="truncate">{entry.service.name} · {formatClockTime(shortTime(entry.service.start_time), clockFormat)}</span>
        </span>
        <span className="text-label-13 font-medium truncate" style={{ color }}>{sub}</span>
      </span>
      {s.kind === 'asked' && <Pill bg={ANSWERS.maybe.bg} fg={ANSWERS.maybe.fg}>Asked</Pill>}
      {s.kind === 'playing' && <Pill bg={ANSWERS.available.bg} fg={ANSWERS.available.fg}>Playing</Pill>}
    </Row>
  );
}

/** Phone, member: the day strip and Coming up. */
export default function MyDates({ entries, myServices, availability, userId, setlists, schedules, setlistMap, clockFormat = '12h', onSetStatus, onClearStatus, onOpenSetlist }) {
  const statusOf = useStatusOf(availability, userId);
  const ans = useAnswering(onSetStatus, onClearStatus);
  const openEntry = entries.find(e => keyOf(e) === ans.open) || null;
  const ctx = { setlists, schedules, setlistMap, userId };

  if (myServices.length === 0) return <NotOnService />;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="cyp-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cyp-h" className="text-[17px] font-semibold text-[var(--modes-text)] m-0">Can you play?</h2>
          <span className="text-label-13 text-[var(--modes-text-muted)]">{leftLine(entries, statusOf)}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-5 px-5 scroll-px-5 snap-x sm:mx-0 sm:px-0">
          {entries.map(e => <DayCard key={keyOf(e)} entry={e} status={statusOf(e.date)} onOpen={() => ans.setOpen(keyOf(e))} />)}
        </div>
      </section>

      <section aria-labelledby="cu-h" className="flex flex-col">
        <h2 id="cu-h" className="text-[17px] font-semibold text-[var(--modes-text)] m-0 mb-2">Coming up</h2>
        {entries.map(e => <ComingUpRow key={keyOf(e)} entry={e} ctx={ctx} clockFormat={clockFormat} onOpenSetlist={onOpenSetlist} />)}
      </section>

      {openEntry && (
        <AnswerSheet
          entry={openEntry}
          status={statusOf(openEntry.date)}
          clockFormat={clockFormat}
          busy={ans.busy}
          onClose={() => ans.setOpen(null)}
          onAnswer={(v) => ans.answer(openEntry.date, v)}
          onClear={() => ans.clear(openEntry.date)}
        />
      )}
    </div>
  );
}

export function NotOnService() {
  return (
    <div className="modes-card px-4 py-6 text-copy-14 text-[var(--modes-text-muted)]">
      You're not on a service yet. When a leader adds you to one, its dates show up here.
    </div>
  );
}

/** Phone, leader: your own answers as one small strip, above the plan. */
export function OwnDatesStrip({ entries, availability, userId, clockFormat = '12h', onSetStatus, onClearStatus }) {
  const statusOf = useStatusOf(availability, userId);
  const ans = useAnswering(onSetStatus, onClearStatus);
  const openEntry = entries.find(e => keyOf(e) === ans.open) || null;
  if (entries.length === 0) return null;
  const line = leftLine(entries, statusOf);
  return (
    <section aria-labelledby="mine-h" className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-[var(--modes-surface)] border border-[var(--modes-border)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mine-h" className="text-copy-15 font-semibold text-[var(--modes-text)] m-0">Can you play?</h2>
        <span className="text-label-13" style={{ color: line === 'All answered' ? 'var(--modes-text-muted)' : AMBER }}>{line}</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {entries.map(e => <DayCard key={keyOf(e)} entry={e} status={statusOf(e.date)} compact onOpen={() => ans.setOpen(keyOf(e))} />)}
      </div>
      {openEntry && (
        <AnswerSheet
          entry={openEntry}
          status={statusOf(openEntry.date)}
          clockFormat={clockFormat}
          busy={ans.busy}
          onClose={() => ans.setOpen(null)}
          onAnswer={(v) => ans.answer(openEntry.date, v)}
          onClear={() => ans.clear(openEntry.date)}
        />
      )}
    </section>
  );
}

/** Tablet/desktop, left pane: "Your dates", one row per date with your answer. */
export function YourDatesList({ entries, availability, userId, setlists, schedules, setlistMap, clockFormat = '12h', selected, onSelect }) {
  const statusOf = useStatusOf(availability, userId);
  const ctx = { setlists, schedules, setlistMap, userId };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h2 className="text-[17px] font-semibold text-[var(--modes-text)] m-0">Your dates</h2>
        <span className="text-label-13 text-[var(--modes-text-muted)]">{leftLine(entries, statusOf)}</span>
      </div>
      {entries.map(e => {
        const st = statusOf(e.date);
        const a = ANSWERS[st] || NO_ANSWER;
        const s = dateState({ ...e, ...ctx });
        const on = selected === keyOf(e);
        const sub = s.kind === 'asked' ? "You're asked · answer now"
          : s.kind === 'playing' ? `You: ${s.schedule?.role || 'playing'}`
          : s.kind === 'declined' ? "You said you can't make it"
          : 'Band not picked yet';
        return (
          <button
            key={keyOf(e)}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(keyOf(e))}
            className="flex items-center gap-3.5 px-3 py-2.5 min-h-11 rounded-[14px] text-left cursor-pointer text-[var(--modes-text)] border"
            style={on ? { background: 'rgba(83,121,111,0.18)', borderColor: 'rgba(122,168,156,0.45)' } : { background: 'transparent', borderColor: 'transparent' }}
          >
            <DayBlock date={e.date} />
            <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <span className="flex items-center gap-1.5 text-copy-15 font-semibold truncate">
                <Dot color={e.service.color} />
                <span className="truncate">{e.service.name} · {formatClockTime(shortTime(e.service.start_time), clockFormat)}</span>
              </span>
              <span className="text-label-13 truncate" style={{ color: s.kind === 'asked' ? AMBER : 'var(--modes-text-muted)' }}>{sub}</span>
            </span>
            <Pill bg={a.bg} fg={a.fg}>{a.label}</Pill>
          </button>
        );
      })}
    </div>
  );
}

function firstName(m) {
  const n = m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Someone';
  return n.split(' ')[0];
}

/** Tablet/desktop, right pane: one of your dates. */
export function DateDetail({ entry, availability, userId, setlists, schedules, setlistMap, members, songs = [], clockFormat = '12h', onSetStatus, onClearStatus, onRespond, onOpenSetlist }) {
  const statusOf = useStatusOf(availability, userId);
  const [busy, setBusy] = useState(false);
  if (!entry) return null;
  const st = statusOf(entry.date);
  const s = dateState({ ...entry, setlists, schedules, setlistMap, userId });
  const rowId = s.setlist ? setlistMap[s.setlist.id] : null;
  const band = rowId ? schedules.filter(x => x.setlist_id === rowId && x.availability !== 'unavailable') : [];
  const bandLine = band.length === 0
    ? 'Not picked yet. The leader picks from the people who said Yes.'
    : band.map(x => {
        const who = x.user_id === userId ? 'you' : firstName(members.find(m => m.user_id === x.user_id));
        return x.role ? `${who} (${x.role})` : who;
      }).join(', ').replace(/^./, c => c.toUpperCase());
  const titles = (s.setlist?.items || []).filter(it => it.type !== 'break').map(it => songs.find(sg => sg.id === it.songId)?.title).filter(Boolean);
  const count = songCountOf(s.setlist);
  const songsLine = count === 0 ? 'No songs yet'
    : `${count} song${count === 1 ? '' : 's'}${titles.length ? `: ${titles.slice(0, 3).join(', ')}${count > 3 ? ` and ${count - 3} more` : ''}` : ''}`;

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { console.error('[schedule] answer failed:', err); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-copy-14 text-[var(--modes-text-muted)]">
          <Dot color={entry.service.color} />{entry.service.name} · {formatClockTime(shortTime(entry.service.start_time), clockFormat)}
        </span>
        <span className="text-[28px] font-bold tracking-[-0.01em] text-[var(--modes-text)]">{longDate(entry.date)}</span>
      </div>

      {s.kind === 'asked' && onRespond && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: '#1E180C', border: '1px solid rgba(242,181,68,0.40)' }}>
          <span className="text-label-12 font-semibold uppercase tracking-[0.08em]" style={{ color: '#F2B544' }}>
            You're asked to play{s.schedule?.role ? ` ${s.schedule.role}` : ''}
          </span>
          <div className="flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => act(() => onRespond(s.schedule, 'unavailable'))} className="h-11 px-[18px] rounded-xl border border-[#3A3A3E] bg-transparent text-[var(--modes-text)] text-copy-15 font-semibold cursor-pointer disabled:opacity-60">Can't make it</button>
            <button type="button" disabled={busy} onClick={() => act(() => onRespond(s.schedule, 'available'))} className="h-11 px-[18px] rounded-xl border-none bg-[var(--color-brand)] text-white text-copy-15 font-semibold cursor-pointer disabled:opacity-60">I'll play</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <SectionLabel right={st ? <button type="button" disabled={busy} onClick={() => act(() => onClearStatus(entry.date))} className="bg-transparent border-none p-0 text-label-13 text-[var(--modes-text-muted)] underline cursor-pointer">Clear</button> : null}>Can you play?</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {Object.entries(ANSWERS).map(([value, a]) => {
            const on = st === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => act(() => onSetStatus(entry.date, value))}
                className="min-h-[88px] rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer text-[var(--modes-text)] border disabled:opacity-60"
                style={{ background: on ? a.bg : 'var(--modes-surface)', borderColor: on ? a.fg : 'var(--modes-border)' }}
              >
                <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-[17px] font-bold" style={{ background: a.bg, color: a.fg }}>{a.icon}</span>
                <span className="text-copy-15 font-semibold">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionLabel>Band</SectionLabel>
        <span className="text-copy-15 leading-[22px] text-[var(--modes-text)]">{bandLine}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Songs</SectionLabel>
        {s.setlist && onOpenSetlist ? (
          <button type="button" onClick={() => onOpenSetlist(s.setlist)} className="text-left px-4 py-3.5 rounded-2xl bg-[var(--modes-surface)] border border-[var(--modes-border)] text-copy-15 text-[var(--modes-text)] cursor-pointer">{songsLine}</button>
        ) : (
          <span className="px-4 py-3.5 rounded-2xl bg-[var(--modes-surface)] border border-[var(--modes-border)] text-copy-15 text-[var(--modes-text-muted)]">{songsLine}</span>
        )}
      </div>
    </div>
  );
}
