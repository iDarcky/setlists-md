// Toasts moved to Sileo (2026-11-15): see ./toast.jsx. This file stays so the
// existing `import { toast } from '@/ui/use-toast'` calls keep working.
import { toast } from './toast';

function useToast() {
  return { toasts: [], toast, dismiss: () => {} };
}

export { useToast, toast };
