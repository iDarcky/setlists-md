import { toast } from '../components/ui/use-toast';
import UndoToastContent from '../components/ui/UndoToastContent';

// Show a compact "deleted — Undo" toast with a 5s countdown ring. The caller has
// ALREADY removed the thing optimistically; Undo puts it back via `onUndo`.
export function showUndoToast({ title, onUndo }) {
  const t = toast({
    className: 'p-2.5 pr-9 w-auto min-w-0',
    title: <UndoToastContent label={title} onUndo={() => { onUndo?.(); t.dismiss(); }} />,
  });
  return t;
}
