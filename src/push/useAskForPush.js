import { useCallback } from 'react';
import { useConfirm } from '@/ui/useConfirmHook';

// Ask in our own words before the browser asks in its. A "Block" on the
// browser's prompt is near impossible to undo (it lives in site settings), so
// the browser only asks once someone has already said yes here. "Not now"
// costs nothing: the Home checklist and the bell still offer it later.
export function useAskForPush(push) {
  const confirm = useConfirm();
  return useCallback(async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return push.enable();
    const ok = await confirm({
      title: 'Get a buzz when you’re asked to play?',
      description: 'We’ll let you know when a leader asks you to play, when a setlist is ready, and when it changes. Nothing else.\n\nYour phone will ask next. Tap Allow.',
      confirmLabel: 'Turn on',
      cancelLabel: 'Not now',
    });
    if (ok) return push.enable();
    return false;
  }, [confirm, push]);
}
