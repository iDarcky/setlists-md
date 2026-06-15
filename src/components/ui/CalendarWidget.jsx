import React, { useRef } from 'react';
import { Button } from './Button';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function CalendarWidget({
  setlists,
  schedules,
  userId,
  onDateClick,
  onDayClick,
  availability,
  onOpenSchedule,
}) {
  const scrollRef = useRef(null);

  // Generate an array of dates starting from 2 days ago up to 12 days ahead
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = -2; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  const myAvailabilityFor = (date) => {
    if (!availability || !userId) return null;
    const dateStr = toLocalDateStr(date);
    const row = availability.find(a => a.user_id === userId && a.date === dateStr);
    return row?.status || null;
  };

  // Helper: service setlists, rehearsal setlists, and the user's schedules for
  // each, on a given date.
  const getDataForDate = (date) => {
    const dateStr = toLocalDateStr(date);
    const serviceSetlists = setlists.filter(sl => sl.date === dateStr);
    const rehearsalSetlists = setlists.filter(sl => sl.rehearsalDate === dateStr);
    const mySchedulesFor = (sls) => schedules?.filter(s =>
      s.user_id === userId && sls.some(sl => sl.id === s.setlist_id)
    ) || [];
    return {
      serviceSetlists,
      rehearsalSetlists,
      serviceSchedules: mySchedulesFor(serviceSetlists),
      rehearsalSchedules: mySchedulesFor(rehearsalSetlists),
    };
  };

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-heading-20 font-bold text-[var(--modes-text)]">
          My Schedule
        </h2>
        <div className="flex items-center gap-1">
          {onOpenSchedule && (
            <Button variant="ghost" size="sm" onClick={onOpenSchedule} className="text-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-white/5">
              View full schedule
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><path d="m9 18 6-6-6-6"/></svg>
            </Button>
          )}
          <div className="hidden sm:flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={scrollLeft} className="px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </Button>
            <Button variant="ghost" size="sm" onClick={scrollRight} className="px-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex items-start gap-2 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory hide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dates.map((date, i) => {
            const { serviceSetlists, rehearsalSetlists, serviceSchedules, rehearsalSchedules } = getDataForDate(date);
            const isToday = date.getTime() === today.getTime();
            const myAvail = myAvailabilityFor(date);

            // Event identity (what's happening that day) — kept SEPARATE from my
            // status. Service wins over rehearsal for the headline.
            const eventType = serviceSetlists.length ? 'service'
              : rehearsalSetlists.length ? 'rehearsal' : null;
            const eventSetlist = serviceSetlists[0] || rehearsalSetlists[0] || null;
            const eventName = eventSetlist?.name || (eventType === 'rehearsal' ? 'Rehearsal' : 'Service');
            const extraEvents = (serviceSetlists.length + rehearsalSetlists.length) - 1;
            const hasSetlist = !!eventSetlist;

            // Status = MY status only (color language). playing/rostered →
            // distinct brand; available → green; maybe → amber; unavailable →
            // red; pending = invited but not replied; none = no response.
            const mySched = serviceSchedules[0] || rehearsalSchedules[0] || null;
            let status = 'none';
            if (mySched) {
              if (mySched.availability === 'available') status = 'playing';
              else if (mySched.availability === 'pending') status = 'pending';
              else if (mySched.availability === 'maybe') status = 'maybe';
              else if (mySched.availability === 'unavailable') status = 'unavailable';
            } else if (eventType && !schedules) {
              // Personal mode (no team scheduling) — your own event = you're on.
              status = 'playing';
            }
            if (status === 'none') {
              if (myAvail === 'available') status = 'available';
              else if (myAvail === 'maybe') status = 'maybe';
              else if (myAvail === 'unavailable') status = 'unavailable';
            }

            const PALETTE = {
              playing:     { bg: 'bg-[var(--color-brand-soft)]', border: 'border-[var(--color-brand)]',        text: 'text-[var(--color-brand)]',   dot: 'bg-[var(--color-brand)]' },
              available:   { bg: 'bg-[var(--ds-green-100)]',     border: 'border-[var(--ds-green-300)]',       text: 'text-[var(--ds-green-900)]',  dot: 'bg-[var(--ds-green-500)]' },
              maybe:       { bg: 'bg-[var(--ds-amber-100)]',     border: 'border-[var(--ds-amber-300)]',       text: 'text-[var(--ds-amber-900)]',  dot: 'bg-[var(--ds-amber-500)]' },
              unavailable: { bg: 'bg-[var(--ds-red-100)]',       border: 'border-[var(--ds-red-300)]',         text: 'text-[var(--ds-red-800)]',    dot: 'bg-[var(--ds-red-600)]' },
              pending:     { bg: 'bg-[var(--ds-background-200)]', border: 'border-[var(--color-brand-border)]', text: 'text-[var(--color-brand)]',   dot: 'bg-[var(--color-brand)]' },
              none:        { bg: 'bg-[var(--ds-background-200)]', border: 'border-[var(--ds-gray-300)]',        text: 'text-[var(--ds-gray-900)]',   dot: 'bg-transparent' },
            };
            const pal = (status === 'none' && isToday)
              ? { ...PALETTE.none, bg: 'bg-[var(--ds-background-100)]', border: 'border-[var(--ds-gray-400)]' }
              : PALETTE[status];

            // Clicking any day opens the day detail/availability modal; if the
            // host didn't wire one, fall back to opening the day's setlist.
            const handleClick = () => {
              if (onDayClick) onDayClick(date);
              else if (hasSetlist && onDateClick) onDateClick(eventSetlist);
            };

            const weekday = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
            const ringClass = isToday ? 'ring-2 ring-[var(--color-brand)] ring-offset-1 ring-offset-[var(--ds-background-100)]' : '';
            const baseClass = `relative snap-start shrink-0 rounded-2xl border transition-transform duration-150 active:scale-95 cursor-pointer hover:shadow-md ${pal.bg} ${pal.border} ${ringClass}`;

            // Event days are wider calendar cells showing the event NAME + a
            // neutral type tag (type is text/icon, never color). Plain days
            // stay compact chips.
            if (eventType) {
              return (
                <button
                  key={i}
                  onClick={handleClick}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${eventType === 'service' ? 'Service' : 'Rehearsal'}: ${eventName}`}
                  className={`${baseClass} w-32 h-20 flex flex-col justify-between text-left px-3 py-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-label-12 font-semibold uppercase tracking-wider ${pal.text}`}>
                      {weekday} {date.getDate()}
                    </span>
                    {status !== 'none' && <div className={`w-1.5 h-1.5 rounded-full ${pal.dot}`}></div>}
                  </div>
                  <span className={`text-copy-14 font-bold leading-tight line-clamp-2 ${pal.text}`}>
                    {eventName}{extraEvents > 0 ? ` +${extraEvents}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 text-label-11 font-medium text-[var(--ds-gray-600)]">
                    {eventType === 'rehearsal' ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    )}
                    {eventType === 'rehearsal' ? 'Rehearsal' : 'Service'}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={i}
                onClick={handleClick}
                aria-current={isToday ? 'date' : undefined}
                className={`${baseClass} w-16 h-20 flex flex-col items-center justify-center`}
              >
                <span className={`text-label-12 font-semibold uppercase tracking-wider mb-1 ${status !== 'none' ? pal.text : 'text-[var(--ds-gray-500)]'}`}>
                  {weekday}
                </span>
                <span className={`text-heading-20 m-0 leading-none ${isToday ? 'font-extrabold' : ''} ${pal.text}`}>
                  {date.getDate()}
                </span>
                <div className="h-2 mt-1">
                  {status !== 'none' && (
                    <div className={`w-1.5 h-1.5 rounded-full ${pal.dot}`}></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scroll gradients */}
        <div className="absolute top-0 bottom-4 left-0 w-8 bg-gradient-to-r from-[var(--ds-background-100)] to-transparent pointer-events-none sm:hidden"></div>
        <div className="absolute top-0 bottom-4 right-0 w-8 bg-gradient-to-l from-[var(--ds-background-100)] to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}
