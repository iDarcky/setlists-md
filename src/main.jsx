import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import App from './App';
import { AuthProvider } from '@/auth/AuthProvider';
import { TeamProvider } from '@/auth/TeamProvider';
import { ConfirmProvider } from '@/ui/useConfirm';
import { initSentry } from './sentry';
import { installAppViewport } from '@/lib/appViewport';
import '@/styles/index.css';

// Fire-and-forget — Sentry no-ops if VITE_SENTRY_DSN isn't set.
initSentry();

// Publish `--app-vh` before React's first paint — see `lib/appViewport.js` for
// why `100dvh` alone was leaving the reader's bottom bar short of the screen.
installAppViewport();

// A code file from an older release could not load (the server only keeps the
// newest). Nothing on screen can be drawn without it, so reload once onto the
// new version instead of showing the full-screen "There's a new version" page.
// The update card on Home is the normal way in; this is the rare fallback,
// mostly for the lazy files kept out of the offline cache (PDF import, chord
// diagrams). The 10-second guard stops a reload loop when the network itself is
// down; the error page then shows as before.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'setlists-md:preload-reload';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TeamProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </TeamProvider>
    </AuthProvider>
  </React.StrictMode>
);
