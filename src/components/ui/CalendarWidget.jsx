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
            // What to open when the day is tapped (service first, else rehearsal).
            const clickSetlist = serviceSetlists[0] || rehearsalSetlists[0] || null;
            const hasSetlist = !!clickSetlist;

            // Status priority: a service you're on (green) → a rehearsal you're
            // on (amber) → standalone availability. 'pending' = added but not
            // yet confirmed.
            let status = 'none';
            if (serviceSetlists.length) {
              if (serviceSchedules.length) {
                const s = serviceSchedules[0];
                if (s.availability === 'pending') status = 'pending';
                else if (s.availability === 'available') status = 'service';
                else if (s.availability === 'maybe') status = 'maybe';
                else status = 'service';
              } else if (!schedules) {
                status = 'service';
              }
            }
            if (status === 'none' && rehearsalSetlists.length && (rehearsalSchedules.length || !schedules)) {
              status = 'rehearsal';
            }
            if (status === 'none') {
              if (myAvail === 'available') status = 'avail-yes';
              else if (myAvail === 'maybe') status = 'maybe';
              else if (myAvail === 'unavailable') status = 'avail-no';
            }

            let bgClass = "bg-[var(--ds-background-200)] border-[var(--ds-gray-300)]";
            let textClass = "text-[var(--ds-gray-900)]";
            let dotClass = "bg-transparent";

            if (status === 'service') {
              bgClass = "bg-[var(--ds-green-100)] border-[var(--ds-green-400)]";
              textClass = "text-[var(--ds-green-900)] font-bold";
              dotClass = "bg-[var(--ds-green-600)]";
            } else if (status === 'rehearsal') {
              bgClass = "bg-[var(--ds-amber-100)] border-[var(--ds-amber-400)]";
              textClass = "text-[var(--ds-amber-900)] font-bold";
              dotClass = "bg-[var(--ds-amber-600)]";
            } else if (status === 'pending') {
              bgClass = "bg-[var(--color-brand-soft)] border-[var(--color-brand-border)]";
              textClass = "text-[var(--color-brand)]";
              dotClass = "bg-[var(--color-brand)]";
            } else if (status === 'maybe') {
              // Tentative — amber, matching the availability picker.
              bgClass = "bg-[var(--ds-amber-100)] border-[var(--ds-amber-300)]";
              textClass = "text-[var(--ds-amber-900)]";
              dotClass = "bg-[var(--ds-amber-500)]";
            } else if (status === 'avail-yes') {
              bgClass = "bg-[var(--ds-green-100)] border-[var(--ds-green-300)]";
              textClass = "text-[var(--ds-green-900)]";
              dotClass = "bg-[var(--ds-green-500)]";
            } else if (status === 'avail-no') {
              // Unavailable — red (was a muted strikethrough, which didn't read).
              bgClass = "bg-[var(--ds-red-100)] border-[var(--ds-red-300)]";
              textClass = "text-[var(--ds-red-800)]";
              dotClass = "bg-[var(--ds-red-600)]";
            } else if (isToday) {
              bgClass = "bg-[var(--ds-background-100)] border-[var(--ds-gray-400)]";
            }

            // Play vs rehearsal is shown by the card outline (no glyphs):
            // a service/play day is a solid card, a rehearsal day is dashed.
            const eventType = serviceSetlists.length ? 'service'
              : rehearsalSetlists.length ? 'rehearsal' : null;
            const outlineClass = eventType === 'rehearsal' ? 'border-2 border-dashed' : '';

            // Clicking any day opens the day detail/availability modal; if the
            // host didn't wire one, fall back to opening the day's setlist.
            const handleClick = () => {
              if (onDayClick) onDayClick(date);
              else if (hasSetlist && onDateClick) onDateClick(clickSetlist);
            };

            return (
              <button
                key={i}
                onClick={handleClick}
                aria-current={isToday ? 'date' : undefined}
                aria-label={eventType === 'service' ? 'Service day' : eventType === 'rehearsal' ? 'Rehearsal day' : undefined}
                className={`relative snap-start shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl border ${outlineClass} transition-transform duration-150 active:scale-95 cursor-pointer hover:shadow-md ${bgClass} ${isToday ? 'ring-2 ring-[var(--color-brand)] ring-offset-1 ring-offset-[var(--ds-background-100)]' : ''}`}
              >
                <span className={`text-label-12 font-semibold uppercase tracking-wider mb-1 ${status !== 'none' ? textClass : 'text-[var(--ds-gray-500)]'}`}>
                  {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={`text-heading-20 m-0 leading-none ${isToday ? 'font-extrabold' : ''} ${textClass}`}>
                  {date.getDate()}
                </span>
                <div className="h-2 mt-1">
                  {status !== 'none' && (
                    <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></div>
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
