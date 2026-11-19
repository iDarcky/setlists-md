import { undoToast } from '@/ui/toast';

// A "deleted · Undo" toast (Sileo, red, 5s). The caller has ALREADY removed the
// thing optimistically; Undo puts it back via `onUndo`.
export function showUndoToast({ title, onUndo }) {
  return undoToast({ title, onUndo });
}
