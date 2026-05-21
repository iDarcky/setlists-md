import { createGoogleDriveProvider } from './google-drive';
import { createDropboxProvider } from './dropbox';
import { createOneDriveProvider } from './onedrive';
import { createSupabaseTeamProvider } from './supabase-team';
import { isProviderConfigured } from './constants';
import { setActiveProvider, clearProvider, getSyncState } from './tokens';

/**
 * Provider interface — each provider must implement:
 *
 * {
 *   name: string,
 *   displayName: string,
 *   connect()            -> Promise<{ accessToken, refreshToken?, expiresAt }>
 *   disconnect()         -> Promise<void>
 *   isConnected()        -> boolean
 *   refreshToken(tokens) -> Promise<{ accessToken, expiresAt }>
 *   ensureFolder()       -> Promise<folderId|folderPath>
 *   listFiles()          -> Promise<FileEntry[]>    // { name, id, modifiedTime, size }
 *   uploadFile(name, content, mimeType?) -> Promise<FileEntry>
 *   downloadFile(fileId)  -> Promise<string>
 *   deleteFile(fileId)    -> Promise<void>
 * }
 */

const providers = {
  'google-drive': createGoogleDriveProvider,
  'dropbox': createDropboxProvider,
  'onedrive': createOneDriveProvider,
};

let cachedProviders = {};

export function getProvider(name, options = {}) {
  if (name.startsWith('supabase-team:')) {
    // Include readOnly in the cache key so switching roles invalidates the cached provider.
    const cacheKey = options.readOnly ? `${name}:ro` : name;
    // Also invalidate the opposite cache entry if it exists.
    const oppositeCacheKey = options.readOnly ? name : `${name}:ro`;
    delete cachedProviders[oppositeCacheKey];

    if (!cachedProviders[cacheKey]) {
      const teamId = name.split(':')[1];
      cachedProviders[cacheKey] = createSupabaseTeamProvider(teamId, { readOnly: !!options.readOnly });
    }
    return cachedProviders[cacheKey];
  }

  if (!providers[name]) {
    throw new Error(`Unknown sync provider: ${name}`);
  }
  if (!cachedProviders[name]) {
    cachedProviders[name] = providers[name]();
  }
  return cachedProviders[name];
}

export function getAvailableProviders() {
  return [
    { name: 'google-drive', displayName: 'Google Drive', icon: '💾', configured: isProviderConfigured('google-drive') },
    { name: 'dropbox', displayName: 'Dropbox', icon: '📦', configured: isProviderConfigured('dropbox') },
    { name: 'onedrive', displayName: 'OneDrive', icon: '☁️', configured: isProviderConfigured('onedrive') },
  ];
}

/**
 * Launch a provider's OAuth flow, persist the returned tokens as the active
 * provider, and return the tokens. Throws if the provider is not configured
 * (missing client ID) or if the user cancels the popup.
 */
export async function connectProvider(name) {
  const provider = getProvider(name);
  const tokens = await provider.connect();
  await setActiveProvider(name, tokens);
  return tokens;
}

/**
 * Disconnect the currently active provider (clears local tokens and
 * best-effort revokes with the remote).
 */
export async function disconnectProvider() {
  const state = await getSyncState();
  if (state.activeProvider) {
    try {
      const provider = getProvider(state.activeProvider);
      await provider.disconnect?.();
    } catch {
      // best effort — we still want to clear local tokens
    }
  }
  await clearProvider();
}
