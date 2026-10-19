// Who may see the main app. Someone signed in, or someone who tapped "Try it
// solo" on the welcome screen (settings.soloMode). Everyone else only ever
// sees the welcome screen and the screens it leads to — Back from Log in or
// Create account must never fall through into the Personal space.

// Screens that work without an account: the welcome screen itself, signing
// in, password recovery, OAuth returns, a church's join link, a shared
// setlist, and the legal pages linked from the sign-up form.
export const PUBLIC_VIEWS = [
  'loading',
  'onboarding',
  'signin',
  'recovery',
  'auth-callback',
  'google-drive-callback',
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
export function isLockedOut({ view, loaded, authLoading, configured, signedIn, soloMode }) {
  if (!configured || !loaded || authLoading) return false;
  if (signedIn || soloMode) return false;
  return !PUBLIC_VIEWS.includes(view);
}
