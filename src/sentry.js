// Sentry crash reporting. Dormant until VITE_SENTRY_DSN is set (Vercel env /
// .env); with no DSN this is a no-op and the Sentry chunk is never fetched.
//
// NOTE the import below must be a REAL dynamic import (not the old
// `new Function('return import(m)')` trick): the bundler has to see the
// specifier to include @sentry/react in the build as a lazy chunk. A native
// browser `import('@sentry/react')` of a bare specifier can never resolve —
// which is why the old pattern silently reported nothing even with a DSN.

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // No-op until DSN is configured.

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Ties every event to the exact deployed version (package.json#version
      // via Vite's define) so a crash maps to a release, not "latest".
      release: `setlists-md@${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`,
      // Conservative defaults — bump tracesSampleRate when you want
      // performance data, replaysSessionSampleRate for session replays.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration?.(),
        Sentry.replayIntegration?.({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ].filter(Boolean),
    });
  } catch (err) {
    // Import/init failure must never take the app down with it.
    console.warn('[sentry] init skipped:', err?.message || err);
  }
}
