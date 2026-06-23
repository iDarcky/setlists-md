// Retry helper for sync network calls. Only *transient* failures (offline
// blips, rate limits, 5xx) are retried — auth failures, client errors and our
// own non-retryable signals (e.g. `reconnect_required`) are rethrown at once so
// the caller can surface a reconnect/permission state instead of looping.

// Pull an HTTP-ish status code out of the many shapes errors arrive in
// (fetch Response, Supabase error, our own thrown Errors).
function statusOf(err) {
  return err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.cause?.status;
}

export function isTransient(err) {
  if (!err) return false;
  // Explicit non-retryable signals from our auth layer.
  if (err.code === 'reconnect_required') return false;
  const status = statusOf(err);
  if (typeof status === 'number') {
    // Request-timeout, too-early, and rate-limit are worth another go.
    if (status === 408 || status === 425 || status === 429) return true;
    // Server-side failures are transient; other 4xx (401/403/404/409…) are not.
    return status >= 500 && status <= 599;
  }
  // No status usually means the request never completed — network down, DNS,
  // CORS preflight, aborted/timed-out fetch. Treat as transient.
  return true;
}

/**
 * Run `fn`, retrying transient failures with exponential backoff.
 *
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseMs?: number, onRetry?: (attempt:number, err:any)=>void }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { retries = 3, baseMs = 500, onRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isTransient(err)) throw err;
      onRetry?.(attempt, err);
      const delay = baseMs * 2 ** (attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
