import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onClose,
  children,
  className,
  size = 'md',
  closeOnBackdrop = true,
  ariaLabel,
}) {
  const panelRef = useRef(null);

  // Keep a ref so the keydown handler always calls the latest onClose without
  // it being a dep of the scroll-lock effect — if onClose is an unmemoized
  // function the combined effect would re-run on every parent render, briefly
  // removing and re-adding 'dialog-open' and causing the background to flicker.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Scroll-lock: only fires when open changes, not on every render.
  // The app's real scroll container is <main> (not <body>), so locking body
  // alone leaves the background draggable on iPad/iOS Safari.
  // The `dialog-open` class on <html> freezes <main> too (see index.css).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('dialog-open');
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove('dialog-open');
    };
  }, [open]);

  // Keyboard dismiss: separate from scroll-lock so onClose changes don't
  // cause the scroll-lock effect to re-run.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-[400px]',
    md: 'max-w-[480px]',
    lg: 'max-w-[760px]',
    xl: 'max-w-[960px]',
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeOnBackdrop ? () => onClose?.() : undefined}
      />
      <div
        ref={panelRef}
        className={cn(
          'relative w-full bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-2xl shadow-2xl',
          'animate-in zoom-in-95 fade-in duration-150',
          widths[size] || widths.md,
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default', // 'default' | 'danger'
  busy = false,
}) {
  const handleConfirm = async () => {
    await onConfirm?.();
    if (!busy) onClose?.();
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} size="sm" ariaLabel={title}>
      <div className="p-6 flex flex-col gap-2">
        {title && (
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">
            {title}
          </h2>
        )}
        {description && (
          <p className="text-copy-14 text-[var(--ds-gray-700)] m-0 whitespace-pre-line">
            {description}
          </p>
        )}
      </div>
      <div className="px-6 pb-6 pt-2 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'default' ? 'primary' : variant}
          size="md"
          onClick={handleConfirm}
          loading={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
