import { cn } from './utils';

// The day block at the start of a schedule row: SUN over 15.
// Weekday = caption 12, semibold, uppercase, muted. Day = tabular numerals,
//   md: title 24 (lists)   sm: heading 18 (grid columns, tight rows)
// `muted` greys the number for a day that has passed.

function DateTile({ weekday, day, size = 'md', muted = false, className }) {
  return (
    <span className={cn('flex shrink-0 flex-col items-center leading-none', size === 'sm' ? 'w-10' : 'w-11', className)}>
      <span className="text-caption font-semibold uppercase tracking-[.04em] text-muted-foreground">{weekday}</span>
      <span className={cn('mt-1 font-semibold tabular-nums', size === 'sm' ? 'text-heading' : 'text-title tracking-[-0.5px]', muted && 'text-muted-foreground')}>{day}</span>
    </span>
  );
}

export { DateTile };
