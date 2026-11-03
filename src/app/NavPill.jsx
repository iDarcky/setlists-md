import { cn } from '@/ui/shadcn/utils';
import { NAV_ITEMS } from './navItems';

// The app's three places, as one pill (canvas "Signed out and joining" →
// Navigation options, bar B). Below 1024px it floats at the bottom, within
// thumb reach — phone and iPad portrait. From 1024px (iPad landscape,
// desktop) the same pill sits in the middle of the top bar.

/**
 * @param {'bottom'|'top'} placement
 * @param {string|null} active  an id from NAV_ITEMS
 * @param {Function} onSelect(id)
 * @param {boolean} [embedded]  absolute instead of fixed (/design)
 */
export function NavPill({ placement = 'bottom', active, onSelect, embedded = false, className }) {
  const top = placement === 'top';
  return (
    <nav
      aria-label="Main"
      data-slot="nav-pill"
      className={cn(
        'flex gap-0.5 rounded-full border border-border bg-card font-sans',
        top
          ? 'p-1'
          : cn(
            'z-[150] p-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.35)] left-1/2 -translate-x-1/2',
            embedded ? 'absolute' : 'fixed',
          ),
        className,
      )}
      style={top ? undefined : { bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
    >
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onSelect?.(id)}
            className={cn(
              'flex min-h-0 cursor-pointer items-center justify-center rounded-full border-0 font-sans outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              top
                ? 'h-[38px] gap-2 pl-3 pr-4 text-[14px] [&_svg]:size-[18px]'
                : 'h-[50px] w-[84px] flex-col gap-0.5 text-[11px] sm:h-[54px] sm:w-[104px] sm:text-[12px]',
              on
                ? 'bg-selected font-semibold text-foreground [&_svg]:text-link'
                : 'bg-transparent font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
