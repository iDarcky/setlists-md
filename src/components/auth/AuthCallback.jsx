import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabase';

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

  return (
    <div data-theme-variant="modes" className="min-h-screen flex items-center justify-center px-6">
      <div className="border border-[var(--notion-border)] rounded-lg bg-[var(--notion-bg)] max-w-sm p-8 text-center">
        {error ? (
          <>
            <h2 className="text-heading-20 text-[var(--notion-text-main)] m-0 mb-2">Sign-in failed</h2>
            <p className="text-copy-14 text-[var(--notion-text-dim)] m-0 mb-4">{error}</p>
            <button
              onClick={onDone}
              className="text-[var(--color-brand)] font-semibold bg-transparent border-none cursor-pointer"
            >
              Back
            </button>
          </>
        ) : (
          <>
            <h2 className="text-heading-20 text-[var(--notion-text-main)] m-0 mb-2">Signing you in…</h2>
            <p className="text-copy-14 text-[var(--notion-text-dim)] m-0">One moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
