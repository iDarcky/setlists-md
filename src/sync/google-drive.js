import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES, FOLDER_NAME, SONGS_FOLDER, SETLISTS_FOLDER } from './constants';

let gsiLoaded = false;
let tokenClient = null;

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (gsiLoaded) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => { gsiLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export function createGoogleDriveProvider() {
  let accessToken = null;
  let rootFolderId = null;
  let subfolderIds = {};

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
    name: 'google-drive',
    displayName: 'Google Drive',

    async connect() {
      if (!GOOGLE_CLIENT_ID) throw new Error('Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID.');
      await loadGsi();
      return new Promise((resolve, reject) => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPES,
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            accessToken = response.access_token;
            const expiresAt = Date.now() + response.expires_in * 1000;
            resolve({
              accessToken: response.access_token,
              expiresAt,
            });
          },
        });
        tokenClient.requestAccessToken();
      });
    },

    async disconnect() {
      if (accessToken) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST' });
        } catch { /* ignore */ }
      }
      accessToken = null;
      rootFolderId = null;
      subfolderIds = {};
      tokenClient = null;
    },

    isConnected() {
      return !!accessToken;
    },

    async refreshToken(/* tokens */) {
      await loadGsi();
      return new Promise((resolve, reject) => {
        if (!tokenClient) {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: (response) => {
              if (response.error) { reject(new Error(response.error)); return; }
              accessToken = response.access_token;
              resolve({ accessToken: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 });
            },
          });
        }
        tokenClient.requestAccessToken({ prompt: '' });
      });
    },

    setTokens(tokens) {
      accessToken = tokens.accessToken;
    },

    async ensureFolder() {
      // Create root Setlists MD folder
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
      // Create Songs and Setlists subfolders
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

      // Check if file already exists
      const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and trashed=false`);
      const existing = await api(`/files?q=${q}&fields=files(id)`);

      const metadata = { name, parents: [parentId] };
      // Boundary must be a valid HTTP token per RFC 7230 — no spaces, no
      // quoted-string syntax. The previous `---Setlists MD_boundary` had a
      // space which modern browsers refuse to send, surfacing as
      // "Failed to fetch" before the request ever leaves the device.
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

