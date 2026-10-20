import { useState } from 'react';
import { formatClockTime } from '@/lib/dateFormat';
import { shortTime, setlistFor, memberIdsOf, songCountOf, shortServiceName } from '@/lib/services';
import { Dot, Pill, DayBlock, SectionLabel } from './scheduleBits';
import { ANSWERS, longDate, planKey, planRows } from './scheduleFormat';

// The leader half of Schedule once a Space has services, drawn to the
// "Schedule and services" canvas: every upcoming date of every service (or one
// service, by chip). A date with no setlist yet is a dashed row with Plan and
// how many of the service's people said Yes; a planned one says who's on the
// band and how many songs. Selecting a date opens DatePlan: the service's
// people with their answers, ticked to ask them to play.

const AMBER = 'var(--ds-amber-900)';

const answerOf = (availability, uid, date) => availability.find(a => a.user_id === uid && a.date === date)?.status || null;

function bandOf(setlist, schedules, setlistMap) {
  const rowId = setlist ? setlistMap[setlist.id] : null;
  return { rowId, band: rowId ? schedules.filter(s => s.setlist_id === rowId) : [] };
}

export default function PlanList({ services, serviceMembers, availability, setlists, schedules, setlistMap, clockFormat = '12h', selected = null, onSelect, compact = false }) {
  const [filter, setFilter] = useState('all');
  const shown = filter === 'all' ? services : services.filter(s => s.id === filter);
  const rows = planRows(shown);

  return (
    <section aria-labelledby="plan-h" className="flex flex-col gap-3">
      <h2 id="plan-h" className="text-[17px] font-semibold text-[var(--modes-text)] m-0">Plan</h2>
      <div role="group" aria-label="Show service" className="flex gap-2 overflow-x-auto pb-0.5">
        {[{ id: 'all', name: 'All' }, ...services].map(s => {
          const on = filter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(s.id)}
              className="shrink-0 h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-copy-14 font-medium whitespace-nowrap cursor-pointer border"
              style={on
                ? { background: 'rgba(83,121,111,0.28)', borderColor: '#7AA89C', color: '#9CC4B9' }
                : { background: 'transparent', borderColor: 'var(--modes-border)', color: 'var(--modes-text)' }}
            >
              {s.id !== 'all' && <Dot color={s.color} />}
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map(({ date, service }) => {
          const setlist = setlistFor(service, date, setlists);
          const { band } = bandOf(setlist, schedules, setlistMap);
          const pool = memberIdsOf(service.id, serviceMembers);
          const k = planKey(date, service);
          const on = selected === k;
          let line;
          let warn = false;
          if (setlist) {
            const asked = band.filter(s => s.availability === 'pending').length;
            const songs = songCountOf(setlist);
            const songsPart = songs === 0 ? 'no songs yet' : `${songs} song${songs === 1 ? '' : 's'}`;
            line = band.length === 0 ? `No band yet · ${songsPart}`
              : `${band.length} in the band${asked ? ` · ${asked} not answered` : ''} · ${songsPart}`;
            warn = band.length === 0 || asked > 0;
          } else if (pool.length === 0) {
            line = 'Nobody on this service yet';
          } else {
            const yes = pool.filter(uid => answerOf(availability, uid, date) === 'available').length;
            const none = pool.filter(uid => !answerOf(availability, uid, date)).length;
            line = `${yes} of ${pool.length} said Yes${none ? ` · ${none} no answer` : ''}`;
          }
          const style = on
            ? { background: 'rgba(83,121,111,0.18)', border: '1px solid rgba(122,168,156,0.45)' }
            : setlist
              ? { background: 'var(--modes-surface)', border: '1px solid var(--modes-border)' }
              : { background: 'transparent', border: '1px dashed #3A3A3E' };
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect?.(k)}
              className="w-full flex items-center gap-3.5 px-3 py-2.5 min-h-11 rounded-[14px] text-left cursor-pointer text-[var(--modes-text)]"
              style={style}
            >
              <DayBlock date={date} />
              <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                <span className="flex items-center gap-1.5 text-copy-15 font-semibold truncate">
                  <Dot color={service.color} />
                  <span className="truncate">{compact ? shortServiceName(service.name) : service.name} · {formatClockTime(shortTime(service.start_time), clockFormat)}</span>
                </span>
                <span className="text-label-13" style={{ color: warn ? AMBER : 'var(--modes-text-muted)' }}>{line}</span>
              </span>
              {!setlist && (
                <span className="shrink-0 h-9 px-3.5 rounded-full inline-flex items-center bg-[var(--color-brand)] text-white text-copy-14 font-semibold">Plan</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function memberName(m) {
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Member';
}
function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

const ORDER = { available: 0, maybe: 1, none: 2, unavailable: 3 };
const NONE = { label: 'No answer', bg: 'var(--modes-surface-strong)', fg: 'var(--modes-text-muted)' };

/**
 * One date of one service: tick who plays. Only the service's people are
 * listed, best answers first; No and no-answer are dimmed but can still be
 * asked. Ticking someone already on the band and unticking them takes them
 * off; "Ask N to play" writes the new rows (each one notifies its person).
 */
export function DatePlan({ date, service, serviceMembers, members, availability, setlists, schedules, setlistMap, clockFormat = '12h', onCreateSchedule, onDeleteSchedule, onCreate, onOpenSetlist }) {
  const setlist = setlistFor(service, date, setlists);
  const { rowId, band } = bandOf(setlist, schedules, setlistMap);
  const onBand = new Set(band.map(s => s.user_id));
  const [picked, setPicked] = useState(() => new Set(onBand));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pool = memberIdsOf(service.id, serviceMembers);
  const people = pool
    .map(uid => {
      const m = members.find(x => x.user_id === uid);
      const status = answerOf(availability, uid, date);
      return { uid, m, name: memberName(m), parts: (m?.instruments || []).join(', '), status };
    })
    .sort((a, b) => ORDER[a.status || 'none'] - ORDER[b.status || 'none'] || a.name.localeCompare(b.name));

  const added = [...picked].filter(uid => !onBand.has(uid));
  const removed = band.filter(s => !picked.has(s.user_id));
  const canPick = !!rowId;
  const yes = people.filter(p => p.status === 'available').length;
  const summary = setlist
    ? `${band.length} in the band · ${songCountOf(setlist)} song${songCountOf(setlist) === 1 ? '' : 's'}`
    : `${yes} of ${pool.length} said Yes`;

  const toggle = (uid) => setPicked(prev => {
    const n = new Set(prev);
    if (n.has(uid)) n.delete(uid); else n.add(uid);
    return n;
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const uid of added) {
        const m = members.find(x => x.user_id === uid);
        await onCreateSchedule(rowId, uid, m?.instruments?.[0] || null);
      }
      for (const s of removed) await onDeleteSchedule(s.id);
    } catch (err) {
      console.error('[plan] saving the band failed:', err);
      setError("Couldn't save the band. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const cta = !canPick ? 'Set up this date'
    : added.length > 0 ? `Ask ${added.length} to play`
    : removed.length > 0 ? 'Save the band'
    : picked.size === 0 ? 'Pick people first' : 'Band saved';
  const ctaOn = !canPick || added.length > 0 || removed.length > 0;
  const onCta = !canPick
    ? () => onCreate?.({ date, time: shortTime(service.start_time), service: service.name, name: service.name })
    : save;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-copy-14 text-[var(--modes-text-muted)]"><Dot color={service.color} />{service.name}</span>
        <span className="text-[28px] font-bold tracking-[-0.01em] text-[var(--modes-text)]">{longDate(date)} · {formatClockTime(shortTime(service.start_time), clockFormat)}</span>
        <span className="text-copy-14 text-[var(--modes-text-muted)]">{summary}</span>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel right={`${picked.size} picked`}>Pick the band</SectionLabel>
        {people.length === 0 && (
          <span className="text-copy-14 text-[var(--modes-text-muted)]">Nobody is on {service.name} yet. Add people in Services.</span>
        )}
        {people.map(p => {
          const on = picked.has(p.uid);
          const a = ANSWERS[p.status] || NONE;
          const dim = !p.status || p.status === 'unavailable';
          return (
            <button
              key={p.uid}
              type="button"
              aria-pressed={on}
              disabled={!canPick || busy}
              onClick={() => toggle(p.uid)}
              className="flex items-center gap-3 min-h-[52px] px-3 py-1 rounded-xl text-left text-[var(--modes-text)] border cursor-pointer disabled:cursor-default"
              style={{
                opacity: dim && !on ? 0.55 : 1,
                background: on ? 'rgba(83,121,111,0.14)' : 'var(--modes-surface)',
                borderColor: on ? 'rgba(122,168,156,0.45)' : 'var(--modes-border)',
              }}
            >
              {canPick && (
                <span aria-hidden="true" className="w-[22px] h-[22px] shrink-0 rounded-[7px] flex items-center justify-center text-[13px] font-bold text-white" style={{ background: on ? 'var(--color-brand)' : 'transparent', border: `1.5px solid ${on ? 'var(--color-brand)' : '#3A3A3E'}` }}>{on ? '✓' : ''}</span>
              )}
              {p.m?.profile?.avatar_url
                ? <img src={p.m.profile.avatar_url} alt="" className="w-[34px] h-[34px] rounded-full shrink-0 object-cover" />
                : <span aria-hidden="true" className="w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-label-12 font-semibold bg-[var(--modes-surface-strong)]">{initials(p.name)}</span>}
              <span className="flex-1 min-w-0 flex flex-col gap-px">
                <span className="text-copy-15 font-semibold truncate">{p.name}</span>
                {p.parts && <span className="text-label-13 text-[var(--modes-text-muted)] truncate">{p.parts}</span>}
              </span>
              <Pill bg={a.bg} fg={a.fg}>{a.label}</Pill>
            </button>
          );
        })}
        <span className="text-label-12 text-[var(--modes-text-muted)]">
          {canPick
            ? 'Only people on this service are listed. No answer and No are greyed out but can still be asked.'
            : 'Set up the date first (songs can come later). Then tick who plays.'}
        </span>
      </div>

      {error && <span role="alert" className="text-copy-14 text-[var(--ds-red-900)]">{error}</span>}
      <div className="flex gap-2.5">
        {setlist && onOpenSetlist && (
          <button type="button" onClick={() => onOpenSetlist(setlist)} className="h-12 px-[18px] rounded-[14px] border border-[#2A2A2E] bg-transparent text-[var(--modes-text)] text-copy-15 font-semibold cursor-pointer">Songs</button>
        )}
        <button
          type="button"
          disabled={!ctaOn || busy}
          onClick={onCta}
          className="flex-1 h-12 rounded-[14px] border-none text-white text-copy-15 font-semibold cursor-pointer disabled:cursor-default"
          style={{ background: ctaOn ? 'var(--color-brand)' : '#2A2A2E' }}
        >
          {busy ? 'Saving…' : cta}
        </button>
      </div>
    </div>
  );
}

