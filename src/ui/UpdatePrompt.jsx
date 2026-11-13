import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { cn } from '@/ui/shadcn/utils';

// How often an open app asks the server for a new version. A PWA left open on
// a music stand for hours otherwise only checks when it is opened again.
const CHECK_EVERY_MS = 30 * 60 * 1000;

// The pill itself, split out so /design can show it without a service worker.
// Same shape and spot as the offline line: one quiet line from the top.
export function UpdateLine({ onRefresh, onLater, inline = false }) {
  return (
    <div role="status" aria-live="polite"
      className={inline ? 'flex justify-center' : 'pointer-events-none fixed inset-x-0 z-[121] flex justify-center px-4'}
      style={inline ? undefined : { top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className="pointer-events-auto inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card py-1 pl-3.5 pr-1 font-sans text-[13px] font-medium text-foreground shadow-md">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
        <span className="ml-1 truncate">New version ready</span>
        <button type="button" onClick={onRefresh}
          className="relative ml-1.5 h-7 rounded-full bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:opacity-90 active:opacity-80 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']">
          Refresh
        </button>
        <button type="button" onClick={onLater} aria-label="Later"
          className={cn('relative grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground',
            "after:absolute after:-inset-2 after:content-['']")}>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}

// "New version ready · Refresh". The service worker downloads a release in the
// background and WAITS: nothing reloads until somebody taps Refresh, or the app
// is fully closed and opened again (a waiting worker takes over once no window
// is using the old one). It used to be `registerType: 'autoUpdate'`, which
// reloaded the page by itself the moment a release landed, mid-song included.
//
// `suppress` hides the pill (the update keeps waiting) where covering the
// screen or reloading would hurt: the reader, live or practice. It shows again
// the moment the person leaves. "Later" hides it until the next app start.
export default function UpdatePrompt({ suppress = false }) {
  const [dismissed, setDismissed] = useState(false);
  const [registration, setRegistration] = useState(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) { if (reg) setRegistration(reg); },
    onRegisterError(err) {
      console.warn('[pwa] service worker registration failed:', err);
    },
  });

  // Look for a new release every half hour while open, and whenever the app
  // comes back to the front. Only downloads; never applies.
  useEffect(() => {
    if (!registration) return undefined;
    const check = () => {
      if (registration.installing || !navigator.onLine) return;
      registration.update().catch(() => {});
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [registration]);

  // A waiting worker is told to take over, and the page reloads once it does.
  // On a first visit the page was never controlled, so the new worker is
  // already active with nothing waiting: a plain reload picks it up.
  const refresh = () => {
    if (registration?.waiting) updateServiceWorker(true);
    else window.location.reload();
  };

  if (!needRefresh || suppress || dismissed) return null;
  return <UpdateLine onRefresh={refresh} onLater={() => setDismissed(true)} />;
}
