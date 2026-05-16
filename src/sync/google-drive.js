// Google Drive provider — PKCE auth-code redirect flow.
//
// The browser never holds a refresh token. First connect redirects the
// user to Google's consent screen with `access_type=offline`. After
// approving, Google bounces back to /auth/google-drive?code=...&state=...
// which App.jsx handles by calling `exchangeGoogleAuthCode` below. The
// resulting refresh token is stored in Supabase by the Edge Function;
// only the short-lived access token comes back to the browser.
//
// All later refreshes go through the Edge Function (`refresh` action),
// so no Google popup ever appears after the initial consent. After 6+
// months of inactivity, Google invalidates the refresh token; the Edge
// Function returns `reconnect_required` and the user runs the connect
// flow again.

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES, FOLDER_NAME, SONGS_FOLDER, SETLISTS_FOLDER } from './constants';
import { callEdgeFunction, generatePkcePair, generateState } from './edge';

const PROVIDER = 'google-drive';
const PKCE_KEY = 'setlists-md:google-drive-pkce';

function getRedirectUri() {
  return `${window.location.origin}/auth/google-drive`;
}

// Called by SyncSettings → connectProvider('google-drive'). Stashes a
// PKCE verifier in sessionStorage and navigates the browser to Google.
// Never resolves — the page is leaving.
export async function startGoogleAuthRedirect({ returnTo } = {}) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID.');

  const { verifier, challenge } = await generatePkcePair();
  const state = generateState();
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({
    verifier,
    state,
    returnTo: returnTo || window.location.pathname || '/',
    createdAt: Date.now(),
  }));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    // `prompt=consent` is required on Google to guarantee a refresh
    // token comes back the *first* time the user connects; subsequent
    // re-auths can omit it.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  // Resolve a never-settling promise so callers stay paused until the
  // browser navigates away.
  return new Promise(() => {});
}

// Called by App.jsx when the user lands on /auth/google-drive?code=...
// after consent. Verifies the OAuth state, exchanges the code via the
// Edge Function, and returns { accessToken, expiresAt, returnTo }.
export async function exchangeGoogleAuthCode({ code, state }) {
  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) throw new Error('Missing PKCE state. Please retry from Settings → Cloud Sync.');
  let stash;
  try { stash = JSON.parse(raw); } catch { throw new Error('Corrupt PKCE state.'); }
  if (!stash.verifier || !stash.state) throw new Error('Corrupt PKCE state.');
  if (stash.state !== state) throw new Error('OAuth state mismatch. Please retry.');
  // Older than 10min? Reject — could be a stale redirect.
  if (Date.now() - (stash.createdAt || 0) > 10 * 60 * 1000) {
    sessionStorage.removeItem(PKCE_KEY);
    throw new Error('OAuth session expired. Please retry.');
  }

  const result = await callEdgeFunction('cloud-token-exchange', {
    action: 'exchange',
    provider: PROVIDER,
    code,
    codeVerifier: stash.verifier,
    redirectUri: getRedirectUri(),
  });
  sessionStorage.removeItem(PKCE_KEY);
  return { ...result, returnTo: stash.returnTo || '/' };
}

export function createGoogleDriveProvider() {
  let accessToken = null;
  let expiresAt = null;
  let rootFolderId = null;
  const subfolderIds = {};

  const api = (path, options = {}) => {
    const base = path.startsWith('https://') ? path : `https://www.googleapis.com/drive/v3${path}`;
    return fetch(base, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Google Drive API error: ${r.status} ${await r.text()}`);
      const ct = r.headers.get('content-type') || '';
      return ct.includes('json') ? r.json() : r.text();
    });
  };

  async function findOrCreateFolder(name, parentId) {
    const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const result = await api(`/files?q=${q}&fields=files(id,name)`);
    if (result.files.length > 0) return result.files[0].id;
    const folder = await api('/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
    return folder.id;
  }

  return {
    name: PROVIDER,
    displayName: 'Google Drive',

    // SyncSettings.handleConnect awaits this. We start a redirect that
    // never returns; if the browser somehow stays on the page, the
    // function never resolves and `busy` stays true until the page
    // navigates. The actual token landing happens in
    // exchangeGoogleAuthCode after the redirect.
    async connect() {
      await startGoogleAuthRedirect({ returnTo: window.location.pathname });
      // Unreachable in practice — page has navigated away.
      throw new Error('Redirect failed.');
    },

    async disconnect() {
      try {
        await callEdgeFunction('cloud-token-exchange', {
          action: 'disconnect',
          provider: PROVIDER,
        });
      } catch { /* best effort */ }
      accessToken = null;
      expiresAt = null;
      rootFolderId = null;
      Object.keys(subfolderIds).forEach((k) => delete subfolderIds[k]);
    },

    isConnected() {
      return !!accessToken;
    },

    // Called by engine.ensureAuth when the cached token is expired.
    // Hits the Edge Function `refresh` action — no Google popup.
    async refreshToken() {
      const result = await callEdgeFunction('cloud-token-exchange', {
        action: 'refresh',
        provider: PROVIDER,
      });
      accessToken = result.accessToken;
      expiresAt = result.expiresAt ? new Date(result.expiresAt).getTime() : Date.now() + 3600 * 1000;
      return { accessToken, expiresAt };
    },

    setTokens(tokens) {
      accessToken = tokens?.accessToken || null;
      if (tokens?.expiresAt) {
        expiresAt = typeof tokens.expiresAt === 'string'
          ? new Date(tokens.expiresAt).getTime()
          : tokens.expiresAt;
      }
    },

    async ensureFolder() {
      const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const result = await api(`/files?q=${q}&fields=files(id,name)`);
      if (result.files.length > 0) {
        rootFolderId = result.files[0].id;
      } else {
        const folder = await api('/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        rootFolderId = folder.id;
      }
      subfolderIds[SONGS_FOLDER] = await findOrCreateFolder(SONGS_FOLDER, rootFolderId);
      subfolderIds[SETLISTS_FOLDER] = await findOrCreateFolder(SETLISTS_FOLDER, rootFolderId);
      return rootFolderId;
    },

    async listFiles(subfolder) {
      if (!rootFolderId) await this.ensureFolder();
      const parentId = subfolderIds[subfolder] || rootFolderId;
      const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
      const result = await api(`/files?q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=1000`);
      return result.files.map(f => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        size: parseInt(f.size || '0', 10),
      }));
    },

    async uploadFile(subfolder, name, content, mimeType = 'text/plain') {
      if (!rootFolderId) await this.ensureFolder();
      const parentId = subfolderIds[subfolder] || rootFolderId;

      const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and trashed=false`);
      const existing = await api(`/files?q=${q}&fields=files(id)`);

      const metadata = { name, parents: [parentId] };
      const boundary = 'setlistsmd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        `Content-Type: ${mimeType}`,
        '',
        content,
        `--${boundary}--`,
      ].join('\r\n');

      if (existing.files.length > 0) {
        const fileId = existing.files[0].id;
        const result = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': mimeType,
          },
          body: content,
        }).then(r => r.json());
        return { id: result.id, name: result.name, modifiedTime: result.modifiedTime, size: parseInt(result.size || '0', 10) };
      }

      const result = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }).then(r => r.json());

      return { id: result.id, name: result.name, modifiedTime: result.modifiedTime, size: parseInt(result.size || '0', 10) };
    },

    async downloadFile(fileId) {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) throw new Error(`Google Drive download error: ${r.status} ${await r.text()}`);
      return r.text();
    },

    async deleteFile(fileId) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
  };
}
