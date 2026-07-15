import { useEffect, useState } from 'react';

const DURATION = 5000; // matches the Radix ToastProvider auto-dismiss default

// A small circular countdown (ring drains over 5s, number ticks 5→1) shown at
// the left of the undo toast, so it's clear how long the Undo window lasts.
export default function UndoToastContent({ label, onUndo }) {
  const [remaining, setRemaining] = useState(DURATION);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, DURATION - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(1, Math.ceil(remaining / 1000));
  const C = 2 * Math.PI * 9;
  const offset = C * (1 - remaining / DURATION);
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative shrink-0 w-6 h-6 grid place-items-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--ds-gray-400)" strokeWidth="2" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums text-[var(--ds-gray-1000)] leading-none">{secs}</span>
      </span>
      <span className="text-label-13 font-medium text-[var(--ds-gray-1000)] whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        className="ml-1 h-7 px-2.5 rounded-md border border-[var(--ds-gray-400)] text-label-12 font-semibold text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] cursor-pointer bg-transparent"
      >
        Undo
      </button>
    </div>
  );
}
