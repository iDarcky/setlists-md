import { Button } from '@/ui/shadcn/button';

// What a confirm says under its title, and its two buttons. On a phone the
// action sits on top, full width, where the thumb is; from 640px they sit in a
// row on the right, action last. `cancelLabel: null` leaves one button, for a
// pop-up that only tells you something.
export function ConfirmBody({ description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel, busy = false }) {
  return (
    <div className="flex flex-col gap-5 font-sans">
      {description && <p className="m-0 whitespace-pre-line text-[15px] leading-6 text-muted-foreground">{description}</p>}
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <Button variant={variant === 'danger' ? 'destructive' : 'default'} onClick={onConfirm} loading={busy} autoFocus>{confirmLabel}</Button>
        {cancelLabel !== null && <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>}
      </div>
    </div>
  );
}
