import { useEffect, useRef, useState } from 'react';
import { formatClockTime } from '../../lib/dateFormat';

const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

function clampHour24(h) {
  if (Number.isNaN(h)) return 0;
  return Math.max(0, Math.min(23, h));
}

function snapMinute(m) {
  if (Number.isNaN(m)) return 0;
  // Snap to the nearest MINUTE_STEP and clamp to [0, 59].
  const snapped = Math.round(m / MINUTE_STEP) * MINUTE_STEP;
  return Math.max(0, Math.min(55, snapped));
}

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return { h: 0, m: 0 };
  const [hStr, mStr] = value.split(':');
  return { h: clampHour24(parseInt(hStr, 10)), m: snapMinute(parseInt(mStr, 10)) };
}

function toHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Inline time picker that honors the app's `clockFormat` preference.
 * Native `<input type="time">` follows the OS locale and ignores app
 * settings, so we pick the format ourselves: 24-hour shows two columns,
 * 12-hour adds an AM/PM segment. The underlying value stays as a 24-hour
 * 'HH:MM' string regardless of how it's displayed.
 *
 * Minutes snap to 5-minute increments — matches the granularity worship
 * teams typically schedule.
 */
export function TimePicker({
  value,
  onChange,
  clockFormat = '12h',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popRef = useRef(null);

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

  const { h: hour24, m: minute } = parseHHMM(value);
  const displayLabel = formatClockTime(value || '00:00', clockFormat);

  const setTime = (h, m) => {
    onChange?.(toHHMM(clampHour24(h), snapMinute(m)));
  };

  const meridiem = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = ((hour24 + 11) % 12) + 1;
  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  const hours12 = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleHourChange = (e) => {
    const next = parseInt(e.target.value, 10);
    if (Number.isNaN(next)) return;
    if (clockFormat === '24h') {
      setTime(next, minute);
    } else {
      // Convert the chosen 12h hour back to 24h, preserving AM/PM.
      const base = next % 12; // 12 → 0
      const h24 = meridiem === 'pm' ? base + 12 : base;
      setTime(h24, minute);
    }
  };

  const handleMinuteChange = (e) => {
    const next = parseInt(e.target.value, 10);
    if (Number.isNaN(next)) return;
    setTime(hour24, next);
  };

  const setMeridiem = (next) => {
    if (next === meridiem) return;
    // Flip noon on the AM/PM toggle: subtract or add 12 from the 24h slot.
    const flipped = next === 'pm' ? hour24 + 12 : hour24 - 12;
    setTime(flipped, minute);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg border bg-[var(--ds-background-100)] text-copy-14 text-left transition-colors hover:border-[var(--ds-gray-600)] ${
          open ? 'border-[var(--ds-gray-600)]' : 'border-[var(--ds-gray-400)]'
        } text-[var(--ds-gray-1000)]`}
      >
        <span className="truncate tabular-nums">{displayLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ds-gray-600)]">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Select a time"
          className="absolute z-[200] mt-1 right-0 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] shadow-xl p-3 flex items-center gap-2"
        >
          <select
            value={clockFormat === '24h' ? hour24 : hour12}
            onChange={handleHourChange}
            className="h-10 px-2 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-copy-14 tabular-nums focus:outline-none focus:border-[var(--ds-gray-600)]"
            aria-label="Hour"
          >
            {(clockFormat === '24h' ? hours24 : hours12).map(h => (
              <option key={h} value={h}>
                {clockFormat === '24h' ? String(h).padStart(2, '0') : h}
              </option>
            ))}
          </select>

          <span className="text-copy-16 text-[var(--ds-gray-700)] font-bold">:</span>

          <select
            value={minute}
            onChange={handleMinuteChange}
            className="h-10 px-2 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-copy-14 tabular-nums focus:outline-none focus:border-[var(--ds-gray-600)]"
            aria-label="Minute"
          >
            {MINUTES.map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>

          {clockFormat !== '24h' && (
            <div className="flex items-center bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-lg p-0.5 ml-1">
              {['am', 'pm'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeridiem(m)}
                  className={`h-9 px-2.5 rounded-md text-label-12 font-semibold uppercase transition-colors ${
                    meridiem === m
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
