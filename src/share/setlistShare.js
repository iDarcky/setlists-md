// Public setlist share links (temporary URLs).
//
// A signed-in user publishes a frozen snapshot of a setlist + the songs it
// references to the `shared_setlists` table under a random token. Anyone with
// the link reads it (until it expires) via the public `share-view` route. The
// snapshot keeps the owner's private library out of the public read path.

import { supabase } from '@/auth/supabase';

// Sharing needs a backend — degrade gracefully when Supabase isn't configured.
export const SHARE_ENABLED = !!supabase;

// URL-safe random token. 22 chars from a 36-symbol alphabet ≈ 113 bits —
// well past brute-force range for a public, expiring read link.
function makeToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(22);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function buildShareUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?setlist=${token}`;
}

// Read the share token from the current URL, if any.
export function shareTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('setlist');
  // Minimum raised to 16 (legacy tokens were 16 chars; current are 22) so a
  // short, guessable token can't even be attempted.
  return t && /^[a-z0-9]{16,32}$/.test(t) ? t : null;
}

// Collect just the songs a setlist references, so the public snapshot doesn't
// leak the owner's whole library.
function songsForSetlist(setlist, songs) {
  const wanted = new Set();
  (setlist.items || []).forEach(it => {
    if (it && it.type !== 'break' && it.songId) wanted.add(it.songId);
  });
  return (songs || []).filter(s => wanted.has(s.id));
}

// Create a share link. `expiresInDays` of 0 / null means "never expires".
export async function createSetlistShare(setlist, songs, { expiresInDays = 30, ownerId } = {}) {
  if (!supabase) throw new Error('Sharing is unavailable right now.');
  if (!ownerId) throw new Error('Sign in to create a share link.');
  const token = makeToken();
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;
  const { error } = await supabase.from('shared_setlists').insert({
    token,
    owner_id: ownerId,
    title: setlist.name || 'Setlist',
    setlist,
    songs: songsForSetlist(setlist, songs),
    expires_at,
  });
  if (error) throw error;
  return { token, url: buildShareUrl(token), expiresAt: expires_at };
}

// Fetch a shared setlist by token (public, no auth required). Returns null when
// the token is missing or expired (RLS filters expired rows out).
export async function fetchSharedSetlist(token) {
  if (!supabase) throw new Error('Sharing is unavailable right now.');
  const { data, error } = await supabase
    .from('shared_setlists')
    .select('token, title, setlist, songs, expires_at, created_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function revokeSetlistShare(token) {
  if (!supabase) return;
  const { error } = await supabase.from('shared_setlists').delete().eq('token', token);
  if (error) throw error;
}
