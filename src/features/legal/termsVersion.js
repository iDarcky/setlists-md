// Which version of the Terms and Privacy Policy a new account accepted.
// Bump TERMS_VERSION whenever docs/legal/ changes in a way that matters (the
// date the new texts apply), so we can show who agreed to what. It is saved
// in the account's metadata at sign-up (auth.users.raw_user_meta_data).
export const TERMS_VERSION = '2026-11-19';

export const termsAcceptance = (now = new Date()) => ({
  terms_version: TERMS_VERSION,
  terms_accepted_at: now.toISOString(),
});
