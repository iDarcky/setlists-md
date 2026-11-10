// Arriving from the website (setlists.md). Its buttons link to
// `app.setlists.md/?start=signup&from=site` ("Join the beta") and
// `?from=site` ("Log in"). Two things follow:
//
// 1. `start=signup|login` opens the account screen straight away, on the
//    right tab, instead of the welcome screen.
// 2. `from=<source>` is remembered on this device until the person makes an
//    account, then written into the account's metadata (`signup_from`), so
//    sign-ups from the website can be counted:
//      select count(*) from auth.users
//      where raw_user_meta_data->>'signup_from' = 'site';

const FROM_KEY = 'setlists-md:signup-from';
const SOURCE = /^[a-z0-9-]{1,32}$/;

/** `{ start: 'signup' | 'login' | null, from: string | null }` from a query string. */
export function parseSiteEntry(search) {
  const q = new URLSearchParams(search || '');
  const start = q.get('start');
  const from = (q.get('from') || '').toLowerCase();
  return {
    start: start === 'signup' || start === 'login' ? start : null,
    from: SOURCE.test(from) ? from : null,
  };
}

/** The query string with the website's keys taken out ('' when nothing is left). */
export function stripSiteEntry(search) {
  const q = new URLSearchParams(search || '');
  q.delete('start');
  q.delete('from');
  const rest = q.toString();
  return rest ? `?${rest}` : '';
}

export function rememberSignupSource(from, storage = globalThis.localStorage) {
  if (!from) return;
  try { storage?.setItem(FROM_KEY, from); } catch { /* private mode */ }
}

export function signupSource(storage = globalThis.localStorage) {
  try { return storage?.getItem(FROM_KEY) || null; } catch { return null; }
}

export function forgetSignupSource(storage = globalThis.localStorage) {
  try { storage?.removeItem(FROM_KEY); } catch { /* private mode */ }
}
