import { useCallback, useRef, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { ConfirmBody } from './ConfirmBody';
import { ConfirmContext } from './confirmContext';

// `await confirm({ title, description, confirmLabel, cancelLabel, variant })`
// from anywhere. A bottom drawer on a phone, a small dialog from the iPad up,
// like every other pop-up.
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setState({ open: true, options: options || {} });
  }), []);

  const close = (result) => {
    setState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const o = state.options;
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet open={state.open} onOpenChange={(open) => { if (!open) close(false); }} title={o.title || 'Are you sure?'}
        className="h-auto max-h-[80dvh] sm:max-w-[420px]">
        <ConfirmBody description={o.description} confirmLabel={o.confirmLabel} cancelLabel={o.cancelLabel} variant={o.variant}
          onConfirm={() => close(true)} onCancel={() => close(false)} />
      </Sheet>
    </ConfirmContext.Provider>
  );
}
