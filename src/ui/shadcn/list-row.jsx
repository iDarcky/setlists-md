import { ChevronRight } from 'lucide-react';
import { cn } from './utils';

// One list row for every list in the app (songs, setlist order, people,
// settings, You). The row owns the shell: height, divider, hover, selected,
// and the two type sizes. What sits left and right stays with the screen.
//
//   [leading]  Title                         [trailing] [>]
//              Sub line
//
// Type: title 16 (text-body), sub 14 (text-small, muted). Weights: `regular`
// for settings-style labels, medium by default, `strong` (600) for the thing
// a list is made of (a song, a setlist).
//
// Rows stack inside a material-base card or a plain column; the divider is
// the top border and the first row drops it.

const SIZES = {
  compact: 'min-h-12',   // one line: settings, menus
  default: 'min-h-14',   // title + sub
  tall: 'min-h-[64px]',  // title + sub + a third thing (faces, a bar)
};

const WEIGHTS = { regular: 'font-normal', medium: 'font-medium', strong: 'font-semibold' };

// eslint-disable-next-line react-refresh/only-export-components
export const listRowShell = (size = 'default', inset = true) => cn(
  'flex w-full min-w-0 items-center gap-3 border-0 border-t border-solid border-border bg-transparent py-2 text-left font-sans text-foreground first:border-t-0',
  SIZES[size] || SIZES.default,
  inset ? 'px-4' : 'px-0',
);

function ListRow({
  title, sub, leading, trailing, children,
  onClick, chevron = false, selected = false, danger = false,
  size = 'default', weight = 'medium', inset = true,
  titleClassName, className, as, ...props
}) {
  const interactive = !!onClick;
  const Comp = as || (interactive ? 'button' : 'div');
  return (
    <Comp
      data-slot="list-row"
      type={Comp === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        listRowShell(size, inset),
        interactive && 'cursor-pointer outline-none hover:bg-raised focus-visible:bg-raised',
        selected && 'bg-selected hover:bg-selected',
        danger && 'text-danger-text',
        className,
      )}
      {...props}
    >
      {leading != null && (
        <span className={cn('flex shrink-0 items-center', danger ? 'text-danger-text' : 'text-muted-foreground')}>{leading}</span>
      )}
      {children ?? (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate text-body', WEIGHTS[weight] || WEIGHTS.medium, titleClassName)}>{title}</span>
          {sub && <span className="truncate text-small text-muted-foreground">{sub}</span>}
        </span>
      )}
      {trailing != null && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {chevron && <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />}
    </Comp>
  );
}

/** The small boxed key at the end of a song row (gold: it is a chord). */
function KeyBadge({ children }) {
  return <span className="flex h-7 min-w-9 items-center justify-center rounded-[6px] bg-raised px-1.5 font-mono text-small font-semibold text-[var(--chord)]">{children}</span>;
}

export { ListRow, KeyBadge };
