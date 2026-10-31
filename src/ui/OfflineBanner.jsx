import { useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';

// One quiet line at the top while the device is offline, and a short "Back
// online" when it returns, so nobody wonders whether their edits went
// anywhere. Edits always save on the device; sync catches up on reconnect.
// `inline` drops the fixed position, for /design.
export function OfflineLine({ state, inline = false }) {
  if (!state) return null;
  const back = state === 'back';
  return (
    <div role="status" aria-live="polite"
      className={inline ? 'flex justify-center' : 'pointer-events-none fixed inset-x-0 z-[120] flex justify-center px-4'}
      style={inline ? undefined : { top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className={cn(
        'pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 font-sans text-[13px] font-medium shadow-sm',
        back ? 'border-success/30 bg-success-fill text-success-text' : 'border-warning/30 bg-warning-fill text-warning-text',
      )}>
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', back ? 'bg-success' : 'bg-warning')} />
        <span className="truncate">
          {back ? 'Back online. Syncing your changes.' : 'Offline. Changes save here and sync later.'}
        </span>
      </div>
    </div>
  );
}

export default function OfflineBanner() {
  const [state, setState] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : null));
  const timer = useRef(null);

  useEffect(() => {
    const onUp = () => {
      setState(prev => (prev === 'offline' ? 'back' : prev));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState(prev => (prev === 'back' ? null : prev)), 3000);
    };
    const onDown = () => { clearTimeout(timer.current); setState('offline'); };
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  return <OfflineLine state={state} />;
}
