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

  // Generate an array of dates starting from 2 days ago up to 14 days ahead
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

  // ── Colour language ──────────────────────────────────────────────────────
  // Two independent axes, never mixed onto one swatch:
  //   • Event TYPE colours the cell:  Service = brand (teal), Rehearsal = purple.
  //   • My AVAILABILITY is a small dot: available = green, maybe = amber,
  //     unavailable = red, pending = grey. (No dot when there's no response.)
  const EVENT_STYLE = {
    service:   { bg: 'bg-[var(--color-brand-soft)]', border: 'border-[var(--color-brand-border)]', text: 'text-[var(--color-brand)]' },
    rehearsal: { bg: 'bg-[var(--ds-purple-100)]',    border: 'border-[var(--ds-purple-300)]',      text: 'text-[var(--ds-purple-900)]' },
    none:      { bg: 'bg-[var(--ds-background-200)]', border: 'border-[var(--ds-gray-300)]',        text: 'text-[var(--ds-gray-900)]' },
  };
  const AVAIL_DOT = {
    playing:     'bg-[var(--ds-green-500)]',
    available:   'bg-[var(--ds-green-500)]',
    maybe:       'bg-[var(--ds-amber-500)]',
    unavailable: 'bg-[var(--ds-red-600)]',
    pending:     'bg-[var(--ds-gray-400)]',
    none:        '',
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-3">
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

      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          className="flex items-start gap-2 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory hide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dates.map((date, i) => {
            const { serviceSetlists, rehearsalSetlists, serviceSchedules, rehearsalSchedules } = getDataForDate(date);
            const isToday = date.getTime() === today.getTime();
            const myAvail = myAvailabilityFor(date);

            // Event identity (what's happening that day). Service wins over
            // rehearsal for the headline.
            const eventType = serviceSetlists.length ? 'service'
              : rehearsalSetlists.length ? 'rehearsal' : null;
            const eventSetlist = serviceSetlists[0] || rehearsalSetlists[0] || null;
            const eventName = eventSetlist?.name || (eventType === 'rehearsal' ? 'Rehearsal' : 'Service');
            const extraEvents = (serviceSetlists.length + rehearsalSetlists.length) - 1;
            const hasSetlist = !!eventSetlist;

            // My availability for the day (drives the dot only).
            const mySched = serviceSchedules[0] || rehearsalSchedules[0] || null;
            let status = 'none';
            if (mySched) {
              if (mySched.availability === 'available') status = 'playing';
              else if (mySched.availability === 'pending') status = 'pending';
              else if (mySched.availability === 'maybe') status = 'maybe';
              else if (mySched.availability === 'unavailable') status = 'unavailable';
            } else if (eventType && !schedules) {
              status = 'playing'; // personal mode — your own event = you're on
            }
            if (status === 'none') {
              if (myAvail === 'available') status = 'available';
              else if (myAvail === 'maybe') status = 'maybe';
              else if (myAvail === 'unavailable') status = 'unavailable';
            }

            const ev = EVENT_STYLE[eventType || 'none'];
            const dotClass = AVAIL_DOT[status] || '';
            const isTodayNoEvent = !eventType && isToday;
            const cellBg = isTodayNoEvent ? 'bg-[var(--ds-background-100)]' : ev.bg;
            const cellBorder = isTodayNoEvent ? 'border-[var(--ds-gray-400)]' : ev.border;
            const ringClass = isToday ? 'ring-2 ring-[var(--color-brand)] ring-offset-1 ring-offset-[var(--ds-background-100)]' : '';
            const weekday = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });

            // Clicking any day opens the day detail/availability modal; if the
            // host didn't wire one, fall back to opening the day's setlist.
            const handleClick = () => {
              if (onDayClick) onDayClick(date);
              else if (hasSetlist && onDateClick) onDateClick(eventSetlist);
            };

            // Uniform compact chips keep the strip even; the event name hangs
            // beneath as a caption (full name in the title/aria) so longer names
            // never crowd the cell.
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 snap-start w-[72px]">
                <button
                  onClick={handleClick}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={eventType ? `${eventType === 'service' ? 'Service' : 'Rehearsal'}: ${eventName}` : `${weekday} ${date.getDate()}`}
                  className={`w-16 h-[72px] rounded-2xl border flex flex-col items-center justify-center transition-transform duration-150 active:scale-95 cursor-pointer hover:shadow-md ${cellBg} ${cellBorder} ${ringClass}`}
                >
                  <span className={`text-label-11 font-semibold uppercase tracking-wider ${eventType ? ev.text : 'text-[var(--ds-gray-500)]'}`}>
                    {weekday}
                  </span>
                  <span className={`text-heading-20 leading-none ${isToday ? 'font-extrabold' : 'font-bold'} ${eventType ? ev.text : 'text-[var(--ds-gray-900)]'}`}>
                    {date.getDate()}
                  </span>
                  <span className="h-2 mt-1 flex items-center">
                    {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
                  </span>
                </button>
                <span
                  className={`text-label-11 leading-tight text-center w-full truncate min-h-[14px] ${eventType ? ev.text : 'text-transparent'}`}
                  title={eventType ? eventName : undefined}
                >
                  {eventType ? `${eventName}${extraEvents > 0 ? ` +${extraEvents}` : ''}` : ' '}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scroll gradients */}
        <div className="absolute top-0 bottom-3 left-0 w-8 bg-gradient-to-r from-[var(--ds-background-100)] to-transparent pointer-events-none sm:hidden"></div>
        <div className="absolute top-0 bottom-3 right-0 w-8 bg-gradient-to-l from-[var(--ds-background-100)] to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}
