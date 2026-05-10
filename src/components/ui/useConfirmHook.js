import { useContext } from 'react';
import { ConfirmContext } from './confirmContext';

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return (options) =>
      Promise.resolve(window.confirm(options?.description || options?.title || 'Are you sure?'));
  }
  return ctx;
}
