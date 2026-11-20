import { useEffect, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { SigningInView } from '@/features/intro/IntroAuthViews';

/**
 * Handles the OAuth / magic-link redirect.
 *
 * Supabase's `detectSessionInUrl: true` auto-exchanges the URL fragment/query
 * on load, so in most cases we only need to wait a tick then hand control back
 * to the app. We also manually call `exchangeCodeForSession` as a fallback for
 * PKCE flows that use a `?code=` query param.
 */
export default function AuthCallback({ onDone }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!supabase) {
        setError('Supabase is not configured.');
        return;
      }
      try {
        const url = window.location.href;
        if (url.includes('code=')) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(url);
          if (exchangeErr) throw exchangeErr;
        }
        // Brief wait so detectSessionInUrl can finish if it's still in flight.
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Sign-in failed.');
        return;
      }
      if (cancelled) return;
      // Clear the auth params out of the URL so a refresh doesn't re-trigger.
      window.history.replaceState({}, document.title, window.location.pathname);
      onDone?.();
    };

    run();
    return () => { cancelled = true; };
  }, [onDone]);

  return <SigningInView error={error} onBack={onDone} />;
}
