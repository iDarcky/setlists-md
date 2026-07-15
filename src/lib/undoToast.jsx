import { toast } from '../components/ui/use-toast';
import { ToastAction } from '../components/ui/Toast';

// Show a "deleted — Undo" toast. The caller has ALREADY removed the thing
// optimistically; this just offers a 5s window (the Radix default) to put it
// back via `onUndo`. Pattern: remove now, restore on Undo — no deferred-commit
// timer, so it sidesteps the TOAST_LIMIT=1 eviction of back-to-back deletes.
export function showUndoToast({ title, description, onUndo }) {
  const t = toast({
    title,
    description,
    action: (
      <ToastAction
        altText="Undo"
        onClick={() => { onUndo?.(); t.dismiss(); }}
      >
        Undo
      </ToastAction>
    ),
  });
  return t;
}
