import { getProvider } from './provider';
import { getSyncState, updateSyncManifest, updateSetlistManifest, updateTokens, isTokenExpired, setPendingPush, setHashVersion } from './tokens';
import { SONGS_FOLDER, SETLISTS_FOLDER, SYNC_DEBOUNCE_MS } from './constants';
import { withRetry } from './retry';
import { parseSongMd, songToMd, generateId } from '@/parser';
import { songFromFlat, withArrangement } from '@/arrangements';
import { canonicalSongHash, canonicalSetlistHash, HASH_VERSION } from './canonical';
import { createAmplificationGuard } from './amplification-guard';
import { withSyncLock } from './lock';

function sanitizeFilename(name) {
  return (name || 'Untitled')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}


export function createSyncEngine(onStatusChange, libraryId = 'personal', { readOnly = false } = {}) {
  let syncing = false;
  let debounceTimer = null;
  const ampGuard = createAmplificationGuard();

  // Per-engine hash caches keyed by object reference. Serializing every song to
  // markdown / every setlist to JSON on each sync is the dominant CPU cost for
  // large libraries; React replaces only an edited item's object, so an
  // unchanged reference has an unchanged serialization + hash. A miss (new ref)
  // recomputes. See the matching cache in team-engine.js.
  const songHashCache = new Map(); // id -> { ref, md, hash }
  const slHashCache = new Map();   // id -> { ref, json, hash }

  function hashSong(song) {
    const cached = songHashCache.get(song.id);
    if (cached && cached.ref === song) return cached;
    const md = songToMd(song);
    const entry = { ref: song, md, hash: canonicalSongHash(md) };
    songHashCache.set(song.id, entry);
    return entry;
  }

  function hashSetlist(sl) {
    const cached = slHashCache.get(sl.id);
    if (cached && cached.ref === sl) return cached;
    const json = JSON.stringify(sl, null, 2);
    const entry = { ref: sl, json, hash: canonicalSetlistHash(sl) };
    slHashCache.set(sl.id, entry);
    return entry;
  }

  const setStatus = (state, extra = {}) => {
    onStatusChange?.({ state, ...extra });
  };

  async function ensureAuth(provider, syncState) {
    if (!provider.isConnected() && syncState.tokens) {
      provider.setTokens(syncState.tokens);
    }
    if (isTokenExpired(syncState.tokens)) {
      try {
        const newTokens = await provider.refreshToken(syncState.tokens);
        await updateTokens(newTokens, libraryId);
        provider.setTokens(newTokens);
      } catch (err) {
        // The Edge Function returns `reconnect_required` when the refresh
        // token has been revoked or has expired from 6+ months of idle.
        // Surface a dedicated status so the UI can show a "Reconnect"
        // banner rather than a generic error.
        if (err?.code === 'reconnect_required' || err?.status === 401) {
          setStatus('needs-reconnect', { provider: syncState.activeProvider });
          const e = new Error('Reconnect required.');
          e.code = 'reconnect_required';
          throw e;
        }
        setStatus('error');
        throw new Error('Token refresh failed. Please reconnect.');
      }
    }
  }

  async function pull(songs, setlists, tombstones = { songs: [], setlists: [] }) {
    const syncState = await getSyncState(libraryId);
    if (!syncState.activeProvider) return { songs, setlists, tombstones, changed: false };
    // First sync after a hash-algorithm upgrade: the stored hashes are old-algo,
    // so suppress conflict detection (it would false-positive against canonical
    // hashes). Unchanged rows are skipped by the modifiedTime gate; changed rows
    // re-baseline cleanly.
    const migrating = (syncState.hashVersion || 0) < HASH_VERSION;

    const provider = getProvider(syncState.activeProvider, { readOnly });
    await ensureAuth(provider, syncState);
    await withRetry(() => provider.ensureFolder());

    const manifest = { ...syncState.syncManifest };
    const slManifest = { ...syncState.setlistManifest };
    let songsChanged = false;
    let setlistsChanged = false;
    let updatedSongs = [...songs];
    let updatedSetlists = [...setlists];
    // Index tombstones for O(1) lookup and potential removal
    const songTombstones = new Map((tombstones.songs || []).map(t => [t.id, t.deletedAt]));
    const setlistTombstones = new Map((tombstones.setlists || []).map(t => [t.id, t.deletedAt]));
    let tombstonesChanged = false;
    // Track items where local had unsynced edits that were overwritten by remote
    const conflicts = [];
    const pulledSongIds = new Set();
    const pulledSetlistIds = new Set();

    // Pull songs from Songs subfolder
    const songFiles = await withRetry(() => provider.listFiles(SONGS_FOLDER));
    for (const file of songFiles) {
      if (!file.name.endsWith('.md')) continue;

      // Find matching manifest entry by remoteName or remoteId
      let songId = null;
      for (const [id, entry] of Object.entries(manifest)) {
        if (entry.remoteId === file.id || entry.remoteName === file.name) {
          songId = id;
          break;
        }
      }

      const manifestEntry = songId ? manifest[songId] : null;
      const remoteTime = new Date(file.modifiedTime).getTime();
      const lastSyncedTime = manifestEntry?.lastSyncedTime
        ? new Date(manifestEntry.lastSyncedTime).getTime()
        : 0;

      if (remoteTime > lastSyncedTime) {
        // Respect local tombstones unless remote was modified after deletion
        if (songId && songTombstones.has(songId)) {
          if (songTombstones.get(songId) >= remoteTime) {
            // Local delete is newer — leave for push to clean up remote
            continue;
          }
          // Remote was edited after local delete — resurrect and drop tombstone
          songTombstones.delete(songId);
          tombstonesChanged = true;
        }

        const content = await withRetry(() => provider.downloadFile(file.id, SONGS_FOLDER));
        const parsed = parseSongMd(content);

        if (songId) {
          // Update existing song (or re-add if missing from local state)
          const existingIdx = updatedSongs.findIndex(s => s.id === songId);
          if (existingIdx >= 0) {
            // Detect conflict: local diverged from last-synced before remote changed
            const localSong = updatedSongs[existingIdx];
            const lastSyncedHash = manifestEntry?.lastSyncedHash;
            const isConflict = !migrating && lastSyncedHash != null
              && canonicalSongHash(songToMd(localSong)) !== lastSyncedHash;
            // For v2 songs, merge the remote arrangement into the existing
            // arrangements rather than replacing the whole song object.
            // Pick the local arrangement to patch. Prefer an id match
            // with the remote; fall back to the default arrangement when
            // the local copy was created before arrangement ids were
            // preserved across the wire.
            const hasIdMatch = Array.isArray(localSong.arrangements)
              && localSong.arrangements.some(a => a.id === parsed.arrangementId);
            const localTargetId = hasIdMatch
              ? parsed.arrangementId
              : (localSong.defaultArrangementId || localSong.arrangements?.[0]?.id);
            let next = withArrangement(localSong, localTargetId, (a) => ({
              ...a,
              name: parsed.arrangementName || a.name,
              key: parsed.key, tempo: parsed.tempo, time: parsed.time,
              capo: parsed.capo, notes: parsed.notes,
              structure: parsed.structure, sections: parsed.sections,
            }));
            // Migrate the local arrangement id to the remote one so the
            // next round-trip hashes match (and `withArrangement` finds
            // a target on every future pull). This is a one-time fix
            // for songs synced before this preservation existed.
            if (parsed.arrangementId && !hasIdMatch && localTargetId) {
              next = {
                ...next,
                arrangements: next.arrangements.map(a => a.id === localTargetId
                  ? { ...a, id: parsed.arrangementId }
                  : a),
                defaultArrangementId: next.defaultArrangementId === localTargetId
                  ? parsed.arrangementId
                  : next.defaultArrangementId,
              };
            }
            // Carry song-level fields from the remote payload.
            const remoteVersion = {
              ...next,
              title: parsed.title || next.title,
              artist: parsed.artist || next.artist,
              ccli: parsed.ccli || next.ccli,
              tags: parsed.tags || next.tags,
              spotify: parsed.spotify || next.spotify,
              youtube: parsed.youtube || next.youtube,
            };
            // Adopt remote so the immediate post-pull push can't clobber it.
            // On conflict, the divergent local copy travels in the conflict
            // object (not lost) for the user to resolve.
            updatedSongs[existingIdx] = remoteVersion;
            if (isConflict) {
              conflicts.push({ kind: 'song', id: songId, title: localSong.title, local: localSong, remote: remoteVersion });
            }
          } else {
            updatedSongs.push(songFromFlat({ ...parsed, id: songId }));
          }
        } else {
          // New song from remote
          songId = parsed.id || generateId();
          updatedSongs.push(songFromFlat({ ...parsed, id: songId }));
        }

        manifest[songId] = {
          remoteId: file.id,
          remoteName: file.name,
          lastSyncedHash: canonicalSongHash(content),
          lastSyncedTime: file.modifiedTime,
        };
        songsChanged = true;
      }
      if (songId) {
        pulledSongIds.add(songId);
      }
    }

    // Pull setlists from Setlists subfolder
    const setlistFiles = await withRetry(() => provider.listFiles(SETLISTS_FOLDER));
    for (const file of setlistFiles) {
      if (!file.name.endsWith('.json')) continue;

      let setlistId = null;
      for (const [id, entry] of Object.entries(slManifest)) {
        if (entry.remoteId === file.id || entry.remoteName === file.name) {
          setlistId = id;
          break;
        }
      }

      const manifestEntry = setlistId ? slManifest[setlistId] : null;
      const remoteTime = new Date(file.modifiedTime).getTime();
      const lastSyncedTime = manifestEntry?.lastSyncedTime
        ? new Date(manifestEntry.lastSyncedTime).getTime()
        : 0;

      if (remoteTime > lastSyncedTime) {
        // Respect local tombstones unless remote is newer than the delete
        if (setlistId && setlistTombstones.has(setlistId)) {
          if (setlistTombstones.get(setlistId) >= remoteTime) {
            continue;
          }
          setlistTombstones.delete(setlistId);
          tombstonesChanged = true;
        }

        const content = await withRetry(() => provider.downloadFile(file.id, SETLISTS_FOLDER));
        try {
          const remoteSetlist = JSON.parse(content);
          if (setlistId) {
            // Update existing setlist (or re-add if missing from local state)
            const existingIdx = updatedSetlists.findIndex(sl => sl.id === setlistId);
            if (existingIdx >= 0) {
              const localSl = updatedSetlists[existingIdx];
              const lastSyncedHash = manifestEntry?.lastSyncedHash;
              const isConflict = !migrating && lastSyncedHash != null
                && canonicalSetlistHash(localSl) !== lastSyncedHash;
              updatedSetlists[existingIdx] = remoteSetlist;
              if (isConflict) {
                conflicts.push({ kind: 'setlist', id: setlistId, title: localSl.name, local: localSl, remote: remoteSetlist });
              }
            } else {
              updatedSetlists.push(remoteSetlist);
            }
          } else {
            setlistId = remoteSetlist.id || generateId();
            const existingIdx = updatedSetlists.findIndex(sl => sl.id === setlistId);
            if (existingIdx >= 0) {
              updatedSetlists[existingIdx] = remoteSetlist;
            } else {
              updatedSetlists.push(remoteSetlist);
            }
          }

          slManifest[setlistId] = {
            remoteId: file.id,
            remoteName: file.name,
            lastSyncedHash: canonicalSetlistHash(content),
            lastSyncedTime: file.modifiedTime,
          };
          setlistsChanged = true;
        } catch (err) {
          console.error(`Failed to parse setlist JSON "${file.name}":`, err);
        }
      }
      if (setlistId) {
        pulledSetlistIds.add(setlistId);
      }
    }

    // Find remote deletions for songs
    for (const [id] of Object.entries(manifest)) {
      if (!pulledSongIds.has(id) && !songTombstones.has(id)) {
        // File is missing remotely.
        // We drop the manifest entry so the next push() will re-upload it.
        // In a true multi-device sync, we might want to delete it locally if unchanged,
        // but to prevent data loss (e.g. if the remote DB was nuked), we re-upload.
        delete manifest[id];
        songsChanged = true;
      }
    }

    // Find remote deletions for setlists
    for (const [id] of Object.entries(slManifest)) {
      if (!pulledSetlistIds.has(id) && !setlistTombstones.has(id)) {
        delete slManifest[id];
        setlistsChanged = true;
      }
    }

    if (songsChanged) await updateSyncManifest(manifest, libraryId);
    if (setlistsChanged) await updateSetlistManifest(slManifest, libraryId);

    const nextTombstones = tombstonesChanged
      ? {
          songs: Array.from(songTombstones, ([id, deletedAt]) => ({ id, deletedAt })),
          setlists: Array.from(setlistTombstones, ([id, deletedAt]) => ({ id, deletedAt })),
        }
      : tombstones;

    return {
      songs: updatedSongs,
      setlists: updatedSetlists,
      tombstones: nextTombstones,
      tombstonesChanged,
      conflicts,
      pulledSongIds,
      pulledSetlistIds,
      changed: songsChanged || setlistsChanged,
    };
  }

  async function push(songs, setlists, tombstones = { songs: [], setlists: [] }) {
    const syncState = await getSyncState(libraryId);
    if (!syncState.activeProvider) {
      return { tombstones, tombstonesChanged: false, uploaded: { songs: 0, setlists: 0 }, errors: [] };
    }

    const provider = getProvider(syncState.activeProvider, { readOnly });
    await ensureAuth(provider, syncState);
    await withRetry(() => provider.ensureFolder());

    const manifest = { ...syncState.syncManifest };
    const slManifest = { ...syncState.setlistManifest };
    const errors = [];
    let uploadedSongs = 0;
    let uploadedSetlists = 0;

    // Push songs
    for (const song of songs) {
      try {
        const { md, hash } = hashSong(song);
        const entry = manifest[song.id];
        const fileName = `${sanitizeFilename(song.title)}.md`;

        // Detect rename: title changed, old file exists
        if (entry && entry.remoteName && entry.remoteName !== fileName) {
          try {
            await provider.deleteFile(entry.remoteId);
          } catch { /* old file may not exist */ }
        }

        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== fileName) {
          if (ampGuard.shouldBlock(song.id)) {
            errors.push({ kind: 'song', id: song.id, title: song.title, message: 'Sync paused for this song: it was pushed too many times in a short window (possible sync loop). It will retry later.' });
            continue;
          }
          const result = await provider.uploadFile(SONGS_FOLDER, fileName, md, 'text/markdown', entry?.remoteId);
          manifest[song.id] = {
            remoteId: result.id,
            remoteName: result.name,
            lastSyncedHash: hash,
            lastSyncedTime: result.modifiedTime,
          };
          uploadedSongs += 1;
        }
      } catch (err) {
        console.error(`Failed to sync song "${song.title}":`, err);
        errors.push({ kind: 'song', id: song.id, title: song.title, message: err?.message || String(err) });
      }
    }

    // Delete remote files for songs removed locally.
    // CIRCUIT BREAKER: refuse to delete a large share of the library in one
    // sync. This loop deletes by ABSENCE from the local array, so a momentarily
    // empty/truncated local state (bad pull, library-switch race) would wipe
    // every remote file. A real user removing that many at once is implausible;
    // block the destructive batch and surface an error instead.
    const currentSongIds = new Set(songs.map(s => s.id));
    const songDeletes = Object.keys(manifest).filter(id => !currentSongIds.has(id));
    const songMass = songDeletes.length >= 8 && songDeletes.length > Object.keys(manifest).length * 0.5;
    if (songMass) {
      errors.push({ kind: 'song', message: `Safety guard: refused to delete ${songDeletes.length} of ${Object.keys(manifest).length} songs in one sync. No files were removed.` });
    } else {
      for (const id of songDeletes) {
        try { await provider.deleteFile(manifest[id].remoteId); } catch { /* may not exist */ }
        delete manifest[id];
      }
    }

    await updateSyncManifest(manifest, libraryId);

    // Push setlists (each as individual .json file)
    for (const sl of setlists) {
      try {
        const { json, hash } = hashSetlist(sl);
        const entry = slManifest[sl.id];
        const fileName = `${sanitizeFilename(sl.name || 'Untitled Setlist')}.json`;

        // Detect rename
        if (entry && entry.remoteName && entry.remoteName !== fileName) {
          try {
            await provider.deleteFile(entry.remoteId);
          } catch { /* old file may not exist */ }
        }

        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== fileName) {
          if (ampGuard.shouldBlock(sl.id)) {
            errors.push({ kind: 'setlist', id: sl.id, title: sl.name, message: 'Sync paused for this setlist: it was pushed too many times in a short window (possible sync loop). It will retry later.' });
            continue;
          }
          const result = await provider.uploadFile(SETLISTS_FOLDER, fileName, json, 'application/json', entry?.remoteId);
          slManifest[sl.id] = {
            remoteId: result.id,
            remoteName: result.name,
            lastSyncedHash: hash,
            lastSyncedTime: result.modifiedTime,
          };
          uploadedSetlists += 1;
        }
      } catch (err) {
        console.error(`Failed to sync setlist "${sl.name}":`, err);
        errors.push({ kind: 'setlist', id: sl.id, title: sl.name, message: err?.message || String(err) });
      }
    }

    // Delete remote files for setlists removed locally (same circuit breaker).
    const currentSetlistIds = new Set(setlists.map(sl => sl.id));
    const slDeletes = Object.keys(slManifest).filter(id => !currentSetlistIds.has(id));
    const slMass = slDeletes.length >= 8 && slDeletes.length > Object.keys(slManifest).length * 0.5;
    if (slMass) {
      errors.push({ kind: 'setlist', message: `Safety guard: refused to delete ${slDeletes.length} of ${Object.keys(slManifest).length} setlists in one sync. No files were removed.` });
    } else {
      for (const id of slDeletes) {
        try { await provider.deleteFile(slManifest[id].remoteId); } catch { /* may not exist */ }
        delete slManifest[id];
      }
    }

    await updateSetlistManifest(slManifest, libraryId);

    // Drop tombstones whose remote file has been fully deleted
    const prunedSongTs = (tombstones.songs || []).filter(t => manifest[t.id]);
    const prunedSetlistTs = (tombstones.setlists || []).filter(t => slManifest[t.id]);
    const tombstonesChanged =
      prunedSongTs.length !== (tombstones.songs?.length || 0) ||
      prunedSetlistTs.length !== (tombstones.setlists?.length || 0);
    return {
      tombstones: tombstonesChanged
        ? { songs: prunedSongTs, setlists: prunedSetlistTs }
        : tombstones,
      tombstonesChanged,
      uploaded: { songs: uploadedSongs, setlists: uploadedSetlists },
      errors,
    };
  }

  return {
    async fullSync(songs, setlists, tombstones = { songs: [], setlists: [] }) {
      if (syncing) return { songs, setlists, tombstones, changed: false };
      syncing = true;
      setStatus('syncing');

      try {
        // Serialize with any other sync pass over this library (another tab,
        // a temp engine) — the manifests are read-modify-write.
        return await withSyncLock(libraryId, async () => {
          const pullResult = await pull(songs, setlists, tombstones);
          const pushResult = await push(pullResult.songs, pullResult.setlists, pullResult.tombstones);

          const lastSync = new Date().toISOString();
          const syncState = await getSyncState(libraryId);
          await setPendingPush(false, libraryId);
          await setHashVersion(HASH_VERSION, libraryId);
          setStatus('synced', { lastSync, provider: syncState.activeProvider });

          return {
            ...pullResult,
            tombstones: pushResult.tombstones,
            tombstonesChanged: pullResult.tombstonesChanged || pushResult.tombstonesChanged,
            uploaded: pushResult.uploaded,
            errors: pushResult.errors,
          };
        });
      } catch (err) {
        console.error('Sync error:', err);
        setStatus('error');
        return { songs, setlists, tombstones, conflicts: [], changed: false, errors: [{ kind: 'engine', message: err?.message || String(err) }] };
      } finally {
        syncing = false;
      }
    },

    debouncedPush(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runPush(songs, setlists, tombstones, onTombstonesPruned);
      }, SYNC_DEBOUNCE_MS);
    },

    // Run any pending debounced push immediately. Called when the tab is about
    // to be hidden/closed so an edit made inside the 2s debounce window still
    // reaches the cloud (and the pendingPush flag is set first, so even an
    // interrupted push resumes on next launch).
    flushPending(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (!debounceTimer) return;
      clearTimeout(debounceTimer);
      debounceTimer = null;
      return runPush(songs, setlists, tombstones, onTombstonesPruned);
    },

    cancelDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };

  // Shared push-now used by both the debounce timer and flushPending. Marks the
  // pending-push flag before writing so an interrupted/failed push is retried
  // on the next launch, and clears it once the push confirms.
  async function runPush(songs, setlists, tombstones, onTombstonesPruned) {
    // Don't race a full sync; a focus/startup full sync will cover these edits.
    if (syncing) return;
    const syncState = await getSyncState(libraryId);
    if (!syncState.activeProvider) return;

    syncing = true;
    try {
      await withSyncLock(libraryId, async () => {
        await setPendingPush(true, libraryId);
        const pushResult = await push(songs, setlists, tombstones);
        if (pushResult?.tombstonesChanged) {
          onTombstonesPruned?.(pushResult.tombstones);
        }
        await setPendingPush(false, libraryId);
        // Only surface "synced" when work actually happened — otherwise the
        // status churns ("Syncing…/Synced") on every keystroke-debounce.
        const uploaded = (pushResult?.uploaded?.songs || 0) + (pushResult?.uploaded?.setlists || 0);
        if (uploaded > 0 || pushResult?.tombstonesChanged) {
          setStatus('synced', { lastSync: new Date().toISOString(), provider: syncState.activeProvider });
        }
      });
    } catch (err) {
      console.error('Sync push error:', err);
      setStatus('error');
    } finally {
      syncing = false;
    }
  }
}
