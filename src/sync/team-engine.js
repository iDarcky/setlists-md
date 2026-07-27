import { supabase as defaultClient } from '@/auth/supabase';
import { getSyncState, updateSyncManifest, updateSetlistManifest, setPendingPush, setHashVersion } from './tokens';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat, withArrangement } from '@/arrangements';
import { SYNC_DEBOUNCE_MS } from './constants';
import { withRetry } from './retry';
import { canonicalSongHash, canonicalSetlistHash, HASH_VERSION } from './canonical';
import { createAmplificationGuard } from './amplification-guard';
import { withSyncLock } from './lock';

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

// Canonical, version-stable change detection (see ./canonical). stableStringify
// is re-exported for back-compat with existing imports/tests.
export { stableStringify } from './canonical';

function setlistHash(sl) {
  return canonicalSetlistHash(sl);
}

// On a push compare-and-swap miss, fetch the server's current copy so the
// conflict surfaced to the user carries both sides (mine + cloud). Best-effort:
// returns null if the row can't be read, and the next pull will re-surface it.
async function fetchConflictSong(client, teamId, rowId, id) {
  try {
    const { data } = await client
      .from('team_songs').select('content, updated_at')
      .eq('id', rowId).eq('team_id', teamId).maybeSingle();
    if (!data?.content) return null;
    const ts = data.updated_at ? new Date(data.updated_at).getTime() : Date.now();
    return { ...songFromFlat({ ...parseSongMd(data.content), id }), updatedAt: ts };
  } catch { return null; }
}

async function fetchConflictSetlist(client, teamId, rowId, id) {
  try {
    const { data } = await client
      .from('team_setlists').select('content')
      .eq('id', rowId).eq('team_id', teamId).maybeSingle();
    if (!data?.content) return null;
    return { ...data.content, id };
  } catch { return null; }
}

// Merge a freshly-pulled flat song (parsed .md) into an existing local song,
// preserving local-only extra arrangements. Mirrors the proven merge in
// engine.js pull(): patch the matching arrangement (by id, falling back to
// the default), then carry song-level fields from the remote payload.
function mergeRemoteSong(localSong, parsed, serverUpdatedAt) {
  if (!Array.isArray(localSong?.arrangements) || localSong.arrangements.length === 0) {
    const fresh = songFromFlat({ ...parsed, id: localSong?.id || parsed.id });
    return serverUpdatedAt ? { ...fresh, updatedAt: serverUpdatedAt } : fresh;
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
    // withArrangement stamped Date.now(); restore the server's edit time so a
    // pulled-but-unedited song doesn't surface as freshly edited.
    ...(serverUpdatedAt ? { updatedAt: serverUpdatedAt } : {}),
  };
}

export function createTeamSyncEngine(onStatusChange, teamId, { readOnly = false, client = defaultClient, onConflicts, pageSize = 1000 } = {}) {
  let syncing = false;
  let debounceTimer = null;
  let lastPushAt = 0; // when we last wrote rows — used to ignore our own realtime echo
  const libraryId = teamId;
  const ampGuard = createAmplificationGuard();

  // Per-engine hash caches keyed by object reference. Serializing every song to
  // markdown (songToMd) and stable-stringifying every setlist on each sync is
  // the dominant CPU cost for large libraries. React replaces only an edited
  // item's object, so when the reference is unchanged its serialized form and
  // hash are too — reuse them and skip the work. A miss (new ref) recomputes.
  const songHashCache = new Map(); // id -> { ref, md, hash }
  const slHashCache = new Map();   // id -> { ref, hash }

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
    if (cached && cached.ref === sl) return cached.hash;
    const hash = setlistHash(sl);
    slHashCache.set(sl.id, { ref: sl, hash });
    return hash;
  }

  const setStatus = (state, extra = {}) => {
    onStatusChange?.({ state, ...extra });
  };

  // Row heads (id + updated_at) for the WHOLE set. The full set matters: a
  // truncated read would make the pull treat every un-fetched (but previously
  // synced) row as "deleted on the server" and drop it locally. Pagination is
  // KEYSET on the immutable primary key: OFFSET/range pages over a set that
  // other members are writing to can skip rows when a concurrent
  // insert/delete/update shifts row positions between page reads — and a
  // skipped row is indistinguishable from a server-side deletion. `id` never
  // moves, so pages tile the set exactly regardless of concurrent traffic.
  async function fetchHeads(table) {
    const out = [];
    let afterId = null;
    for (;;) {
      // Retry only transient network failures (the query builder *rejects* on
      // those); PostgREST errors come back in `error` and are not retried.
      const { data, error } = await withRetry(() => {
        let q = client
          .from(table)
          .select('id, updated_at')
          .eq('team_id', teamId)
          .order('id', { ascending: true })
          .limit(pageSize);
        if (afterId != null) q = q.gt('id', afterId);
        return q;
      });
      if (error) throw new Error(`${table}: ${error.message}`);
      const batch = data || [];
      out.push(...batch);
      if (batch.length < pageSize) break;
      afterId = batch[batch.length - 1].id;
    }
    return out;
  }

  async function fetchContentByIds(table, ids) {
    const cols = table === 'team_songs' ? 'id, title, content, updated_at' : 'id, name, content, updated_at';
    const CHUNK = 100;
    const out = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await withRetry(() => client
        .from(table)
        .select(cols)
        .eq('team_id', teamId)
        .in('id', chunk));
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data || []));
    }
    return out;
  }

  // DELTA PULL: fetch heads for everything, but content only for rows we
  // can't prove unchanged. A row is provably unchanged when the previous
  // manifest maps its id with the SAME updated_at — for those the manifest's
  // stored hash and identity stand in for the content, skipping both the
  // download and the parse (on a big library nearly every row, every sync).
  // `localIds` forces a content fetch for rows whose local copy is missing:
  // there would be nothing to materialize them from otherwise. `forceContent`
  // disables the shortcut wholesale — used during a hash-version migration,
  // where the manifest's stored hashes are old-algorithm and every row must
  // be re-fetched once to re-baseline its canonical hash.
  async function fetchRowsDelta(table, prevByRemoteId, localIds, forceContent = false) {
    const heads = await fetchHeads(table);
    const unchanged = [];
    const needContent = [];
    for (const head of heads) {
      const prev = prevByRemoteId.get(head.id);
      if (!forceContent && prev && prev.entry.lastSyncedTime === head.updated_at && localIds.has(prev.itemId)) {
        unchanged.push({
          itemId: prev.itemId,
          rowId: head.id,
          hash: prev.entry.lastSyncedHash,
          updatedAt: head.updated_at,
        });
      } else {
        needContent.push(head.id);
      }
    }
    const contentRows = needContent.length ? await fetchContentByIds(table, needContent) : [];
    return { unchanged, contentRows };
  }

  // Duplicate healing shared by both indexers: one entry per item id, newest
  // row wins, losers are collected for best-effort server deletion.
  function dedupeInto(byId, duplicateRowIds, entry) {
    const existing = byId.get(entry.itemId);
    if (!existing) {
      byId.set(entry.itemId, entry);
    } else if (new Date(entry.updatedAt) > new Date(existing.updatedAt)) {
      duplicateRowIds.push(existing.rowId);
      byId.set(entry.itemId, entry);
    } else {
      duplicateRowIds.push(entry.rowId);
    }
  }

  // Resolve each row to { itemId, rowId, parsed?, hash, updatedAt }. The item
  // id embedded in the content is canonical (it round-trips through songToMd
  // frontmatter / setlist JSON). Rows synced before id preservation fall back
  // to the previous manifest's rowId→itemId mapping — this keeps local ids
  // (and setlist references to them) stable across the engine migration —
  // and only then to the row UUID. `unchanged` entries come from the delta
  // fetch with identity + hash straight from the manifest (parsed stays
  // undefined — their content was neither downloaded nor parsed).
  function indexSongRows(rows, rowIdToItemId, unchanged = []) {
    const byId = new Map();
    const duplicateRowIds = [];
    for (const u of unchanged) dedupeInto(byId, duplicateRowIds, u);
    for (const row of rows) {
      let parsed;
      try {
        parsed = parseSongMd(row.content);
      } catch (err) {
        console.warn(`[team-sync] Skipping unparseable song row ${row.id}:`, err);
        continue;
      }
      const itemId = parsed.id || rowIdToItemId.get(row.id) || row.id;
      dedupeInto(byId, duplicateRowIds, { itemId, rowId: row.id, parsed, hash: canonicalSongHash(row.content), updatedAt: row.updated_at });
    }
    return { byId, duplicateRowIds };
  }

  function indexSetlistRows(rows, rowIdToItemId, unchanged = []) {
    const byId = new Map();
    const duplicateRowIds = [];
    for (const u of unchanged) dedupeInto(byId, duplicateRowIds, u);
    for (const row of rows) {
      const content = typeof row.content === 'string' ? safeParse(row.content) : row.content;
      if (!content || typeof content !== 'object') {
        console.warn(`[team-sync] Skipping invalid setlist row ${row.id}`);
        continue;
      }
      const itemId = content.id || rowIdToItemId.get(row.id) || row.id;
      dedupeInto(byId, duplicateRowIds, { itemId, rowId: row.id, content, hash: setlistHash(content), updatedAt: row.updated_at });
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
    const migrating = (syncState.hashVersion || 0) < HASH_VERSION;
    const conflicts = [];

    // A manifest entry proves a row unchanged only while its stored hash is
    // trustworthy — during a hash-version migration the hash is old-algo, but
    // the delta compare is on updated_at, which stays valid either way.
    const songPrevByRemoteId = new Map(Object.entries(prevManifest).map(([id, e]) => [e.remoteId, { itemId: id, entry: e }]));
    const slPrevByRemoteId = new Map(Object.entries(prevSlManifest).map(([id, e]) => [e.remoteId, { itemId: id, entry: e }]));
    const localSongIds = new Set(songs.map(s => s.id));
    const localSlIds = new Set(setlists.map(sl => sl.id));

    const [songDelta, setlistDelta] = await Promise.all([
      fetchRowsDelta('team_songs', songPrevByRemoteId, localSongIds, migrating),
      fetchRowsDelta('team_setlists', slPrevByRemoteId, localSlIds, migrating),
    ]);
    const rowIdToSongId = new Map(Object.entries(prevManifest).map(([id, e]) => [e.remoteId, id]));
    const rowIdToSetlistId = new Map(Object.entries(prevSlManifest).map(([id, e]) => [e.remoteId, id]));
    const songIndex = indexSongRows(songDelta.contentRows, rowIdToSongId, songDelta.unchanged);
    const setlistIndex = indexSetlistRows(setlistDelta.contentRows, rowIdToSetlistId, setlistDelta.unchanged);

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
      // During a hash-algorithm migration the stored hash was computed by the
      // old algorithm, so a hash mismatch is meaningless — fall back to the
      // server edit time to decide whether the row really changed.
      const remoteChanged = !prevEntry || (migrating
        ? prevEntry.lastSyncedTime !== entry.updatedAt
        : prevEntry.lastSyncedHash !== entry.hash);

      if ((local && !remoteChanged) || (local && !entry.parsed)) {
        // Server unchanged since last sync — keep the local copy (it may carry
        // edits awaiting push). The second clause is a guard for a delta-pull
        // entry that skipped the content fetch: without parsed content there
        // is nothing to adopt, so keep local and let the next pass heal.
        nextSongs.push(local);
        manifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt };
      } else if (!entry.parsed) {
        // No local copy and no fetched content — record the baseline only.
        manifest[itemId] = { remoteId: entry.rowId, lastSyncedHash: entry.hash, lastSyncedTime: entry.updatedAt };
      } else {
        // Server wins. Stamp the song with the SERVER's edit time, not
        // Date.now(). Pulling an unchanged-by-us song must not make it look
        // freshly edited (which polluted "Recently edited" and the team
        // activity feed).
        const serverTs = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now();
        const mergedRemote = local
          ? mergeRemoteSong(local, entry.parsed, serverTs)
          : { ...songFromFlat({ ...entry.parsed, id: itemId }), updatedAt: serverTs };
        // If the local copy had diverged too, surface a conflict carrying both
        // versions so the user can choose (server copy is adopted meanwhile).
        // Skipped while migrating: the old-algorithm hash can't be compared to a
        // canonical one, so it would false-positive on every row.
        // Members are a pure mirror — the server always wins, never a conflict
        // prompt. Conflicts are only meaningful for writers (admins/editors).
        if (!readOnly && !migrating && local && remoteChanged && prevEntry?.lastSyncedHash != null) {
          const localHash = canonicalSongHash(songToMd(local));
          if (localHash !== prevEntry.lastSyncedHash) {
            conflicts.push({ kind: 'song', id: itemId, title: local.title, local, remote: mergedRemote });
          }
        }
        nextSongs.push(mergedRemote);
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
      const remoteChanged = !prevEntry || (migrating
        ? prevEntry.lastSyncedTime !== entry.updatedAt
        : prevEntry.lastSyncedHash !== entry.hash);

      if ((local && !remoteChanged) || (local && !entry.content)) {
        nextSetlists.push(local);
      } else if (!entry.content) {
        // No local copy and no fetched content — record the baseline only.
      } else {
        const remoteSl = { ...entry.content, id: itemId };
        if (!readOnly && !migrating && local && remoteChanged && prevEntry?.lastSyncedHash != null) {
          if (setlistHash(local) !== prevEntry.lastSyncedHash) {
            conflicts.push({ kind: 'setlist', id: itemId, title: local.name, local, remote: remoteSl });
          }
        }
        nextSetlists.push(remoteSl);
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

  // The identity-key columns (song_key/setlist_key, 20260702_identity_keys)
  // may not exist yet on a not-yet-migrated project. PostgREST reports a write
  // naming an unknown column as "Could not find the '<col>' column …"; detect
  // it and retry the write without the key so older databases keep syncing
  // (a server-side stamp trigger backfills the key from content anyway).
  const isMissingKeyColumn = (message) =>
    /could not find.*(song_key|setlist_key|content_hash)|((song_key|setlist_key|content_hash).*(does not exist|schema cache))/i.test(message || '');

  // CAS update: matches 0 rows when another member wrote since our pull
  // (returns null) — the caller records a conflict instead of overwriting.
  async function casUpdate(table, payload, entry) {
    const run = (p) => client
      .from(table)
      .update(p)
      .eq('id', entry.remoteId)
      .eq('team_id', teamId)
      .eq('updated_at', entry.lastSyncedTime)
      .select('id, updated_at')
      .maybeSingle();
    let res = await run(payload);
    if (res.error && isMissingKeyColumn(res.error.message)) {
      const stripped = { ...payload };
      delete stripped.song_key;
      delete stripped.setlist_key;
      delete stripped.content_hash;
      res = await run(stripped);
    }
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  // Insert a new row; on an identity collision ADOPT the existing row (update
  // it and bind our local id to it) instead of failing or duplicating. The
  // collision means a row for this song/setlist already exists — a push from
  // another device racing ours, or a row our manifest lost track of. Falls
  // back to a title/name lookup on pre-migration servers (no key column).
  async function insertWithAdopt(table, keyCol, legacyCol, payload) {
    let withKey = payload;
    let ins = await client.from(table).insert(withKey).select('id, updated_at').single();
    if (ins.error && isMissingKeyColumn(ins.error.message)) {
      withKey = { ...payload };
      delete withKey[keyCol];
      delete withKey.content_hash;
      ins = await client.from(table).insert(withKey).select('id, updated_at').single();
    }
    if (!ins.error) return ins.data;
    if (!/duplicate key|unique/i.test(ins.error.message || '')) throw new Error(ins.error.message);
    let found = await client
      .from(table).select('id, updated_at')
      .eq('team_id', teamId).eq(keyCol, payload[keyCol])
      .limit(1).maybeSingle();
    if (found.error || !found.data) {
      found = await client
        .from(table).select('id, updated_at')
        .eq('team_id', teamId).eq(legacyCol, payload[legacyCol])
        .limit(1).maybeSingle();
    }
    if (!found.data) throw new Error(ins.error.message);
    const upd = await client
      .from(table).update(withKey)
      .eq('id', found.data.id).eq('team_id', teamId)
      .select('id, updated_at').maybeSingle();
    if (upd.error) throw new Error(upd.error.message);
    if (!upd.data) throw new Error(ins.error.message);
    return upd.data;
  }

  // Bulk-insert a chunk of never-synced songs (first sync, import): one round
  // trip instead of one per song. Returned rows are matched back through
  // song_key. Any failure (duplicate in the chunk, pre-migration server)
  // returns null and the caller falls back to the per-row path, which heals.
  const INSERT_BATCH = 50;
  async function insertSongsBatch(items) {
    const now = new Date().toISOString();
    const payloads = items.map(({ song, md, hash }) => ({
      team_id: teamId,
      title: song.title || 'Untitled',
      content: md,
      content_hash: hash,
      song_key: song.id,
      updated_at: now,
    }));
    try {
      const res = await client.from('team_songs').insert(payloads).select('id, song_key, updated_at');
      if (res.error || !Array.isArray(res.data)) return null;
      return new Map(res.data.map(r => [r.song_key, r]));
    } catch {
      return null;
    }
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

    // CIRCUIT BREAKER (updates): refuse to REWRITE a large share of the
    // library's existing rows in a single sync. A serialization regression
    // (e.g. the _songId round-trip bug) can make every song's hash differ from
    // the manifest at once, so the engine "helpfully" re-uploads the entire
    // library — churn that drift song ids, spams the activity feed, and wakes
    // realtime in a loop. New songs (no remoteId) are exempt: a first upload /
    // import legitimately writes many rows. If too many EXISTING rows look
    // dirty at once, that is not a human editing — halt, keep the server copies,
    // and surface an error so a person investigates.
    const pendingUpdates = songs.filter(song => {
      const entry = nextManifest[song.id];
      return entry?.remoteId && entry.lastSyncedHash !== hashSong(song).hash;
    });
    const syncedSongCount = Object.values(nextManifest).filter(e => e.remoteId).length;
    const massUpdate = pendingUpdates.length >= 8 && pendingUpdates.length > syncedSongCount * 0.5;
    if (massUpdate) {
      return {
        manifest,
        slManifest,
        uploaded,
        conflicts,
        errors: [{
          kind: 'song',
          message: `Safety guard: refused to re-upload ${pendingUpdates.length} of ${syncedSongCount} songs in one sync. This usually means a sync glitch, not real edits — nothing was changed on the server. Reload the app; if it repeats, report it.`,
        }],
      };
    }

    // Updates go per-row (each needs its own CAS guard); inserts are gathered
    // and written in bulk below.
    const pendingInserts = [];
    for (const song of songs) {
      try {
        const { md, hash } = hashSong(song);
        const entry = nextManifest[song.id];
        if (entry && entry.lastSyncedHash === hash) continue;
        if (ampGuard.shouldBlock(song.id)) {
          errors.push({ kind: 'song', id: song.id, title: song.title, message: 'Sync paused for this song: it was pushed too many times in a short window (possible sync loop). It will retry later.' });
          continue;
        }

        if (entry?.remoteId) {
          const payload = { team_id: teamId, title: song.title || 'Untitled', content: md, content_hash: hash, song_key: song.id, updated_at: new Date().toISOString() };
          const data = await casUpdate('team_songs', payload, entry);
          if (!data) {
            // CAS miss — the row changed (or vanished) since our pull.
            const remote = await fetchConflictSong(client, teamId, entry.remoteId, song.id);
            conflicts.push({ kind: 'song', id: song.id, title: song.title, local: song, remote });
            continue;
          }
          nextManifest[song.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
          uploaded.songs += 1;
        } else {
          pendingInserts.push({ song, md, hash });
        }
      } catch (err) {
        errors.push({ kind: 'song', id: song.id, title: song.title, message: err?.message || String(err) });
      }
    }

    for (let i = 0; i < pendingInserts.length; i += INSERT_BATCH) {
      const chunk = pendingInserts.slice(i, i + INSERT_BATCH);
      const batched = chunk.length > 1 ? await insertSongsBatch(chunk) : null;
      for (const item of chunk) {
        try {
          let data = batched?.get(item.song.id);
          if (!data) {
            const payload = { team_id: teamId, title: item.song.title || 'Untitled', content: item.md, content_hash: item.hash, song_key: item.song.id, updated_at: new Date().toISOString() };
            data = await insertWithAdopt('team_songs', 'song_key', 'title', payload);
          }
          nextManifest[item.song.id] = { remoteId: data.id, lastSyncedHash: item.hash, lastSyncedTime: data.updated_at };
          uploaded.songs += 1;
        } catch (err) {
          errors.push({ kind: 'song', id: item.song.id, title: item.song.title, message: err?.message || String(err) });
        }
      }
    }

    // Locally-deleted songs: pull() marked their manifest entries `deleted`.
    // CIRCUIT BREAKER: refuse to delete a large share of the library in a
    // single sync. A desync/identity-churn can mark dozens of songs "deleted"
    // at once (this wiped a church library once); a real user deleting that
    // many in one tick is implausible. Block the destructive batch, keep the
    // rows, and surface an error so a human investigates instead of silently
    // wiping every member's copy.
    const songDeletes = Object.entries(nextManifest).filter(([, e]) => e.deleted);
    const syncedSongs = Object.keys(nextManifest).length;
    const massDelete = songDeletes.length >= 8 && songDeletes.length > syncedSongs * 0.5;
    if (massDelete) {
      errors.push({
        kind: 'song',
        message: `Safety guard: refused to delete ${songDeletes.length} of ${syncedSongs} songs in one sync. No songs were removed — if this was intentional, delete them in smaller batches.`,
      });
    } else {
      for (const [id, entry] of songDeletes) {
        try {
          const { error } = await client.from('team_songs').delete().eq('id', entry.remoteId).eq('team_id', teamId);
          if (error) throw new Error(error.message);
          delete nextManifest[id];
        } catch (err) {
          errors.push({ kind: 'song', id, message: err?.message || String(err) });
        }
      }
    }

    const nextSlManifest = { ...slManifest };
    for (const sl of setlists) {
      try {
        const hash = hashSetlist(sl);
        const entry = nextSlManifest[sl.id];
        if (entry && entry.lastSyncedHash === hash) continue;
        if (ampGuard.shouldBlock(sl.id)) {
          errors.push({ kind: 'setlist', id: sl.id, title: sl.name, message: 'Sync paused for this setlist: it was pushed too many times in a short window (possible sync loop). It will retry later.' });
          continue;
        }

        const payload = { team_id: teamId, name: sl.name || 'Untitled Setlist', content: sl, content_hash: hash, setlist_key: sl.id, updated_at: new Date().toISOString() };
        if (entry?.remoteId) {
          const data = await casUpdate('team_setlists', payload, entry);
          if (!data) {
            const remote = await fetchConflictSetlist(client, teamId, entry.remoteId, sl.id);
            conflicts.push({ kind: 'setlist', id: sl.id, title: sl.name, local: sl, remote });
            continue;
          }
          nextSlManifest[sl.id] = { remoteId: data.id, lastSyncedHash: hash, lastSyncedTime: data.updated_at };
        } else {
          const data = await insertWithAdopt('team_setlists', 'setlist_key', 'name', payload);
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
        // Serialize with any other sync pass over this library (another tab,
        // a temp engine) — the manifests are read-modify-write.
        return await withSyncLock(libraryId, async () => {
          const result = await runFullSync(songs, setlists, tombstones);
          if ((result.uploaded?.songs || 0) + (result.uploaded?.setlists || 0) > 0) lastPushAt = Date.now();
          await setPendingPush(false, libraryId);
          await setHashVersion(HASH_VERSION, libraryId);
          setStatus('synced', { lastSync: new Date().toISOString(), provider: `supabase-team:${teamId}` });
          return result;
        });
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
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runPush(songs, setlists, tombstones, onTombstonesPruned);
      }, SYNC_DEBOUNCE_MS);
    },

    // Run a pending debounced push immediately (tab hide/close), so an edit made
    // inside the 2s debounce window still reaches the server.
    flushPending(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (readOnly || !client || !debounceTimer) return;
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

    // True if we wrote rows very recently — lets the realtime listener ignore
    // the echo of our own writes instead of re-syncing for nothing.
    recentlyPushed(windowMs = 4000) {
      return Date.now() - lastPushAt < windowMs;
    },
  };

  // Shared push-now used by the debounce timer and flushPending. Sets the
  // pending-push flag before writing so an interrupted/failed push is retried
  // on next launch, and clears it once the push confirms.
  async function runPush(songs, setlists, tombstones, onTombstonesPruned) {
    if (syncing) return; // a full sync is already in flight
    syncing = true;
    try {
      await withSyncLock(libraryId, async () => {
        await setPendingPush(true, libraryId);
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
        await setPendingPush(false, libraryId);
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
      });
    } catch (err) {
      console.error('[team-sync] Push error:', err);
      setStatus('error');
    } finally {
      syncing = false;
    }
  }
}
