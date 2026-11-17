import type { ReactNode } from 'react';
import { BottomSheet, Dialog, DialogContent, DialogHeader, DialogTitle, useMediaQuery } from './ui';

/** A sheet from the bottom on a phone, a centred dialog from the iPad up (CLAUDE.md). */
export function Panel({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  const wide = useMediaQuery('(min-width: 768px)');
  if (!wide) {
    return <BottomSheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto">{children}</BottomSheet>;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-[440px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="overflow-y-auto px-6 pt-1 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
