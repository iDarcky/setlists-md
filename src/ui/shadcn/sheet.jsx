import { useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from './drawer';
import { cn } from './utils';

// One rule for every pop-up: a bottom drawer on a phone, a centred dialog from
// the iPad up (640px, Tailwind's `sm`).
const QUERY = '(min-width: 640px)';
const subscribe = (cb) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getWide = () => window.matchMedia(QUERY).matches;

function Sheet({ open, onOpenChange, title, description, children, className }) {
  const wide = useSyncExternalStore(subscribe, getWide, () => true);
  // Radix warns about a dialog with no description unless told there is none.
  const noDescription = description ? {} : { 'aria-describedby': undefined };
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className} {...noDescription}>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {description && <DialogDescription className="sr-only">{description}</DialogDescription>}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('h-[calc(100dvh-64px)]', className)} {...noDescription}>
        <DrawerHeader><DrawerTitle>{title}</DrawerTitle></DrawerHeader>
        {description && <DrawerDescription className="sr-only">{description}</DrawerDescription>}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2" data-vaul-no-drag>{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

export { Sheet };
