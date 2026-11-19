import { cn } from './utils';

// A pick / filter chip: a round pill you tap to turn on (Key, Not played
// lately, a date, a tag). 36px on a phone (44px to tap), 32px from the iPad
// up, text 14 medium in both states so it never changes width.
// Off = hairline edge, muted text. On = green edge + selected fill.
// For a status (Ready, Invited, Can't) use Badge, which is not tappable.

// eslint-disable-next-line react-refresh/only-export-components
export const chipClass = (on = false, { dashed = false } = {}) => cn(
  "relative inline-flex h-9 min-h-0 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-sans text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 sm:h-8 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  on
    ? 'border-link bg-selected text-foreground'
    : dashed
      ? 'border-dashed border-input bg-transparent text-muted-foreground hover:text-foreground'
      : 'border-chip-border bg-transparent text-muted-foreground hover:text-foreground',
);

function Chip({ on = false, dashed = false, className, children, ...props }) {
  return (
    <button type="button" aria-pressed={on} className={cn(chipClass(on, { dashed }), className)} {...props}>
      {children}
    </button>
  );
}

export { Chip };
