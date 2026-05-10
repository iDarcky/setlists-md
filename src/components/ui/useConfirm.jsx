import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from './Dialog';
import { ConfirmContext } from './confirmContext';

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options: options || {} });
    });
  }, []);

  const handleClose = (result) => {
    setState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        onClose={() => handleClose(false)}
        onConfirm={() => handleClose(true)}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        variant={state.options.variant}
      />
    </ConfirmContext.Provider>
  );
}

