import { useEffect, useRef, useState } from 'react';

const DURATION = 5000; // undo window

// A small circular countdown (ring drains over 5s, number ticks 5→1) at the
// left of the undo toast. Calls onExpire once the window elapses so the toast
// reliably dismisses even if the Radix auto-timer was paused (hover/focus).
export default function UndoToastContent({ label, onUndo, onExpire }) {
  const [remaining, setRemaining] = useState(DURATION);
  const firedRef = useRef(false);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, DURATION - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        if (!firedRef.current) { firedRef.current = true; onExpire?.(); }
      }
    }, 50);
    return () => clearInterval(id);
  }, [onExpire]);
  const secs = Math.max(1, Math.ceil(remaining / 1000));
  const R = 8;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - remaining / DURATION);
  return (
    <div className="flex items-center gap-2">
      <span className="relative shrink-0 w-5 h-5 grid place-items-center">
        <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
          <circle cx="10" cy="10" r={R} fill="none" stroke="var(--ds-gray-400)" strokeWidth="2" />
          <circle cx="10" cy="10" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <span className="absolute text-[9px] font-bold tabular-nums text-[var(--ds-gray-1000)] leading-none">{secs}</span>
      </span>
      <span className="text-label-12 font-medium text-[var(--ds-gray-1000)] whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        className="ml-0.5 h-6 px-2 rounded-md border border-[var(--ds-gray-400)] text-label-12 font-semibold text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] cursor-pointer bg-transparent"
      >
        Undo
      </button>
    </div>
  );
}
