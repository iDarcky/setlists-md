import { Check } from 'lucide-react';
import { cn } from './utils';

// Menu items for a PopoverContent (⋮ menus, pickers, the + menu).
// One item everywhere: 44px on a phone / 40px from the iPad up, text 16 / 14
// (the same steps as Button), icon 18 muted, radius control, hover/focus =
// raised, picked = selected with a check, danger = red text.
//
//   <PopoverContent className={menuContent}> <MenuItem icon={…}>Edit</MenuItem> …

/** Padding + width for a PopoverContent that holds MenuItems. */
export const menuContent = 'flex w-60 flex-col p-1';

// eslint-disable-next-line react-refresh/only-export-components
export const menuItemClass = cn(
  'flex h-11 min-h-0 w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-body text-foreground outline-none',
  'hover:bg-raised focus-visible:bg-raised disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent sm:h-10 sm:text-small',
);

function MenuItem({ icon, children, sub, trailing, selected, danger, className, ...props }) {
  return (
    <button
      type="button"
      role={selected != null ? 'menuitemradio' : 'menuitem'}
      aria-checked={selected != null ? !!selected : undefined}
      className={cn(menuItemClass, sub && 'h-auto min-h-12 py-1.5 sm:h-auto', selected && 'bg-selected hover:bg-selected', danger && 'text-danger-text', className)}
      {...props}
    >
      {icon != null && <span className={cn('flex w-[18px] shrink-0 items-center justify-center [&_svg]:size-[18px]', danger ? 'text-danger-text' : 'text-muted-foreground')}>{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {sub && <span className="truncate text-small text-muted-foreground sm:text-caption">{sub}</span>}
      </span>
      {trailing}
      {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-link" strokeWidth={2} />}
    </button>
  );
}

function MenuSeparator({ className }) {
  return <div role="separator" className={cn('-mx-1 my-1 h-px shrink-0 bg-border', className)} />;
}

function MenuLabel({ children, className }) {
  return <div className={cn('px-2.5 pb-1 pt-2 text-label text-muted-foreground', className)}>{children}</div>;
}

export { MenuItem, MenuSeparator, MenuLabel };
