import React, { useEffect, useRef, useState } from 'react';
import { exchangeGoogleAuthCode } from '../../sync/google-drive';
import { setActiveProvider } from '../../sync/tokens';
import { Button } from '../ui/Button';

// Handles the redirect from Google's consent screen at /auth/google-drive.
// Calls the cloud-token-exchange Edge Function to swap the auth code for
// a short-lived access token (the refresh token stays server-side), then
// activates the provider and bounces the user back into the app.

export default function GoogleDriveCallback({ onDone, onCancel }) {
  const ran = useRef(false);
  const [status, setStatus] = useState('working'); // working | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const oauthError = params.get('error');

      if (oauthError) {
        setStatus('error');
        setErrorMsg(`Google returned: ${oauthError}`);
        return;
      }
      if (!code || !state) {
        setStatus('error');
        setErrorMsg('Missing OAuth code or state in callback URL.');
        return;
      }

      try {
        const result = await exchangeGoogleAuthCode({ code, state });
        await setActiveProvider('google-drive', {
          accessToken: result.accessToken,
          expiresAt: typeof result.expiresAt === 'string'
            ? new Date(result.expiresAt).getTime()
            : result.expiresAt,
        });
        // Clean the URL so a refresh doesn't replay the (now-spent) code.
        window.history.replaceState({}, '', '/');
        onDone?.();
      } catch (err) {
        setStatus('error');
        setErrorMsg(err?.message || 'Could not complete Google Drive connection.');
      }
    })();
  }, [onDone]);

  return (
    <div className="min-h-screen bg-[var(--ds-background-100)] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center flex flex-col gap-4">
        <img src="/setlists-md-mark.svg" alt="" width="48" height="48" className="rounded-xl mx-auto" />
        {status === 'working' && (
          <>
            <h1 className="text-heading-20 text-[var(--ds-gray-1000)] m-0">Connecting Google Drive…</h1>
            <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">Finishing the secure handshake. This usually takes a second.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-heading-20 text-[var(--ds-gray-1000)] m-0">Couldn't connect Google Drive</h1>
            <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">{errorMsg}</p>
            <div className="flex gap-2 justify-center mt-2">
              <Button variant="secondary" size="sm" onClick={onCancel}>Back to app</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
