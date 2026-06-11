import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { formatClockTime } from '../../lib/dateFormat';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function statusPillClasses(status) {
  if (status === 'available') return 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)] border-[var(--ds-green-300)]';
  if (status === 'unavailable') return 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)] border-[var(--ds-red-300)]';
  if (status === 'maybe') return 'bg-[var(--ds-orange-100)] text-[var(--ds-orange-800)] border-[var(--ds-orange-300)]';
  return 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)] border-[var(--ds-gray-300)]';
}

function statusLabel(status) {
  if (!status) return 'Set status';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function relativeLabel(date, today) {
  const days = Math.round((date - today) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 0 && days < 7) return `In ${days} days`;
  if (days < 0 && days > -7) return `${-days} days ago`;
  return null;
}

/**
 * Renders the schedule as a vertical list of upcoming dates.
 * Defaults to 8 weeks ahead; "Load more" extends in 8-week chunks.
 */
export default function ScheduleListView({
  weeksAhead,
  onLoadMore,
  setlists,
  availability,
  members,
  userId,
  isAdmin,
  clockFormat = '12h',
  onSelectDate,
  onOpenSetlist,
  onOpenRoster,
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Agenda: only surface days that actually matter — today, days with a
  // setlist, days you've marked, or days someone is available — so the list
  // isn't 50+ empty rows. Use the Calendar view to mark an arbitrary day.
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < weeksAhead * 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = toLocalDateStr(d);
      const hasSetlist = setlists.some(sl => sl.date === ds);
      const hasStatus = availability?.some(a => a.user_id === userId && a.date === ds);
      const hasAvail = availability?.some(a => a.date === ds && a.status === 'available');
      if (i === 0 || hasSetlist || hasStatus || hasAvail) arr.push(d);
    }
    return arr;
  }, [today, weeksAhead, setlists, availability, userId]);

  const myAvailFor = (dateStr) =>
    availability?.find(a => a.user_id === userId && a.date === dateStr)?.status || null;

  const setlistsFor = (dateStr) => setlists.filter(sl => sl.date === dateStr);

  const availableCountFor = (dateStr) =>
    availability?.filter(a => a.date === dateStr && a.status === 'available').length || 0;

  return (
    <div className="flex flex-col gap-2">
      {dates.map((date, idx) => {
        const dateStr = toLocalDateStr(date);
        const myStatus = myAvailFor(dateStr);
        const slOnDay = setlistsFor(dateStr);
        const availCount = availableCountFor(dateStr);
        const isToday = date.getTime() === today.getTime();
        const rel = relativeLabel(date, today);
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div
            key={idx}
            className={`p-3 rounded-xl border bg-[var(--modes-surface)] flex flex-col gap-2 ${isToday ? 'border-[var(--color-brand)]' : 'border-[var(--modes-border)]'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelectDate(date)}
                className="flex items-center gap-3 text-left bg-transparent border-none p-0 cursor-pointer min-w-0 flex-1"
                aria-label={`Set availability for ${dayLabel}`}
              >
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] shrink-0">
                  <span className="text-label-11 uppercase tracking-wider text-[var(--modes-text-dim)] leading-none">
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-heading-18 leading-none mt-0.5 text-[var(--modes-text)]">
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-copy-14 font-semibold text-[var(--modes-text)]">
                    {weekday}
                  </span>
                  <span className="text-copy-12 text-[var(--modes-text-dim)]">
                    {rel || dayLabel}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(date)}
                className={`text-label-12 px-2.5 py-1 rounded-full border shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${statusPillClasses(myStatus)}`}
              >
                {statusLabel(myStatus)}
              </button>
            </div>

            {slOnDay.map(sl => (
              <div
                key={sl.id}
                className="flex items-center justify-between gap-3 pl-15 border-t border-dashed border-[var(--modes-border)] pt-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Chip variant="success" size="sm">Setlist</Chip>
                  <span className="text-copy-13 text-[var(--modes-text)] font-medium truncate">
                    {sl.name || 'Untitled Setlist'}
                  </span>
                  {sl.time && (
                    <span className="text-copy-12 text-[var(--modes-text-dim)] shrink-0">
                      {formatClockTime(sl.time, clockFormat)}
                    </span>
                  )}
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => isAdmin ? onOpenRoster(sl) : onOpenSetlist(sl)}
                >
                  {isAdmin ? 'Edit roster' : 'Open'} →
                </Button>
              </div>
            ))}

            {isAdmin && (
              <div className="text-label-12 text-[var(--modes-text-dim)] flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {availCount} of {members.length} available
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center pt-4">
        <Button variant="secondary" size="sm" onClick={onLoadMore}>
          Load 8 more weeks
        </Button>
      </div>
    </div>
  );
}
