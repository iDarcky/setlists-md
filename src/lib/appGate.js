// Who may see the main app: someone signed in. Everyone else only ever sees
// the welcome screen and the screens it leads to — Back from Log in or Create
// account must never fall through into the app.

// Screens that work without an account: the welcome screen itself, signing
// in, password recovery, OAuth returns, a church's join link, a shared
// setlist, and the legal pages linked from the sign-up form.
export const PUBLIC_VIEWS = [
  'loading',
  'onboarding',
  'signin',
  'recovery',
  'auth-callback',
  'join',
  'share-view',
  'legal-privacy',
  'legal-terms',
  'legal-copyright',
];

// True when `view` is a main-app screen the visitor isn't allowed on yet.
// Waits for settings and the stored session to load so a signed-in user
// never sees the welcome screen flash. A build without Supabase has no
// accounts at all, so it never locks.
export function isLockedOut({ view, loaded, authLoading, configured, signedIn }) {
  if (!configured || !loaded || authLoading) return false;
  if (signedIn) return false;
  return !PUBLIC_VIEWS.includes(view);
}
