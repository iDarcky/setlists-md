import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePill = lazy(() => import('./UpdatePill'));

// How often an open app asks the server for a new version. A PWA left open on
// a music stand for hours otherwise only checks when it is opened again.
const CHECK_EVERY_MS = 30 * 60 * 1000;

// "Update available" pill, top centre (Sileo, in ./UpdatePill). Tap it (hover on desktop) and
// it opens to show Refresh. It can't be closed or swiped away: it stays on
// Home until somebody refreshes, or the app is fully closed and opened again.
//
// The service worker downloads a release in the background and WAITS: nothing
// reloads until somebody taps Refresh, or no window is using the old version
// any more. It used to be `registerType: 'autoUpdate'`, which reloaded the page
// by itself the moment a release landed, mid-song included.
//
// Shown on Home only (`suppress` everywhere else): Home is where nobody is
// mid-task, so a reload loses nothing and it never shows in the reader or a
// live set. The update keeps waiting meanwhile.
export default function UpdatePrompt({ suppress = false }) {
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
  const refresh = useCallback(() => {
    if (registration?.waiting) updateServiceWorker(true);
    else window.location.reload();
  }, [registration, updateServiceWorker]);

  if (!needRefresh || suppress) return null;
  return (
    <Suspense fallback={null}>
      <UpdatePill onRefresh={refresh} />
    </Suspense>
  );
}
