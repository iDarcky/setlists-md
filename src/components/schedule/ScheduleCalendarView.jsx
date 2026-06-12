import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { weekdayLabels, firstDayOffset } from '../../lib/dateFormat';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function statusDotClass(status) {
  if (status === 'available') return 'bg-[var(--ds-green-600)]';
  if (status === 'unavailable') return 'bg-[var(--ds-gray-500)]';
  if (status === 'maybe') return 'bg-[var(--ds-orange-600)]';
  return 'bg-transparent';
}

/**
 * Generate the 6-row × 7-col grid (42 cells) for a given month.
 * Includes leading/trailing days from adjacent months so the grid is whole.
 * `weekStart` is the day index the user wants in the leftmost column
 * (0 = Sunday, 1 = Monday, …).
 */
function buildMonthGrid(year, monthIdx, weekStart = 0) {
  const firstOfMonth = new Date(year, monthIdx, 1);
  const start = new Date(firstOfMonth);
  // Walk back to the first weekday of the user's chosen week start.
  const offset = (firstOfMonth.getDay() - weekStart + 7) % 7;
  start.setDate(start.getDate() - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/**
 * Renders the schedule as a month grid with prev/next chevrons.
 * Past dates are visible but read-only. Tap a day to open the
 * status picker; tap the setlist pill to open it / edit roster.
 */
export default function ScheduleCalendarView({
  setlists,
  availability,
  members,
  userId,
  isAdmin,
  firstDayOfWeek = 'sunday',
  onSelectDate,
}) {
  const weekStart = firstDayOffset(firstDayOfWeek);
  const WEEKDAY_LABELS = weekdayLabels(firstDayOfWeek);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), weekStart),
    [cursor, weekStart],
  );

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const next = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const myAvailFor = (dateStr) =>
    availability?.find(a => a.user_id === userId && a.date === dateStr)?.status || null;

  const setlistsFor = (dateStr) => setlists.filter(sl => sl.date === dateStr);
  const rehearsalsFor = (dateStr) => setlists.filter(sl => sl.rehearsalDate === dateStr);

  const availableCountFor = (dateStr) =>
    availability?.filter(a => a.date === dateStr && a.status === 'available').length || 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prev} aria-label="Previous month" className="px-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="text-heading-18 m-0 text-[var(--modes-text)]">
            {monthLabel}
          </h3>
          <Button variant="ghost" size="xs" onClick={goToday}>Today</Button>
        </div>
        <Button variant="ghost" size="sm" onClick={next} aria-label="Next month" className="px-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
        {WEEKDAY_LABELS.map(label => (
          <span key={label} className="text-[10px] sm:text-label-11 uppercase tracking-wide sm:tracking-wider text-[var(--modes-text-dim)] py-1.5 sm:py-2">
            <span className="sm:hidden">{label.slice(0, 1)}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((date, idx) => {
          const dateStr = toLocalDateStr(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const isToday = date.getTime() === today.getTime();
          const myStatus = myAvailFor(dateStr);
          const slOnDay = setlistsFor(dateStr);
          const rehOnDay = rehearsalsFor(dateStr);
          const availCount = availableCountFor(dateStr);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`min-h-[58px] sm:min-h-[124px] flex flex-col gap-0.5 sm:gap-1 rounded-lg sm:rounded-xl border p-1 sm:p-1.5 text-left transition-colors cursor-pointer ${
                isToday ? 'border-[var(--color-brand)] bg-[var(--modes-surface)]' : 'border-[var(--modes-border)] bg-[var(--modes-surface)]'
              } hover:bg-[var(--modes-surface-strong)] ${inMonth ? '' : 'opacity-45'}`}
            >
              <div className="flex items-center justify-between gap-0.5">
                {isToday ? (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] sm:min-w-[24px] sm:h-6 px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] sm:text-label-12 font-bold">
                    {date.getDate()}
                  </span>
                ) : (
                  <span className="text-label-12 sm:text-label-13 text-[var(--modes-text)] pl-0.5">{date.getDate()}</span>
                )}
                {myStatus && (
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusDotClass(myStatus)}`} aria-label={myStatus} />
                )}
              </div>

              <div className="flex flex-col gap-0.5 sm:gap-1 min-h-0">
                {slOnDay.slice(0, 2).map(sl => (
                  <span
                    key={sl.id}
                    className="block text-[9px] sm:text-label-10 leading-tight px-1 sm:px-1.5 py-0.5 sm:py-1 rounded sm:rounded-md bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] font-medium truncate"
                    title={sl.name}
                  >
                    {sl.name || 'Setlist'}
                  </span>
                ))}
                {slOnDay.length > 2 && (
                  <span className="text-[9px] sm:text-label-10 text-[var(--modes-text-dim)] pl-0.5">+{slOnDay.length - 2}</span>
                )}
                {rehOnDay.slice(0, 1).map(sl => (
                  <span
                    key={`reh-${sl.id}`}
                    className="block text-[9px] sm:text-label-10 leading-tight px-1 sm:px-1.5 py-0.5 sm:py-1 rounded sm:rounded-md bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)] font-medium truncate"
                    title={`Rehearsal · ${sl.name}`}
                  >
                    ⏱ {sl.name || 'Rehearsal'}
                  </span>
                ))}
                {isAdmin && availCount > 0 && (
                  <span className="text-[9px] sm:text-label-10 text-[var(--modes-text-dim)] pl-0.5 truncate">
                    {availCount}/{members.length}<span className="hidden sm:inline"> avail</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
