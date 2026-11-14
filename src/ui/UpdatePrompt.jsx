import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// How often an open app asks the server for a new version. A PWA left open on
// a music stand for hours otherwise only checks when it is opened again.
const CHECK_EVERY_MS = 30 * 60 * 1000;

// The card. The common SaaS shape (Linear, Vercel, Figma, Material's snackbar):
// a small card at the bottom that says an update is ready, offers ONE action,
// and stays until it is used or closed. It never auto-dismisses and never
// reloads by itself. Phone: above the tab bar. Desktop: bottom right.
// INVERTED (ink card on the page, page-coloured button) so it reads as a
// message from the app, not one more card on Home: the first version was
// card-on-card and easy to miss.
export function UpdateLine({ onRefresh, onLater }) {
  return (
    <div role="status" aria-live="polite"
      className="update-card-in fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[60] mx-auto max-w-[420px] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0 sm:w-[380px]">
      <div className="flex items-center gap-2 rounded-card bg-foreground py-2.5 pl-4 pr-2 font-sans text-background shadow-[0_12px_40px_rgba(0,0,0,.45)]">
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-6">Update available</div>
        <button type="button" onClick={onRefresh}
          className="relative h-10 shrink-0 cursor-pointer rounded-control border-0 bg-background px-4 font-sans text-[15px] font-semibold text-foreground hover:opacity-90 active:opacity-80 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']">
          Refresh
        </button>
        <button type="button" onClick={onLater} aria-label="Not now"
          className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-background/70 hover:bg-background/10 hover:text-background">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
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
