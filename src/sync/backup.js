// The backup mirror — a folder the user owns (Google Drive, Dropbox, OneDrive)
// that holds a copy of the personal library as files: one `.md` per song, one
// `.json` per setlist.
//
// ONE WAY. The app writes the folder after every change; it never reads it
// back on its own. A file edited in the folder is overwritten by the next
// backup; a file added there is ignored. The only read is `restore()`, an
// explicit user action that hands back whatever the folder holds so the app
// can add what the library lacks.
//
// This replaced `engine.js`, the file-manifest SYNC engine (pull, merge,
// conflicts, tombstones, a mass-delete breaker, an amplification guard),
// on 2026-09-11 — docs/SYNC-REDESIGN.md §4.3 and §5.7. Cross-device sync is
// the replica (`replica-engine.js`) against the account's workspace; a
// folder with no versions, no change feed and per-file last-writer-wins was
// never a sound second engine for the same library, and running two engines
// on one library is what made the personal library's sync hard to reason
// about. As a mirror it keeps what people wanted from it — "my songs are in
// my Drive, as files" — and loses the merge problem entirely.
//
// What stays from the old engine: the providers and their OAuth, the
// per-library manifests in the sync state (remote file id + name + hash of
// the bytes written, so an unchanged song is not re-uploaded and a renamed
// one replaces its old file), and the refusal to delete more than half the
// folder in one pass (a truncated local state must never empty the backup).

import { getProvider } from './provider';
import { getSyncState, updateSyncManifest, updateSetlistManifest, updateTokens, isTokenExpired, markBackupTime } from './tokens';
import { SONGS_FOLDER, SETLISTS_FOLDER, SYNC_DEBOUNCE_MS } from './constants';
import { withRetry } from './retry';
import { withSyncLock } from './lock';
import { parseSongMd, songToMd, generateId } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { cyrb53 } from './canonical';

