// Helper for calling Supabase Edge Functions with the current user JWT.
// All cloud-token-exchange traffic goes through here so providers don't
// each have to duplicate the auth dance.

import { supabase } from '../auth/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export async function callEdgeFunction(name, body) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in to use cloud sync.');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  if (!res.ok) {
    const err = new Error(json?.error || `${name} returned ${res.status}`);
    err.status = res.status;
    err.detail = json?.detail;
    err.code = json?.error;
    throw err;
  }
  return json;
}

// ── PKCE helpers ────────────────────────────────────────────────────────

function base64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkcePair() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const verifier = base64url(buf);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then((hash) => {
    const challenge = base64url(new Uint8Array(hash));
    return { verifier, challenge };
  });
}

export function generateState() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64url(buf);
}
