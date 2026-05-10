import { getProvider } from './provider';
import { getSyncState, updateSyncManifest, updateSetlistManifest, updateTokens, isTokenExpired } from './tokens';
import { SONGS_FOLDER, SETLISTS_FOLDER, SYNC_DEBOUNCE_MS } from './constants';
import { parseSongMd, songToMd, generateId } from '../parser';
import { songFromFlat, withArrangement } from '../arrangements';

function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function sanitizeFilename(name) {
  return (name || 'Untitled')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}


export function createSyncEngine(onStatusChange, libraryId = 'personal') {
  let syncing = false;
  let debounceTimer = null;

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
      } catch {
        setStatus('error');
        throw new Error('Token refresh failed. Please reconnect.');
      }
    }
  }

  async function pull(songs, setlists, tombstones = { songs: [], setlists: [] }) {
    const syncState = await getSyncState(libraryId);
    if (!syncState.activeProvider) return { songs, setlists, tombstones, changed: false };

    const provider = getProvider(syncState.activeProvider);
    await ensureAuth(provider, syncState);
    await provider.ensureFolder();

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
    const songFiles = await provider.listFiles(SONGS_FOLDER);
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

        const content = await provider.downloadFile(file.id, SONGS_FOLDER);
        const parsed = parseSongMd(content);

        if (songId) {
          // Update existing song (or re-add if missing from local state)
          const existingIdx = updatedSongs.findIndex(s => s.id === songId);
          if (existingIdx >= 0) {
            // Detect conflict: local diverged from last-synced before remote changed
            const localSong = updatedSongs[existingIdx];
            const lastSyncedHash = manifestEntry?.lastSyncedHash;
            if (lastSyncedHash != null) {
              const localHash = quickHash(songToMd(localSong));
              if (localHash !== lastSyncedHash) {
                conflicts.push({ kind: 'song', id: songId, title: localSong.title });
              }
            }
            // For v2 songs, merge the remote arrangement into the existing
            // arrangements rather than replacing the whole song object.
            const targetArrId = parsed.arrangementId || localSong.defaultArrangementId;
            const next = withArrangement(localSong, targetArrId, (a) => ({
              ...a,
              key: parsed.key, tempo: parsed.tempo, time: parsed.time,
              capo: parsed.capo, notes: parsed.notes,
              structure: parsed.structure, sections: parsed.sections,
            }));
            // Carry song-level fields from the remote payload.
            updatedSongs[existingIdx] = {
              ...next,
              title: parsed.title || next.title,
              artist: parsed.artist || next.artist,
              ccli: parsed.ccli || next.ccli,
              tags: parsed.tags || next.tags,
              spotify: parsed.spotify || next.spotify,
              youtube: parsed.youtube || next.youtube,
            };
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
          lastSyncedHash: quickHash(content),
          lastSyncedTime: file.modifiedTime,
        };
        songsChanged = true;
        pulledSongIds.add(songId);
      }
    }

    // Pull setlists from Setlists subfolder
    const setlistFiles = await provider.listFiles(SETLISTS_FOLDER);
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

        const content = await provider.downloadFile(file.id, SETLISTS_FOLDER);
        try {
          const remoteSetlist = JSON.parse(content);
          if (setlistId) {
            // Update existing setlist (or re-add if missing from local state)
            const existingIdx = updatedSetlists.findIndex(sl => sl.id === setlistId);
            if (existingIdx >= 0) {
              const localSl = updatedSetlists[existingIdx];
              const lastSyncedHash = manifestEntry?.lastSyncedHash;
              if (lastSyncedHash != null) {
                const localHash = quickHash(JSON.stringify(localSl, null, 2));
                if (localHash !== lastSyncedHash) {
                  conflicts.push({ kind: 'setlist', id: setlistId, title: localSl.name });
                }
              }
              updatedSetlists[existingIdx] = remoteSetlist;
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
            lastSyncedHash: quickHash(content),
            lastSyncedTime: file.modifiedTime,
          };
          setlistsChanged = true;
          pulledSetlistIds.add(setlistId);
        } catch (err) {
          console.error(`Failed to parse setlist JSON "${file.name}":`, err);
        }
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
    if (!syncState.activeProvider) return { tombstones, tombstonesChanged: false };

    const provider = getProvider(syncState.activeProvider);
    await ensureAuth(provider, syncState);
    await provider.ensureFolder();

    const manifest = { ...syncState.syncManifest };
    const slManifest = { ...syncState.setlistManifest };

    // Push songs
    for (const song of songs) {
      try {
        const md = songToMd(song);
        const hash = quickHash(md);
        const entry = manifest[song.id];
        const fileName = `${sanitizeFilename(song.title)}.md`;

        // Detect rename: title changed, old file exists
        if (entry && entry.remoteName && entry.remoteName !== fileName) {
          try {
            await provider.deleteFile(entry.remoteId);
          } catch { /* old file may not exist */ }
        }

        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== fileName) {
          const result = await provider.uploadFile(SONGS_FOLDER, fileName, md, 'text/markdown', entry?.remoteId);
          manifest[song.id] = {
            remoteId: result.id,
            remoteName: result.name,
            lastSyncedHash: hash,
            lastSyncedTime: result.modifiedTime,
          };
        }
      } catch (err) {
        console.error(`Failed to sync song "${song.title}":`, err);
      }
    }

    // Delete remote files for songs removed locally
    const currentSongIds = new Set(songs.map(s => s.id));
    for (const [id, entry] of Object.entries(manifest)) {
      if (!currentSongIds.has(id)) {
        try { await provider.deleteFile(entry.remoteId); } catch { /* may not exist */ }
        delete manifest[id];
      }
    }

    await updateSyncManifest(manifest, libraryId);

    // Push setlists (each as individual .json file)
    for (const sl of setlists) {
      try {
        const json = JSON.stringify(sl, null, 2);
        const hash = quickHash(json);
        const entry = slManifest[sl.id];
        const fileName = `${sanitizeFilename(sl.name || 'Untitled Setlist')}.json`;

        // Detect rename
        if (entry && entry.remoteName && entry.remoteName !== fileName) {
          try {
            await provider.deleteFile(entry.remoteId);
          } catch { /* old file may not exist */ }
        }

        if (!entry || entry.lastSyncedHash !== hash || entry.remoteName !== fileName) {
          const result = await provider.uploadFile(SETLISTS_FOLDER, fileName, json, 'application/json', entry?.remoteId);
          slManifest[sl.id] = {
            remoteId: result.id,
            remoteName: result.name,
            lastSyncedHash: hash,
            lastSyncedTime: result.modifiedTime,
          };
        }
      } catch (err) {
        console.error(`Failed to sync setlist "${sl.name}":`, err);
      }
    }

    // Delete remote files for setlists removed locally
    const currentSetlistIds = new Set(setlists.map(sl => sl.id));
    for (const [id, entry] of Object.entries(slManifest)) {
      if (!currentSetlistIds.has(id)) {
        try { await provider.deleteFile(entry.remoteId); } catch { /* may not exist */ }
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
    };
  }

  return {
    async fullSync(songs, setlists, tombstones = { songs: [], setlists: [] }) {
      if (syncing) return { songs, setlists, tombstones, changed: false };
      syncing = true;
      setStatus('syncing');

      try {
        const pullResult = await pull(songs, setlists, tombstones);
        const pushResult = await push(pullResult.songs, pullResult.setlists, pullResult.tombstones);

        const lastSync = new Date().toISOString();
        const syncState = await getSyncState(libraryId);
        setStatus('synced', { lastSync, provider: syncState.activeProvider });

        return {
          ...pullResult,
          tombstones: pushResult.tombstones,
          tombstonesChanged: pullResult.tombstonesChanged || pushResult.tombstonesChanged,
        };
      } catch (err) {
        console.error('Sync error:', err);
        setStatus('error');
        return { songs, setlists, tombstones, conflicts: [], changed: false };
      } finally {
        syncing = false;
      }
    },

    debouncedPush(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const syncState = await getSyncState(libraryId);
        if (!syncState.activeProvider) return;

        setStatus('syncing');
        try {
          const pushResult = await push(songs, setlists, tombstones);
          if (pushResult?.tombstonesChanged) {
            onTombstonesPruned?.(pushResult.tombstones);
          }
          const lastSync = new Date().toISOString();
          setStatus('synced', { lastSync, provider: syncState.activeProvider });
        } catch (err) {
          console.error('Sync push error:', err);
          setStatus('error');
        }
      }, SYNC_DEBOUNCE_MS);
    },

    cancelDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
