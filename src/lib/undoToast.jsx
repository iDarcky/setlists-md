import { toast } from '@/ui/use-toast';
import UndoToastContent from '@/ui/UndoToastContent';

// Show a compact "deleted — Undo" toast with a 5s countdown ring. The caller has
// ALREADY removed the thing optimistically; Undo puts it back via `onUndo`. The
// toast dismisses itself when the ring runs out (onExpire), not only via Radix.
export function showUndoToast({ title, onUndo }) {
  const t = toast({
    duration: 5000,
    className: 'p-2 pr-8 w-fit min-w-0 self-end',
    title: (
      <UndoToastContent
        label={title}
        onUndo={() => { onUndo?.(); t.dismiss(); }}
        onExpire={() => t.dismiss()}
      />
    ),
  });
  return t;
}
