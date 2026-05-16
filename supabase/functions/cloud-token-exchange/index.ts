// cloud-token-exchange
//
// Handles OAuth refresh-token storage for Pro-tier "Bring Your Own Cloud"
// providers. The browser never sees the refresh token.
//
// Flow:
//   1. Browser redirects user to Google's /authorize with PKCE +
//      `access_type=offline`. Google sends them back to
//      /auth/google-drive?code=...
//   2. Browser POSTs to this function with { action: 'exchange', code,
//      codeVerifier, provider } and its Supabase user JWT.
//   3. Function exchanges the code with Google for { access_token,
//      refresh_token, expires_in }, stores the refresh token in
//      user_cloud_tokens (service_role only), returns just the
//      access_token + expires_at to the browser.
//   4. When the access token expires (~1h), the browser POSTs
//      { action: 'refresh', provider } — function looks up the refresh
//      token, calls Google, returns a fresh access token.
//   5. { action: 'disconnect' } revokes with Google and deletes the row.
//
// All actions require a valid Supabase user JWT. The function reads
// `Authorization: Bearer <user_jwt>` and verifies it via
// supabase.auth.getUser() — that's how we tie the call to a user_id
// without trusting the client.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PROVIDERS: Record<string, ProviderConfig> = {
  'google-drive': {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    clientId: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? '',
  },
  dropbox: {
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
    clientId: Deno.env.get('DROPBOX_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('DROPBOX_CLIENT_SECRET') ?? '',
  },
  onedrive: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeUrl: '',
    clientId: Deno.env.get('ONEDRIVE_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('ONEDRIVE_CLIENT_SECRET') ?? '',
  },
};

interface ProviderConfig {
  tokenUrl: string;
  revokeUrl: string;
  clientId: string;
  clientSecret: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  // service_role client — bypasses RLS so we can read user_cloud_tokens.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve user from their JWT.
  const { data: { user }, error: userErr } = await admin.auth.getUser(authHeader.slice(7));
  if (userErr || !user) return json({ error: 'Invalid token' }, 401);

  let body: { action?: string; provider?: string; code?: string; codeVerifier?: string; redirectUri?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const provider = body.provider as keyof typeof PROVIDERS;
  if (!provider || !PROVIDERS[provider]) return json({ error: 'Unknown provider' }, 400);
  const cfg = PROVIDERS[provider];
  if (!cfg.clientId || !cfg.clientSecret) return json({ error: 'Provider not configured' }, 500);

  try {
    if (body.action === 'exchange') {
      if (!body.code || !body.codeVerifier || !body.redirectUri) {
        return json({ error: 'Missing code, codeVerifier, or redirectUri' }, 400);
      }
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: body.code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: body.redirectUri,
        code_verifier: body.codeVerifier,
      });
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody,
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        return json({ error: 'Token exchange failed', detail: tokenJson }, 400);
      }
      const refreshToken: string | undefined = tokenJson.refresh_token;
      const accessToken: string | undefined = tokenJson.access_token;
      const expiresIn: number = tokenJson.expires_in ?? 3600;
      if (!refreshToken) {
        return json({
          error: 'No refresh token returned. Did you set access_type=offline and prompt=consent?',
          detail: tokenJson,
        }, 400);
      }
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const { error: upsertErr } = await admin
        .from('user_cloud_tokens')
        .upsert({
          user_id: user.id,
          provider,
          refresh_token: refreshToken,
          access_token: accessToken ?? null,
          expires_at: expiresAt,
          scope: tokenJson.scope ?? null,
        }, { onConflict: 'user_id,provider' });
      if (upsertErr) return json({ error: 'Failed to store token', detail: upsertErr.message }, 500);

      return json({ accessToken, expiresAt });
    }

    if (body.action === 'refresh') {
      const { data: row, error: selErr } = await admin
        .from('user_cloud_tokens')
        .select('refresh_token, access_token, expires_at')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();
      if (selErr || !row) return json({ error: 'Not connected' }, 404);

      // If we cached a still-valid access token, return it (saves a hop).
      if (row.access_token && row.expires_at) {
        const expiresAtMs = new Date(row.expires_at).getTime();
        if (expiresAtMs - Date.now() > 5 * 60 * 1000) {
          return json({ accessToken: row.access_token, expiresAt: row.expires_at });
        }
      }

      const refreshBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      });
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: refreshBody,
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        // Refresh token revoked or expired (6mo unused) — clean up so the
        // browser shows the Reconnect button.
        if (tokenJson.error === 'invalid_grant') {
          await admin.from('user_cloud_tokens').delete()
            .eq('user_id', user.id).eq('provider', provider);
          return json({ error: 'reconnect_required', detail: tokenJson }, 401);
        }
        return json({ error: 'Refresh failed', detail: tokenJson }, 400);
      }
      const accessToken = tokenJson.access_token as string;
      const expiresIn = (tokenJson.expires_in as number) ?? 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Some providers issue a new refresh_token on every refresh
      // (Dropbox/OneDrive). Persist if present.
      const patch: Record<string, unknown> = {
        access_token: accessToken,
        expires_at: expiresAt,
      };
      if (tokenJson.refresh_token) patch.refresh_token = tokenJson.refresh_token;

      await admin.from('user_cloud_tokens').update(patch)
        .eq('user_id', user.id).eq('provider', provider);

      return json({ accessToken, expiresAt });
    }

    if (body.action === 'disconnect') {
      const { data: row } = await admin
        .from('user_cloud_tokens')
        .select('refresh_token')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();

      if (row?.refresh_token && cfg.revokeUrl) {
        try {
          if (provider === 'google-drive') {
            await fetch(`${cfg.revokeUrl}?token=${encodeURIComponent(row.refresh_token)}`, { method: 'POST' });
          } else if (provider === 'dropbox') {
            await fetch(cfg.revokeUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${row.refresh_token}` },
            });
          }
        } catch { /* best effort */ }
      }

      await admin.from('user_cloud_tokens').delete()
        .eq('user_id', user.id).eq('provider', provider);

      return json({ ok: true });
    }

    if (body.action === 'status') {
      const { data: row } = await admin
        .from('user_cloud_tokens')
        .select('provider, expires_at, account_email, updated_at')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();
      return json({ connected: !!row, info: row ?? null });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: 'Unexpected error', detail: (err as Error).message }, 500);
  }
});
