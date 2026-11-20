import { useState } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion as Motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { Button, Popover, PopoverTrigger, PopoverContent, MenuItem, MenuSeparator, menuContent } from '@/ui/typed';

// The + that starts something (Home and Songs, the same menu on both: New
// song, Import PDFs, New setlist; owner 2026-11-20). It opens a small menu
// that springs from the button. Rows are the shared MenuItem: 44px on a
// phone, 40px from the iPad up. The + never turns into an ✕ (owner,
// 2026-11-15: "Don't rotate the +").

export interface CreateItem {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onSelect: () => void;
  /** Draw a line above this row. */
  divider?: boolean;
}

export function CreateButton({ items, label = 'Create' }: { items: CreateItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" aria-label={label} className="size-11 shrink-0 rounded-control">
          <Plus size={20} strokeWidth={2} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <AnimatePresence>
        {open && (
          <PopoverContent forceMount asChild align="end" sideOffset={8} className={menuContent}>
            <Motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ transformOrigin: 'top right' }}
            >
              {items.map((it, i) => (
                <div key={it.label}>
                  {it.divider && i > 0 && <MenuSeparator />}
                  <MenuItem
                    icon={<it.icon size={18} strokeWidth={1.8} />}
                    onClick={() => { setOpen(false); it.onSelect(); }}
                  >
                    {it.label}
                  </MenuItem>
                </div>
              ))}
            </Motion.div>
          </PopoverContent>
        )}
      </AnimatePresence>
    </Popover>
  );
}