export function sanitizeFilename(name) {
  return (name || 'Untitled')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

// Refuse a delete batch this large: it is a truncated local state, not a user.
export function isMassDelete(deleting, total) {
  return deleting >= 8 && deleting > total * 0.5;
}

/**
 * @param {(status: object) => void} onStatusChange
 *   `{ state: 'backing-up'|'backed-up'|'error'|'needs-reconnect', provider, lastBackup? }`
 * @param {{ libraryId?: string, providerFor?: (name: string) => object }} [opts]
 *   `providerFor` is for tests — the real one is the OAuth provider registry.
 */
export function createBackupMirror(onStatusChange, { libraryId = 'personal', providerFor = getProvider } = {}) {
  let running = false;
  let debounceTimer = null;
  let latest = null;
  // Hash caches keyed by object reference: an unchanged reference has an
  // unchanged serialization, so a backup after one edit serializes one song.
  const songCache = new Map(); // id -> { ref, md, hash }
  const slCache = new Map();   // id -> { ref, json, hash }
  const setStatus = (state, extra = {}) => onStatusChange?.({ state, ...extra });

  function songFile(song) {
    const c = songCache.get(song.id);
    if (c && c.ref === song) return c;
    const md = songToMd(song);
    const entry = { ref: song, md, hash: cyrb53(md), name: `${sanitizeFilename(song.title)}.md` };
    songCache.set(song.id, entry);
    return entry;
  }
  function setlistFile(sl) {
    const c = slCache.get(sl.id);
    if (c && c.ref === sl) return c;
    const json = JSON.stringify(sl, null, 2);
    const entry = { ref: sl, json, hash: cyrb53(json), name: `${sanitizeFilename(sl.name || 'Untitled Setlist')}.json` };
    slCache.set(sl.id, entry);
    return entry;
  }

  async function ensureAuth(provider, state) {
    if (!provider.isConnected?.() && state.tokens) provider.setTokens?.(state.tokens);
    if (!isTokenExpired(state.tokens)) return;
    try {
      const fresh = await provider.refreshToken(state.tokens);
      await updateTokens(fresh, libraryId);
      provider.setTokens?.(fresh);
    } catch (err) {
      // The token exchange answers `reconnect_required` when the refresh
      // token was revoked or expired from months of idle: a banner, not an error.
      const e = new Error(err?.code === 'reconnect_required' || err?.status === 401 ? 'Reconnect required.' : 'Token refresh failed.');
      e.code = err?.code === 'reconnect_required' || err?.status === 401 ? 'reconnect_required' : 'refresh_failed';
      throw e;
    }
  }

  async function connected() {
    const state = await getSyncState(libraryId);
    if (!state.activeProvider) return null;
    const provider = providerFor(state.activeProvider);
    await ensureAuth(provider, state);
    await withRetry(() => provider.ensureFolder());
    return { state, provider };
  }

  // Write the folder so it equals the library. Returns what moved.
  async function mirror(songs, setlists) {
    const conn = await connected();
    const out = { uploaded: { songs: 0, setlists: 0 }, deleted: { songs: 0, setlists: 0 }, errors: [], skipped: !conn };
    if (!conn) return out;
    const { state, provider } = conn;
    const manifest = { ...state.syncManifest };
    const slManifest = { ...state.setlistManifest };

    for (const song of songs || []) {
      if (!song?.id) continue;
      try {
        const { md, hash, name } = songFile(song);
        const entry = manifest[song.id];
        if (entry?.remoteName && entry.remoteName !== name) {
          try { await provider.deleteFile(entry.remoteId); } catch { /* the old file may be gone */ }
        }
        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== name) {
          const r = await withRetry(() => provider.uploadFile(SONGS_FOLDER, name, md, 'text/markdown'));
          manifest[song.id] = { remoteId: r.id, remoteName: r.name, lastSyncedHash: hash, lastSyncedTime: r.modifiedTime };
          out.uploaded.songs += 1;
        }
      } catch (err) {
        out.errors.push({ kind: 'song', id: song.id, title: song.title, message: err?.message || String(err) });
      }
    }
    const songIds = new Set((songs || []).map(s => s?.id));
    const songGone = Object.keys(manifest).filter(id => !songIds.has(id));
    if (isMassDelete(songGone.length, Object.keys(manifest).length)) {
      out.errors.push({ kind: 'song', message: `Safety guard: refused to remove ${songGone.length} of ${Object.keys(manifest).length} song files in one backup. Nothing was deleted.` });
    } else {
      for (const id of songGone) {
        try { await provider.deleteFile(manifest[id].remoteId); } catch { /* may not exist */ }
        delete manifest[id];
        out.deleted.songs += 1;
      }
    }
    await updateSyncManifest(manifest, libraryId);

    for (const sl of setlists || []) {
      if (!sl?.id) continue;
      try {
        const { json, hash, name } = setlistFile(sl);
        const entry = slManifest[sl.id];
        if (entry?.remoteName && entry.remoteName !== name) {
          try { await provider.deleteFile(entry.remoteId); } catch { /* may be gone */ }
        }
        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== name) {
          const r = await withRetry(() => provider.uploadFile(SETLISTS_FOLDER, name, json, 'application/json'));
          slManifest[sl.id] = { remoteId: r.id, remoteName: r.name, lastSyncedHash: hash, lastSyncedTime: r.modifiedTime };
          out.uploaded.setlists += 1;
        }
      } catch (err) {
        out.errors.push({ kind: 'setlist', id: sl.id, title: sl.name, message: err?.message || String(err) });
      }
    }
    const slIds = new Set((setlists || []).map(s => s?.id));
    const slGone = Object.keys(slManifest).filter(id => !slIds.has(id));
    if (isMassDelete(slGone.length, Object.keys(slManifest).length)) {
      out.errors.push({ kind: 'setlist', message: `Safety guard: refused to remove ${slGone.length} of ${Object.keys(slManifest).length} setlist files in one backup. Nothing was deleted.` });
    } else {
      for (const id of slGone) {
        try { await provider.deleteFile(slManifest[id].remoteId); } catch { /* may not exist */ }
        delete slManifest[id];
        out.deleted.setlists += 1;
      }
    }
    await updateSetlistManifest(slManifest, libraryId);
    return out;
  }

  async function run(songs, setlists, { silent = false } = {}) {
    if (running) return null;
    running = true;
    let providerName = null;
    try {
      return await withSyncLock(libraryId, async () => {
        providerName = (await getSyncState(libraryId)).activeProvider;
        if (!providerName) return { skipped: true };
        if (!silent) setStatus('backing-up', { provider: providerName });
        const out = await mirror(songs, setlists);
        const moved = out.uploaded.songs + out.uploaded.setlists + out.deleted.songs + out.deleted.setlists;
        const lastBackup = new Date().toISOString();
        if (moved > 0 || !silent) await markBackupTime(lastBackup, libraryId);
        if (out.errors.length) setStatus('error', { provider: providerName, errors: out.errors });
        else if (moved > 0 || !silent) setStatus('backed-up', { provider: providerName, lastBackup });
        return out;
      });
    } catch (err) {
      if (err?.code === 'reconnect_required') setStatus('needs-reconnect', { provider: providerName });
      else { console.error('[backup] failed:', err); setStatus('error', { provider: providerName, errors: [{ kind: 'backup', message: err?.message || String(err) }] }); }
      return { errors: [{ kind: 'backup', message: err?.message || String(err) }] };
    } finally {
      running = false;
    }
  }

  return {
    /** Write the folder now (a user action, or the first backup after connecting). */
    backupNow(songs, setlists) { return run(songs, setlists); },

    /** After an edit: write the folder once the edits pause. */
    debouncedBackup(songs, setlists) {
      latest = { songs, setlists };
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const l = latest;
        run(l.songs, l.setlists, { silent: true });
      }, SYNC_DEBOUNCE_MS);
    },

    /** The tab is going away: write what is pending now. */
    flushPending(songs, setlists) {
      if (!debounceTimer) return;
      clearTimeout(debounceTimer);
      debounceTimer = null;
      return run(songs, setlists, { silent: true });
    },

    cancelDebounce() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
    },

    /**
     * Read the folder (a user action). Returns every song and setlist it
     * holds, parsed; the caller decides what to add. A song's id is the
     * `songId` its file carries, so a song backed up from this library comes
     * back under its own id and is not a duplicate.
     */
    async restore() {
      const conn = await connected();
      if (!conn) throw new Error('No backup folder is connected.');
      const { provider } = conn;
      const songs = [];
      const setlists = [];
      const errors = [];
      for (const f of await withRetry(() => provider.listFiles(SONGS_FOLDER))) {
        if (!f.name?.endsWith('.md')) continue;
        try {
          const parsed = parseSongMd(await withRetry(() => provider.downloadFile(f.id, SONGS_FOLDER)));
          songs.push(songFromFlat({ ...parsed, id: parsed.songId || parsed.id || generateId() }));
        } catch (err) { errors.push({ kind: 'song', title: f.name, message: err?.message || String(err) }); }
      }
      for (const f of await withRetry(() => provider.listFiles(SETLISTS_FOLDER))) {
        if (!f.name?.endsWith('.json')) continue;
        try {
          const sl = JSON.parse(await withRetry(() => provider.downloadFile(f.id, SETLISTS_FOLDER)));
          if (sl && typeof sl === 'object' && Array.isArray(sl.items)) setlists.push({ ...sl, id: sl.id || generateId() });
        } catch (err) { errors.push({ kind: 'setlist', title: f.name, message: err?.message || String(err) }); }
      }
      return { songs, setlists, errors };
    },
  };
}
