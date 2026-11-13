import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/ui/shadcn/button';

// How often an open app asks the server for a new version. A PWA left open on
// a music stand for hours otherwise only checks when it is opened again.
const CHECK_EVERY_MS = 30 * 60 * 1000;

// The card itself, split out so /design can show it without a service worker.
// The common SaaS shape (Linear, Vercel, Figma, Material's snackbar): a small
// card that slides up at the bottom, says an update is ready, offers ONE
// action, and stays until it is used or closed. It never auto-dismisses, and
// it never reloads by itself. Phone: above the tab bar. Desktop: bottom right.
export function UpdateLine({ onRefresh, onLater, inline = false }) {
  return (
    <div role="status" aria-live="polite"
      className={inline
        ? 'w-full'
        : 'update-card-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[60] mx-auto max-w-[420px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0 sm:w-[360px]'}>
      <div className="flex items-center gap-3 rounded-card border border-border bg-card py-3 pl-3.5 pr-2 font-sans text-foreground shadow-[0_8px_30px_rgba(0,0,0,.28)]">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-foreground">
          <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 10a6 6 0 1 1-1.76-4.24" /><path d="M16 4v3.5h-3.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-5">Update available</div>
          <div className="text-[13px] leading-5 text-muted-foreground">Takes a second.</div>
        </div>
        <Button size="sm" onClick={onRefresh} className="shrink-0">Refresh</Button>
        <button type="button" onClick={onLater} aria-label="Not now"
          className="relative grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground after:absolute after:-inset-1.5 after:content-['']">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}

// "Update available · Refresh". The service worker downloads a release in the
// background and WAITS: nothing reloads until somebody taps Refresh, or the app
// is fully closed and opened again (a waiting worker takes over once no window
// is using the old one). It used to be `registerType: 'autoUpdate'`, which
// reloaded the page by itself the moment a release landed, mid-song included.
//
// Shown on Home only (`suppress` everywhere else): Home is where nobody is
// mid-task, so a reload loses nothing and never lands in a live set. The
// update keeps waiting meanwhile. ✕ hides it until the next app start.
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
