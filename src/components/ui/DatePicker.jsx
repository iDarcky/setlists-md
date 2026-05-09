import { useEffect, useMemo, useRef, useState } from 'react';
import { weekdayLabels, firstDayOffset } from '../../lib/dateFormat';

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
  // Treat YYYY-MM-DD as a *local* date, not a UTC midnight. We anchor to
  // 12:00 so DST jumps can't shift the display by a day.
  if (!str || typeof str !== 'string') return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Build the 6×7 month grid (42 cells) starting from the user's preferred
 * first weekday. Mirrors the helper in ScheduleCalendarView so both surfaces
 * align on the same week start.
 */
function buildMonthGrid(year, monthIdx, weekStart) {
  const firstOfMonth = new Date(year, monthIdx, 1);
  const start = new Date(firstOfMonth);
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
 * Inline date picker that honors the app's `firstDayOfWeek` preference —
 * unlike `<input type="date">`, which follows the OS locale and ignores
 * the app setting. Renders as a button that toggles a small calendar
 * popover; the popover dismisses on outside-click and on Escape.
 *
 * Props:
 *   value           — 'YYYY-MM-DD' string (controlled).
 *   onChange        — receives the new 'YYYY-MM-DD' on selection.
 *   firstDayOfWeek  — 'sunday' (default) or 'monday'.
 *   placeholder     — text shown when value is empty.
 *   className       — extra classes for the trigger.
 */
export function DatePicker({
  value,
  onChange,
  firstDayOfWeek = 'sunday',
  placeholder = 'Pick a date',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const seed = parseLocalDate(value) || new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const popRef = useRef(null);
  const triggerRef = useRef(null);

  // Re-anchor the cursor whenever the controlled value moves to a different
  // month (e.g. the parent reset to next Sunday after creation).
  useEffect(() => {
    const seed = parseLocalDate(value);
    if (!seed) return;
    if (seed.getFullYear() !== cursor.getFullYear() || seed.getMonth() !== cursor.getMonth()) {
      setCursor(new Date(seed.getFullYear(), seed.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const weekStart = firstDayOffset(firstDayOfWeek);
  const labels = weekdayLabels(firstDayOfWeek);

  const cells = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), weekStart),
    [cursor, weekStart],
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const selected = parseLocalDate(value);

  const triggerLabel = selected
    ? selected.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
    : placeholder;

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleSelect = (date) => {
    onChange?.(toLocalDateStr(date));
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg border bg-[var(--ds-background-100)] text-copy-14 text-left transition-colors hover:border-[var(--ds-gray-600)] ${
          open ? 'border-[var(--ds-gray-600)]' : 'border-[var(--ds-gray-400)]'
        } ${selected ? 'text-[var(--ds-gray-1000)]' : 'text-[var(--ds-gray-600)]'}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ds-gray-600)]">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Select a date"
          className="absolute z-[200] mt-1 w-[19rem] rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] shadow-xl p-3"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-copy-14 font-semibold text-[var(--ds-gray-1000)]">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={goToday}
                className="text-label-11 uppercase tracking-wider text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]"
              >
                Today
              </button>
            </div>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {labels.map(l => (
              <span
                key={l}
                className="text-label-10 uppercase tracking-wider text-center text-[var(--ds-gray-500)] py-1"
              >
                {l}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = d.getTime() === today.getTime();
              const isSelected = selected && toLocalDateStr(d) === toLocalDateStr(selected);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={`h-9 rounded-md text-label-13 font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-brand)] text-white'
                      : isToday
                        ? 'border border-[var(--color-brand)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)]'
                        : 'text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)]'
                  } ${inMonth ? '' : 'text-[var(--ds-gray-500)]'}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
