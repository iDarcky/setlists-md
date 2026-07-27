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
import '@/styles/index.css';

// Fire-and-forget — Sentry no-ops if VITE_SENTRY_DSN isn't set.
initSentry();

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
