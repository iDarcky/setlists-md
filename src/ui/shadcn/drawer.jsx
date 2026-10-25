import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from './utils';
import { CloseIcon } from './dialog';

// The phone's bottom sheet: 20px top corners, a grab handle, drag down to close.
function Drawer(props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;

function DrawerContent({ className, children, ...props }) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay data-slot="drawer-overlay" className="fixed inset-0 z-[1000] bg-scrim" />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[1000] flex max-h-[calc(100dvh-64px)] flex-col rounded-t-sheet border-t border-border bg-card font-sans text-card-foreground outline-none',
          className,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-input" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerHeader({ className, children, ...props }) {
  return (
    <div data-slot="drawer-header" className={cn('flex shrink-0 items-center justify-between gap-2 py-2 pl-6 pr-3', className)} {...props}>
      {children}
      <DrawerPrimitive.Close className="flex size-11 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close">
        <CloseIcon />
      </DrawerPrimitive.Close>
    </div>
  );
}

function DrawerTitle({ className, ...props }) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cn('m-0 text-[18px] font-semibold leading-6 tracking-[-0.2px]', className)} {...props} />;
}

function DrawerDescription({ className, ...props }) {
  return <DrawerPrimitive.Description data-slot="drawer-description" className={cn('m-0 text-small text-muted-foreground', className)} {...props} />;
}

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription };
