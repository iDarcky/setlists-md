import { supabase as defaultClient } from '../auth/supabase';
import { getSyncState, updateSyncManifest, updateSetlistManifest } from './tokens';
import { parseSongMd, songToMd } from '../parser';
import { songFromFlat, withArrangement } from '../arrangements';
import { SYNC_DEBOUNCE_MS } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// Team library sync — direct table sync against Supabase (team_songs /
// team_setlists), replacing the file-manifest engine (engine.js +
// supabase-team.js provider) for team libraries.
//
// Design: the server is the single source of truth.
//   * pull: every server row wins locally. Items that were previously synced
//     (tracked in the manifest) but are gone from the server were deleted by
//     another member — they are removed locally too.
//   * push: only items whose canonical hash differs from the manifest are
//     written, guarded by compare-and-swap on `updated_at` so a concurrent
//     edit by another member is never silently overwritten (the loser is
//     reported as a conflict and picks up the server copy on the next pull).
//   * members (readOnly): a pure mirror — no writes ever leave the device.
//
// Why hashes kept mismatching in the old design: setlists were hashed from
// pretty-printed JSON on push but compact JSONB text on pull, so every cycle
// looked dirty, re-uploaded, bumped updated_at, woke realtime, and looped.
// Here each side hashes ONE canonical form: the markdown text for songs and a
// key-sorted stringify for setlists (JSONB does not preserve key order).
// ─────────────────────────────────────────────────────────────────────────────

function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

// Deterministic stringify — recursively sorts object keys so the same logical
// value always hashes the same, regardless of JSONB key reordering.
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function setlistHash(sl) {
  return quickHash(stableStringify(sl));
}

// Merge a freshly-pulled flat song (parsed .md) into an existing local song,
// preserving local-only extra arrangements. Mirrors the proven merge in
// engine.js pull(): patch the matching arrangement (by id, falling back to
// the default), then carry song-level fields from the remote payload.
function mergeRemoteSong(localSong, parsed) {
  if (!Array.isArray(localSong?.arrangements) || localSong.arrangements.length === 0) {
    return songFromFlat({ ...parsed, id: localSong?.id || parsed.id });
  }
  const hasIdMatch = localSong.arrangements.some(a => a.id === parsed.arrangementId);
  const localTargetId = hasIdMatch
    ? parsed.arrangementId
    : (localSong.defaultArrangementId || localSong.arrangements[0]?.id);
  let next = withArrangement(localSong, localTargetId, (a) => ({
    ...a,
    name: parsed.arrangementName || a.name,
    key: parsed.key, tempo: parsed.tempo, time: parsed.time,
    capo: parsed.capo, notes: parsed.notes,
    structure: parsed.structure, sections: parsed.sections,
  }));
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
  return {
    ...next,
    title: parsed.title || next.title,
    artist: parsed.artist || next.artist,
    ccli: parsed.ccli || next.ccli,
    tags: parsed.tags || next.tags,
    spotify: parsed.spotify || next.spotify,
    youtube: parsed.youtube || next.youtube,
  };
}

export function createTeamSyncEngine(onStatusChange, teamId, { readOnly = false, client = defaultClient, onConflicts } = {}) {
  let syncing = false;
  let debounceTimer = null;
  let lastPushAt = 0; // when we last wrote rows — used to ignore our own realtime echo
  const libraryId = teamId;

  const setStatus = (state, extra = {}) => {
    onStatusChange?.({ state, ...extra });
  };

  async function fetchRows(table) {
    const cols = table === 'team_songs' ? 'id, title, content, updated_at' : 'id, name, content, updated_at';
    const { data, error } = await client.from(table).select(cols).eq('team_id', teamId);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data || [];
  }

  // Resolve each row to { itemId, rowId, item, hash, updatedAt }. The item id
  // embedded in the content is canonical (it round-trips through songToMd
  // frontmatter / setlist JSON). Rows synced before id preservation fall back
  // to the previous manifest's rowId→itemId mapping — this keeps local ids
  // (and setlist references to them) stable across the engine migration —
  // and only then to the row UUID. Duplicate rows for an item keep the newest.
  function indexSongRows(rows, rowIdToItemId) {
    const byId = new Map();
    const duplicateRowIds = [];
    for (const row of rows) {
      let parsed;
      try {
        parsed = parseSongMd(row.content);
      } catch (err) {
        console.warn(`[team-sync] Skipping unparseable song row ${row.id}:`, err);
        continue;
      }
      const itemId = parsed.id || rowIdToItemId.get(row.id) || row.id;
      const entry = { itemId, rowId: row.id, parsed, hash: quickHash(row.content), updatedAt: row.updated_at };
      const existing = byId.get(itemId);
      if (!existing) {
        byId.set(itemId, entry);
      } else if (new Date(entry.updatedAt) > new Date(existing.updatedAt)) {
        duplicateRowIds.push(existing.rowId);
        byId.set(itemId, entry);
      } else {
        duplicateRowIds.push(entry.rowId);
      }
    }
    return { byId, duplicateRowIds };
  }

  function indexSetlistRows(rows, rowIdToItemId) {
    const byId = new Map();
    const duplicateRowIds = [];
    for (const row of rows) {
      const content = typeof row.content === 'string' ? safeParse(row.content) : row.content;
      if (!content || typeof content !== 'object') {
        console.warn(`[team-sync] Skipping invalid setlist row ${row.id}`);
        continue;
      }
      const itemId = content.id || rowIdToItemId.get(row.id) || row.id;
      const entry = { itemId, rowId: row.id, content, hash: setlistHash(content), updatedAt: row.updated_at };
      const existing = byId.get(itemId);
      if (!existing) {
        byId.set(itemId, entry);
      } else if (new Date(entry.updatedAt) > new Date(existing.updatedAt)) {
        duplicateRowIds.push(existing.rowId);
        byId.set(itemId, entry);
      } else {
        duplicateRowIds.push(entry.rowId);
      }
    }
    return { byId, duplicateRowIds };
  }

  function safeParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  // Pull: server-authoritative reconciliation. Returns the next local arrays
  // plus the refreshed manifests (keyed by item id → { remoteId,
  // lastSyncedHash, lastSyncedTime }).
  async function pull(songs, setlists, tombstones) {
    const syncState = await getSyncState(libraryId);
    const prevManifest = syncState.syncManifest || {};
    const prevSlManifest = syncState.setlistManifest || {};
    const conflicts = [];

    const [songRows, setlistRows] = await Promise.all([
      fetchRows('team_songs'),
      fetchRows('team_setlists'),
    ]);
    const rowIdToSongId = new Map(Object.entries(prevManifest).map(([id, e]) => [e.remoteId, id]));
    const rowIdToSetlistId = new Map(Object.entries(prevSlManifest).map(([id, e]) => [e.remoteId, id]));
    const songIndex = indexSongRows(songRows, rowIdToSongId);
    const setlistIndex = indexSetlistRows(setlistRows, rowIdToSetlistId);

    const songTombstones = new Map((tombstones.songs || []).map(t => [t.id, t.deletedAt]));
    const setlistTombstones = new Map((tombstones.setlists || []).map(t => [t.id, t.deletedAt]));
    let tombstonesChanged = false;

    const manifest = {};
    const nextSongs = [];
    const localSongsById = new Map(songs.map(s => [s.id, s]));

    for (const [itemId, entry] of songIndex.byId) {
      // Local tombstone vs server row: newer local delete → leave for push to
      // remove the row; newer server edit → resurrect.
      if (songTombstones.has(itemId)) {
        if (songTombstones.get(itemId) >= new Date(entry.updatedAt).getTime()) {
          manifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt, deleted: true };
          continue;
        }
        songTombstones.delete(itemId);
        tombstonesChanged = true;
      }

      const local = localSongsById.get(itemId);
      const prevEntry = prevManifest[itemId];
      const remoteChanged = !prevEntry || prevEntry.lastSyncedHash !== entry.hash;

      if (local && !remoteChanged) {
        // Server unchanged since last sync — keep the local copy (it may carry
        // edits awaiting push).
        nextSongs.push(local);
        manifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt };
      } else {
        // Server wins. If the local copy had diverged too, surface a conflict.
        if (local && remoteChanged && prevEntry?.lastSyncedHash != null) {
          const localHash = quickHash(songToMd(local));
          if (localHash !== prevEntry.lastSyncedHash) {
            conflicts.push({ kind: 'song', id: itemId, title: local.title });
          }
        }
        nextSongs.push(local
          ? mergeRemoteSong(local, entry.parsed)
          : songFromFlat({ ...entry.parsed, id: itemId }));
        manifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt };
      }
      localSongsById.delete(itemId);
    }

    // Remaining local songs have no server row. Previously synced → another
    // member deleted them → drop locally. Never synced → new local creations
    // (kept; push() inserts them when allowed).
    for (const [id, local] of localSongsById) {
      if (prevManifest[id]) continue; // deleted on server
      nextSongs.push(local);
    }

    const slManifest = {};
    const nextSetlists = [];
    const localSlById = new Map(setlists.map(sl => [sl.id, sl]));

    for (const [itemId, entry] of setlistIndex.byId) {
      if (setlistTombstones.has(itemId)) {
        if (setlistTombstones.get(itemId) >= new Date(entry.updatedAt).getTime()) {
          slManifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt, deleted: true };
          continue;
        }
        setlistTombstones.delete(itemId);
        tombstonesChanged = true;
      }

      const local = localSlById.get(itemId);
      const prevEntry = prevSlManifest[itemId];
      const remoteChanged = !prevEntry || prevEntry.lastSyncedHash !== entry.hash;

      if (local && !remoteChanged) {
        nextSetlists.push(local);
      } else {
        if (local && remoteChanged && prevEntry?.lastSyncedHash != null) {
          if (setlistHash(local) !== prevEntry.lastSyncedHash) {
            conflicts.push({ kind: 'setlist', id: itemId, title: local.name });
          }
        }
        nextSetlists.push({ ...entry.content, id: itemId });
      }
      slManifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt };
      localSlById.delete(itemId);
    }

    for (const [id, local] of localSlById) {
      if (prevSlManifest[id]) continue;
      nextSetlists.push(local);
    }

    return {
      songs: nextSongs,
      setlists: nextSetlists,
      manifest,
      slManifest,
      conflicts,
      duplicateRowIds: [...songIndex.duplicateRowIds, ...setlistIndex.duplicateRowIds],
      tombstones: tombstonesChanged
        ? {
            songs: Array.from(songTombstones, ([id, deletedAt]) => ({ id, deletedAt })),
            setlists: Array.from(setlistTombstones, ([id, deletedAt]) => ({ id, deletedAt })),
          }
        : tombstones,
      tombstonesChanged,
    };
  }

  // Push: write local changes through to the tables. Updates use
  // compare-and-swap on updated_at — if another member wrote since our last
  // pull, the update matches 0 rows and we record a conflict instead of
  // overwriting them (the next pull adopts their version).
  async function push(songs, setlists, manifest, slManifest) {
    const errors = [];
    const conflicts = [];
    const uploaded = { songs: 0, setlists: 0 };
    if (readOnly) return { manifest, slManifest, uploaded, errors, conflicts };

    const nextManifest = { ...manifest };
    for (const song of songs) {
      try {
        const md = songToMd(song);
        const hash = quickHash(md);
        const entry = nextManifest[song.id];
        if (entry && entry.lastSyncedHash === hash) continue;

        const payload = { team_id: teamId, title: song.title || 'Untitled', content: md, updated_at: new Date().toISOString() };
        if (entry?.remoteId) {
          const { data, error } = await client
            .from('team_songs')
            .update(payload)
            .eq('id', entry.remoteId)
            .eq('team_id', teamId)
            .eq('updated_at', entry.lastSyncedTime)
            .select('id, updated_at')
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) {
            // CAS miss — the row changed (or vanished) since our pull.
            conflicts.push({ kind: 'song', id: song.id, title: song.title });
            continue;
          }
          nextManifest[song.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
        } else {
          const { data, error } = await client
            .from('team_songs')
            .insert(payload)
            .select('id, updated_at')
            .single();
          if (error) throw new Error(error.message);
          nextManifest[song.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
        }
        uploaded.songs += 1;
      } catch (err) {
        errors.push({ kind: 'song', id: song.id, title: song.title, message: err?.message || String(err) });
      }
    }

    // Locally-deleted songs: pull() marked their manifest entries `deleted`.
    for (const [id, entry] of Object.entries(nextManifest)) {
      if (!entry.deleted) continue;
      try {
        const { error } = await client.from('team_songs').delete().eq('id', entry.remoteId).eq('team_id', teamId);
        if (error) throw new Error(error.message);
        delete nextManifest[id];
      } catch (err) {
        errors.push({ kind: 'song', id, message: err?.message || String(err) });
      }
    }

    const nextSlManifest = { ...slManifest };
    for (const sl of setlists) {
      try {
        const hash = setlistHash(sl);
        const entry = nextSlManifest[sl.id];
        if (entry && entry.lastSyncedHash === hash) continue;

        const payload = { team_id: teamId, name: sl.name || 'Untitled Setlist', content: sl, updated_at: new Date().toISOString() };
        if (entry?.remoteId) {
          const { data, error } = await client
            .from('team_setlists')
            .update(payload)
            .eq('id', entry.remoteId)
            .eq('team_id', teamId)
            .eq('updated_at', entry.lastSyncedTime)
            .select('id, updated_at')
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) {
            conflicts.push({ kind: 'setlist', id: sl.id, title: sl.name });
            continue;
          }
          nextSlManifest[sl.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
        } else {
          const { data, error } = await client
            .from('team_setlists')
            .insert(payload)
            .select('id, updated_at')
            .single();
          if (error) throw new Error(error.message);
          nextSlManifest[sl.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
        }
        uploaded.setlists += 1;
      } catch (err) {
        errors.push({ kind: 'setlist', id: sl.id, title: sl.name, message: err?.message || String(err) });
      }
    }

    for (const [id, entry] of Object.entries(nextSlManifest)) {
      if (!entry.deleted) continue;
      try {
        const { error } = await client.from('team_setlists').delete().eq('id', entry.remoteId).eq('team_id', teamId);
        if (error) throw new Error(error.message);
        delete nextSlManifest[id];
      } catch (err) {
        errors.push({ kind: 'setlist', id, message: err?.message || String(err) });
      }
    }

    return { manifest: nextManifest, slManifest: nextSlManifest, uploaded, errors, conflicts };
  }

  async function runFullSync(songs, setlists, tombstones) {
    const pullResult = await pull(songs, setlists, tombstones);
    const pushResult = await push(pullResult.songs, pullResult.setlists, pullResult.manifest, pullResult.slManifest);

    // Best-effort cleanup of duplicate rows healed during pull (writers only).
    if (!readOnly && pullResult.duplicateRowIds.length > 0) {
      for (const rowId of pullResult.duplicateRowIds) {
        try {
          await client.from('team_songs').delete().eq('id', rowId).eq('team_id', teamId);
          await client.from('team_setlists').delete().eq('id', rowId).eq('team_id', teamId);
        } catch { /* best effort */ }
      }
    }

    await updateSyncManifest(pushResult.manifest, libraryId);
    await updateSetlistManifest(pushResult.slManifest, libraryId);

    // Tombstones whose rows are gone (deleted by push, or already absent) can
    // be dropped — keep only ones still awaiting a remote delete.
    const keptSongTs = (pullResult.tombstones.songs || []).filter(t => pushResult.manifest[t.id]);
    const keptSlTs = (pullResult.tombstones.setlists || []).filter(t => pushResult.slManifest[t.id]);
    const tombstonesChanged = pullResult.tombstonesChanged
      || keptSongTs.length !== (pullResult.tombstones.songs?.length || 0)
      || keptSlTs.length !== (pullResult.tombstones.setlists?.length || 0);

    return {
      songs: pullResult.songs,
      setlists: pullResult.setlists,
      tombstones: { songs: keptSongTs, setlists: keptSlTs },
      tombstonesChanged,
      conflicts: [...pullResult.conflicts, ...pushResult.conflicts],
      uploaded: pushResult.uploaded,
      errors: pushResult.errors,
      changed: true,
      replaced: true, // App should adopt songs/setlists wholesale
    };
  }

  return {
    async fullSync(songs, setlists, tombstones = { songs: [], setlists: [] }) {
      if (syncing || !client) return { songs, setlists, tombstones, changed: false };
      syncing = true;
      setStatus('syncing');
      try {
        const result = await runFullSync(songs, setlists, tombstones);
        if ((result.uploaded?.songs || 0) + (result.uploaded?.setlists || 0) > 0) lastPushAt = Date.now();
        setStatus('synced', { lastSync: new Date().toISOString(), provider: `supabase-team:${teamId}` });
        return result;
      } catch (err) {
        console.error('[team-sync] Sync error:', err);
        setStatus('error');
        return { songs, setlists, tombstones, conflicts: [], changed: false, errors: [{ kind: 'engine', message: err?.message || String(err) }] };
      } finally {
        syncing = false;
      }
    },

    // Push-only pass for local edits. Reuses the persisted manifest; writes are
    // CAS-guarded, so a stale manifest can never clobber a newer server row.
    debouncedPush(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (readOnly || !client) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (syncing) return; // a full sync is already in flight
        syncing = true;
        try {
          const syncState = await getSyncState(libraryId);
          const manifest = { ...(syncState.syncManifest || {}) };
          const slManifest = { ...(syncState.setlistManifest || {}) };
          // Mark tombstoned items for deletion, mirroring pull()'s contract.
          for (const t of tombstones.songs || []) {
            if (manifest[t.id]) manifest[t.id] = { ...manifest[t.id], deleted: true };
          }
          for (const t of tombstones.setlists || []) {
            if (slManifest[t.id]) slManifest[t.id] = { ...slManifest[t.id], deleted: true };
          }
          const result = await push(songs, setlists, manifest, slManifest);
          await updateSyncManifest(result.manifest, libraryId);
          await updateSetlistManifest(result.slManifest, libraryId);
          const keptSongTs = (tombstones.songs || []).filter(t => result.manifest[t.id]);
          const keptSlTs = (tombstones.setlists || []).filter(t => result.slManifest[t.id]);
          const tsPruned = keptSongTs.length !== (tombstones.songs?.length || 0)
            || keptSlTs.length !== (tombstones.setlists?.length || 0);
          if (tsPruned) {
            onTombstonesPruned?.({ songs: keptSongTs, setlists: keptSlTs });
          }
          // Only surface "synced" when something actually changed — avoids the
          // status churn that made team sync feel jittery on every edit.
          const uploaded = (result.uploaded?.songs || 0) + (result.uploaded?.setlists || 0);
          if (uploaded > 0) lastPushAt = Date.now();
          if (uploaded > 0 || tsPruned) {
            setStatus('synced', { lastSync: new Date().toISOString(), provider: `supabase-team:${teamId}` });
          }
          // Surface CAS conflicts (another member wrote first) so the user knows
          // their edit was superseded — otherwise the debounced push swallowed them.
          if (result.conflicts?.length) onConflicts?.(result.conflicts);
        } catch (err) {
          console.error('[team-sync] Push error:', err);
          setStatus('error');
        } finally {
          syncing = false;
        }
      }, SYNC_DEBOUNCE_MS);
    },

    cancelDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    // True if we wrote rows very recently — lets the realtime listener ignore
    // the echo of our own writes instead of re-syncing for nothing.
    recentlyPushed(windowMs = 4000) {
      return Date.now() - lastPushAt < windowMs;
    },
  };
}
