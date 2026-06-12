import { useState } from 'react';
import { Button } from '../ui/Button';
import { toast } from '../ui/use-toast';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function defaultEndDate() {
  // Default to 8 weeks from today.
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Lets a member declare a repeating availability rule
 * (e.g. "Available every Sunday through August 31").
 * Iterates the matching dates between today and end date and calls
 * setStatus for each.
 */
export default function RecurringPicker({ onApply }) {
  const [open, setOpen] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(0); // Sunday default
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [status, setStatus] = useState('available');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (busy) return;
    const end = new Date(endDate + 'T00:00:00');
    if (Number.isNaN(end.getTime())) {
      toast({ title: 'Invalid end date', variant: 'error' });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end < today) {
      toast({ title: 'End date must be in the future', variant: 'error' });
      return;
    }
    const dates = [];
    const cursor = new Date(today);
    // Walk forward to the next matching weekday.
    while (cursor.getDay() !== dayOfWeek) cursor.setDate(cursor.getDate() + 1);
    while (cursor <= end) {
      dates.push(toLocalDateStr(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    if (dates.length === 0) {
      toast({ title: 'No matching dates in range' });
      return;
    }
    setBusy(true);
    try {
      await onApply(dates, status);
      toast({
        title: `Marked ${dates.length} ${DAYS_OF_WEEK[dayOfWeek].label}${dates.length === 1 ? '' : 's'} ${status}`,
      });
      setOpen(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err.message || String(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--modes-border)] text-copy-13 text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)] transition-colors cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9" />
          <polyline points="3 4 3 12 11 12" />
        </svg>
        Set a recurring availability
      </button>
    );
  }

  return (
    <div className="modes-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-copy-14 font-bold text-[var(--modes-text)]">Recurring availability</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-copy-13 text-[var(--modes-text-dim)] hover:text-[var(--modes-text)] cursor-pointer bg-transparent border-none"
        >
          Cancel
        </button>
      </div>
      <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
        Mark every matching day in the range as available or unavailable.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-wider font-semibold">Status</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-9 px-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-copy-14 outline-none"
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="maybe">Maybe</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-wider font-semibold">Every</span>
          <select
            value={dayOfWeek}
            onChange={e => setDayOfWeek(Number(e.target.value))}
            className="h-9 px-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-copy-14 outline-none"
          >
            {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-wider font-semibold">Through</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-9 px-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-copy-14 outline-none"
          />
        </label>
        <Button variant="brand" size="sm" onClick={apply} disabled={busy}>
          {busy ? 'Saving…' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}
