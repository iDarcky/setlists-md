// The last email that logged in on this device, written only on success
// (AuthScreen). Welcome and the join link use it to pick Log in or Create account.
export const LAST_EMAIL_KEY = 'setlists-md:last-email';

export function lastEmail() {
  try { return window.localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
}
