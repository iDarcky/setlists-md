import { cn } from '@/ui/shadcn/utils';
import { churchInitials } from '@/lib/joinLink';
import { BellIcon, ChevronDownIcon, PlusIcon } from './navIcons';

// The one top bar (canvas "Signed out and joining" → Navigation options):
// the church on the left, the bell and your avatar on the right. From 1024px
// the nav pill sits in the middle (`pill`). No search here any more — Songs
// has its own.

function ChurchMark({ name, logoUrl }) {
  if (logoUrl) return <img src={logoUrl} alt="" aria-hidden="true" className="size-[30px] rounded-[8px] object-cover" />;
  return (
    <span aria-hidden="true" className="flex size-[30px] items-center justify-center rounded-[8px] bg-raised text-[12px] font-bold text-link">
      {churchInitials(name)}
    </span>
  );
}

export function Avatar({ name, url, size = 32 }) {
  if (url) return <img src={url} alt="" aria-hidden="true" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-full bg-link font-semibold text-background"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.375) }}
    >
      {churchInitials(name)}
    </span>
  );
}

// Below 1024px the bar is compact (two columns, + as an icon); from 1024px it
// is wide (pill in the middle, "+ New song" spelled out). `layout` pins one of
// them — /design draws both side by side, whatever the window's width.
const LAYOUTS = {
  auto: {
    header: 'grid-cols-[minmax(0,1fr)_auto] pl-4 pr-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:border-b lg:border-border lg:pl-5 lg:pr-4',
    row: 'h-14 lg:h-16', pill: 'hidden lg:block', right: 'gap-0.5 lg:gap-1', addIcon: 'lg:hidden', addWide: 'hidden lg:flex',
  },
  compact: {
    header: 'grid-cols-[minmax(0,1fr)_auto] pl-4 pr-2',
    row: 'h-14', pill: 'hidden', right: 'gap-0.5', addIcon: '', addWide: 'hidden',
  },
  wide: {
    header: 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] border-b border-border pl-5 pr-4',
    row: 'h-16', pill: 'block', right: 'gap-1', addIcon: 'hidden', addWide: 'flex',
  },
};

const iconButton = 'relative flex size-11 min-h-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

/**
 * @param {{ name: string, logoUrl?: string }} church
 * @param {Function} [onOpenChurches]  only when there is more than one to pick
 * @param {boolean} [unread]           dot on the bell
 * @param {Function} [onOpenNotifications]
 * @param {{ name: string, url?: string }} me
 * @param {number} [meBadge]           dot on the avatar (join requests waiting)
 * @param {Function} onOpenYou
 * @param {{ label: string, onClick: Function }} [add]  leaders' "+" on Songs / Schedule
 * @param {React.ReactNode} [pill]     the nav pill, shown from 1024px
 * @param {'auto'|'compact'|'wide'} [layout]
 */
export function AppTopBar({ church, onOpenChurches, unread, onOpenNotifications, me, meBadge = 0, onOpenYou, add, pill, layout = 'auto', className }) {
  const L = LAYOUTS[layout] || LAYOUTS.auto;
  const churchInner = (
    <>
      <ChurchMark name={church?.name} logoUrl={church?.logoUrl} />
      <span className="truncate">{church?.name}</span>
      {onOpenChurches && <span className="text-muted-foreground"><ChevronDownIcon /></span>}
    </>
  );
  return (
    <header
      data-slot="app-top-bar"
      className={cn(
        'grid shrink-0 items-center bg-background font-sans text-foreground', L.header,
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className={cn('flex min-w-0 items-center', L.row)}>
        {onOpenChurches ? (
          <button
            type="button"
            onClick={onOpenChurches}
            aria-label={`${church?.name}. Switch church`}
            className="flex h-11 min-h-0 min-w-0 cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-1.5 -ml-1.5 font-sans text-[16px] font-semibold tracking-[-0.2px] text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
          >
            {churchInner}
          </button>
        ) : (
          <div className="flex h-11 min-w-0 items-center gap-2.5 text-[16px] font-semibold tracking-[-0.2px]">{churchInner}</div>
        )}
      </div>
      {pill && <div className={L.pill}>{pill}</div>}
      <div className={cn('flex items-center justify-self-end', L.right)}>
        {add && (
          <>
            <button type="button" onClick={add.onClick} aria-label={add.label} className={cn(iconButton, L.addIcon)}>
              <PlusIcon />
            </button>
            <button
              type="button"
              onClick={add.onClick}
              className={cn('mr-1 h-9 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-primary px-3.5 font-sans text-[14px] font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring', L.addWide)}
            >
              <PlusIcon size={16} />
              {add.label}
            </button>
          </>
        )}
        {onOpenNotifications && (
          <button type="button" onClick={onOpenNotifications} aria-label={unread ? 'Notifications, new' : 'Notifications'} className={iconButton}>
            <BellIcon />
            {unread && <span aria-hidden="true" className="absolute right-[11px] top-[10px] size-2 rounded-full bg-link shadow-[0_0_0_2px_var(--background)]" />}
          </button>
        )}
        <button type="button" onClick={onOpenYou} aria-label="You: profile and settings" className={iconButton}>
          <Avatar name={me?.name} url={me?.url} />
          {meBadge > 0 && <span aria-hidden="true" className="absolute right-[7px] top-[7px] size-2.5 rounded-full bg-danger shadow-[0_0_0_2px_var(--background)]" />}
        </button>
      </div>
    </header>
  );
}
