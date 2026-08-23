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
