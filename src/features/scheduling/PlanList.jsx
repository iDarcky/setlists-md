import { useState } from 'react';
import { formatClockTime } from '@/lib/dateFormat';
import { serviceColor, serviceDates, shortTime, setlistFor, memberIdsOf } from '@/lib/services';

// The leader half of Schedule once a Space has services: every upcoming date
// of every service (or one service, by chip), each with how many of the
// service's people said Yes. "Plan" opens the band picker for that date —
// creating the setlist first when there isn't one — and the picker lists only
// the people on that service.

const WEEKS = 6;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PlanList({ services, serviceMembers, availability, setlists, schedules, setlistMap, clockFormat = '12h', onPlan, onCreate }) {
  const [filter, setFilter] = useState('all');
  const shown = filter === 'all' ? services : services.filter(s => s.id === filter);

  const rows = shown
    .flatMap(service => serviceDates(service, { weeks: WEEKS }).map(date => ({ date, service })))
    .sort((a, b) => a.date.localeCompare(b.date)
      || shortTime(a.service.start_time).localeCompare(shortTime(b.service.start_time)));

  return (
    <section aria-labelledby="plan-h" className="flex flex-col gap-3">
      <h2 id="plan-h" className="text-heading-18 font-semibold text-[var(--modes-text)] m-0">Plan</h2>
      <div role="tablist" aria-label="Service" className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: 'all', name: 'All services' }, ...services].map(s => {
          const on = filter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(s.id)}
              className={`shrink-0 h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-label-13 font-semibold cursor-pointer border ${on ? 'bg-[var(--modes-text)] text-[var(--ds-background-100)] border-transparent' : 'bg-[var(--modes-surface)] text-[var(--modes-text-muted)] border-[var(--modes-border)]'}`}
            >
              {s.id !== 'all' && <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: serviceColor(s.color) }} />}
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map(({ date, service }) => {
          const pool = memberIdsOf(service.id, serviceMembers);
          const yes = pool.filter(uid => availability.some(a => a.user_id === uid && a.date === date && a.status === 'available')).length;
          const setlist = setlistFor(service, date, setlists);
          const rowId = setlist ? setlistMap[setlist.id] : null;
          const band = rowId ? schedules.filter(s => s.setlist_id === rowId) : [];
          const asked = band.filter(s => s.availability === 'pending').length;
          const playing = band.filter(s => s.availability === 'available').length;
          const planned = band.length > 0;
          const d = parseDate(date);
          const sub = planned
            ? `${playing} playing${asked ? ` · ${asked} not answered` : ''}`
            : pool.length === 0 ? 'Nobody on this service yet' : `${yes} of ${pool.length} said Yes`;
          const act = () => (setlist ? onPlan(setlist, service) : onCreate?.({
            date,
            time: shortTime(service.start_time),
            service: service.name,
            name: service.name,
          }));
          return (
            <div key={`${date}|${service.id}`} className="modes-card flex items-center gap-3 px-3 py-2.5">
              <span className="w-12 shrink-0 flex flex-col items-center py-1 rounded-xl bg-[var(--modes-surface-strong)]">
                <span className="text-label-11 uppercase font-semibold text-[var(--modes-text-dim)]">{DOW[d.getDay()]}</span>
                <span className="text-heading-20 font-bold leading-tight text-[var(--modes-text)]">{d.getDate()}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-copy-15 font-semibold text-[var(--modes-text)] truncate">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: serviceColor(service.color) }} />
                  {service.name}
                </span>
                <span className="block text-label-13 text-[var(--modes-text-muted)] truncate">{formatClockTime(shortTime(service.start_time), clockFormat)} · {sub}</span>
              </span>
              {(setlist || onCreate) && (
                <button
                  type="button"
                  onClick={act}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-label-13 font-semibold cursor-pointer border-none ${planned ? 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]' : 'bg-[var(--color-brand)] text-white'}`}
                >
                  {planned ? 'Planned' : 'Plan'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
