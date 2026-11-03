import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { churchInitials } from '@/lib/joinLink';
import { CheckIcon, PlusIcon } from './navIcons';

// Switch church — opened from the church name in the top bar, only when there
// is more than one to pick. A drawer on a phone, a dialog from the iPad up.

/**
 * @param {Array<{ id, name, avatarUrl? }>} workspaces
 * @param {Function} onPick(id)
 * @param {Function} [onNew]  "New church or band"
 */
export function ChurchSheet({ open, onOpenChange, workspaces = [], activeId, onPick, onNew }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Switch church" className="h-auto max-h-[80dvh] sm:max-w-[440px]">
      <div className="-mx-2 flex flex-col">
        {workspaces.map(w => {
          const on = w.id === activeId;
          return (
            <button
              key={w.id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => { onOpenChange?.(false); if (!on) onPick?.(w.id); }}
              className={cn(
                'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-2 text-left font-sans text-[16px] text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring',
                on && 'font-semibold',
              )}
            >
              {w.avatarUrl
                ? <img src={w.avatarUrl} alt="" aria-hidden="true" className="size-8 rounded-[8px] object-cover" />
                : <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-[8px] bg-raised text-[12px] font-bold text-link">{churchInitials(w.name)}</span>}
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {on && <span className="text-link"><CheckIcon /></span>}
            </button>
          );
        })}
        {onNew && (
          <button
            type="button"
            onClick={() => { onOpenChange?.(false); onNew(); }}
            className="mt-1 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border-0 border-t border-border bg-transparent px-2 text-left font-sans text-[16px] text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-[8px] border border-dashed border-input"><PlusIcon size={16} /></span>
            New church or band
          </button>
        )}
      </div>
    </Sheet>
  );
}
