// Shared by every sign-in surface (AuthScreen, the join flow). Add new cases
// here rather than inline in handlers (CLAUDE.md → Conventions).
// Map the most common Supabase auth errors to copy our users can actually
// act on. Falls through to the raw message when nothing matches.
export function friendlyAuthError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Check your connection and try again.";
  }
  const raw = err?.message || '';
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network request failed') || lower.includes('networkerror')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('user already registered')) return 'That email already has an account — try signing in instead.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Try again in a few minutes.';
  }
  if (lower.includes('you can only request this') || lower.includes('once every')) {
    return 'Please wait a minute before trying again.';
  }
  if (lower.includes('password should be at least')) return 'Password must be at least 8 characters.';
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('invalid otp')) {
    return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  }
  if (lower.includes('signups not allowed')) return 'New sign-ups are switched off right now.';
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'That sign-in option is not available yet. Use your email instead.';
  }
  return raw || 'Something went wrong.';
}
