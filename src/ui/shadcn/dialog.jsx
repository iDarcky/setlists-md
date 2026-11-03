import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from './utils';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({ className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-[1000] bg-scrim" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-[1000] flex max-h-[min(720px,calc(100dvh-64px))] w-[calc(100%-48px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-border bg-card font-sans text-card-foreground shadow-2xl outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, children, ...props }) {
  return (
    <div data-slot="dialog-header" className={cn('flex shrink-0 items-center justify-between gap-2 py-2 pl-6 pr-3', className)} {...props}>
      {children}
      <DialogPrimitive.Close className="flex size-11 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close">
        <CloseIcon />
      </DialogPrimitive.Close>
    </div>
  );
}

function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('m-0 text-[18px] font-semibold leading-6 tracking-[-0.2px]', className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('m-0 text-small text-muted-foreground', className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, CloseIcon };
