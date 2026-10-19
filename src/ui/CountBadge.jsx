/**
 * A small brand-coloured count pill (e.g. "Asking to join · 3" on the Team
 * entry points). Renders nothing for 0. `absolute` pins it to a corner of a
 * `relative` parent, the way the bell's unread badge sits.
 */
export default function CountBadge({ count = 0, absolute = false, className = '', label }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span
      aria-label={label || `${n} waiting`}
      className={`${absolute ? 'absolute top-2.5 right-2' : 'inline-block'} min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold leading-[16px] text-center ${className}`}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}
