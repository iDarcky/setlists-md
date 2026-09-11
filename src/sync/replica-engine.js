// The replica engine — a device as a mirror of the team library, plus, for
// writers, an OUTBOX of its own edits.
//
// docs/SYNC-REDESIGN.md, step 3. The server is the only truth. Every device
// holds a cache of the server's library at feed position `since`, and asks
// `sync_changes(team, since)` for what changed after that — songs, setlists and
// DELETIONS, in order. A writer additionally keeps a DIRTY SET: the keys whose
// local object differs from the copy the server gave it, each with the
// serialized server copy it was based on. Those, and nothing else, go to
// `apply_ops` with the version they were based on; the server accepts, or
// returns its copy for a three-way merge (`./merge`). No hashing of the
// library, no manifest, no baseline reconstruction, no inferring a delete
// from a row that went missing.
//
// Change detection is OBJECT IDENTITY, the signal this codebase already relies
// on (saveSongs, adopt.js, the hash caches): App replaces only the object it
// edited. `known[kind].get(key)` is the object the server last gave us (or we
// last pushed); a different reference for the same key is a local edit. Across
// a reload identity is gone, so the dirty set is persisted — a reload pushes
// exactly the edits that had not reached the server, and the base each merge
// needs travels with it.
//
// Persisted (`sync:<teamId>`.replica):
//   { since, writer,
//     rows:  { song: { [key]: { version, seq, rowId, fmt } }, setlist: {…} },
//     dirty: { song: { [key]: <base: doc json | md | null> }, setlist: { [key]: <base json | null> } } }
// `rows` is the server set as this device knows it; a local item neither in
// `rows` nor dirty is not on the server and is dropped (App's trash keeps it
// 30 days). `rowId` is what `team_schedules.setlist_id` points at.
//
// THE WIRE IS JSON (step 5, `./songDoc`): a song row carries `doc` — the whole
// v2 object, every arrangement — beside the markdown `content` older builds
// still read and this build still writes. A row without a `doc` was written
// by such a build (or before step 5): it is read from its markdown, and a
// writer that holds it marks it for one "upgrade" push (`fmt: 'md'` →
// 'doc') that gives the server the full document without changing the
// markdown. The base of a dirty entry is whichever form the server had —
// `fromBase` tells them apart.
//
// First run of a writer (no replica state yet): the old manifest engine's
// baseline hashes decide, once, which local items carry unpushed edits — the
// same arithmetic that engine ran on every pass, run a last time so nothing
// pending is lost and nothing stale is uploaded. After that the manifest is
// never read again.
//
// A delta feed trusts the rows it already holds: the server does not re-send
// what it has not changed. The dirty set is what makes that safe for writers;
// for members (read-only), a local mutation — which the UI forbids — lingers
// until that row next changes on the server, and then the server copy wins.
//
// Same interface as the file engine and the same `replaced: true` result, so
// App's adoption path is untouched. If the RPCs are missing (a project without
// the migration) the engine says so, sets status `error`, and leaves local data
// untouched — there is no other engine any more.

import { supabase as defaultClient } from '@/auth/supabase';
import { getSyncState, updateReplicaState } from './tokens';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { mergeRemoteSong } from './mergeRemote';
import { songDoc, docString, songFromDoc, isSongDoc } from './songDoc';
import { threeWayMergeSong, threeWayMergeSetlist } from './merge';
import { canonicalSongHash, canonicalSetlistHash, stableStringify } from './canonical';
import { withRetry } from './retry';
import { withSyncLock } from './lock';
import { SYNC_DEBOUNCE_MS } from './constants';

export const REPLICA_PAGE = 500;
export const APPLY_BATCH = 100;
export const MIGRATION_MISSING = 'This workspace\'s database has not had the sync migration applied (20260910_sync_versions). Nothing was changed on this device.';
const KINDS = ['song', 'setlist'];

// PostgREST reports an unknown RPC as PGRST202 ("Could not find the function
// …"); Postgres itself as 42883 when the call gets that far.
export function isMissingRpc(error) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /could not find the function|function .* does not exist/i.test(error.message || '');
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
const emptyRows = () => ({ song: {}, setlist: {} });
const emptyDirty = () => ({ song: {}, setlist: {} });
const emptyKnown = () => ({ song: new Map(), setlist: new Map() });

function normalizeReplica(raw) {
  if (!raw?.rows?.song || !raw?.rows?.setlist) return null;
  return {
    since: Number(raw.since) || 0,
    rows: { song: { ...raw.rows.song }, setlist: { ...raw.rows.setlist } },
    dirty: { song: { ...(raw.dirty?.song || {}) }, setlist: { ...(raw.dirty?.setlist || {}) } },
  };
}

// ── Serialized forms (JSON documents for both kinds; markdown is legacy) ─────
function serialize(kind, obj) {
  try {
    return kind === 'song' ? docString(obj) : stableStringify(obj);
  } catch {
    return null;
  }
}
const hasDoc = (row) => isSongDoc(row?.doc);
const rowTs = (row) => (row?.updated_at ? new Date(row.updated_at).getTime() : Date.now());
// The server's copy as an object: the document when the row has one, else
// the markdown — the one arrangement it carries replaces the matching local
// one and any other local arrangement survives (`mergeRemote`), because a
// markdown row cannot say whether those exist on the server.
function remoteSong(key, row, local) {
  const ts = rowTs(row);
  if (hasDoc(row)) {
    const song = songFromDoc(row.doc, key, ts, local || null);
    if (song) return song;
  }
  let parsed;
  try { parsed = parseSongMd(row?.content); } catch { return null; }
  return mergeRemoteSong(local || null, { ...parsed, id: key }, ts);
}
function remoteSetlist(key, row) {
  const content = typeof row?.content === 'string' ? safeParse(row.content) : row?.content;
  if (!content || typeof content !== 'object') return null;
  return { ...content, id: key };
}
function fromBase(kind, key, base) {
  if (base == null) return null;
  try {
    if (kind === 'song') {
      // A JSON document (this build), or markdown (a base persisted by the
      // build before step 5, or a row the server only had as markdown).
      const trimmed = typeof base === 'string' ? base.trimStart() : '';
      if (trimmed.startsWith('{')) return songFromDoc(safeParse(base), key, 1) || null;
      return songFromFlat({ ...parseSongMd(base), id: key });
    }
    const obj = typeof base === 'string' ? safeParse(base) : base;
    return obj && typeof obj === 'object' ? { ...obj, id: key } : null;
  } catch {
    return null;
  }
}
// Same bytes as the server row: the document when it has one, else the
// markdown. Keeping identity for an unchanged song is what stops a pull from
// rewriting the whole library to IndexedDB.
function sameBytes(kind, local, row) {
  if (!local) return false;
  if (kind === 'setlist') return serialize('setlist', local) === stableStringify(row?.content);
  if (hasDoc(row)) return docString(local) === stableStringify(row.doc);
  try { return songToMd(local) === row?.content; } catch { return false; }
}
// A markdown-only row a WRITER holds is marked for one upgrade push: the
// document, with the markdown as base. Only the wire form changes; an old
// build reading the row sees the same markdown.
function markUpgrade(ctx, kind, key, row) {
  if (ctx.readOnly || kind !== 'song' || hasDoc(row) || typeof row?.content !== 'string') return;
  if (key in ctx.dirty.song) return;
  ctx.dirty.song[key] = row.content;
}
const stampOf = (kind, row, seq, prev) => ({
  version: row.version ?? null,
  seq,
  rowId: row.row_id ?? prev?.rowId ?? null,
  ...(kind === 'song' ? { fmt: hasDoc(row) ? 'doc' : 'md' } : null),
});
const titleOf = (kind, obj) => (kind === 'song' ? obj?.title : obj?.name);

// ── Reconcile one feed change into the maps ─────────────────────────────────
// ctx: { songsById, setlistsById, rows, dirty, known, conflicts, readOnly }.
// Feed order is seq order, so a put and a later deletion of the same key
// resolve as the server saw them.
export function reconcileChange(ch, ctx) {
  const key = ch?.key;
  if (!key) return;
  if (ch.kind === 'deletion') {
    const kind = ch.row?.kind === 'setlist' ? 'setlist' : 'song';
    const map = kind === 'song' ? ctx.songsById : ctx.setlistsById;
    if (!ctx.readOnly && key in ctx.dirty[kind] && map.has(key)) {
      // An edit beats a concurrent delete: ours stays, and becomes a create.
      delete ctx.rows[kind][key];
      ctx.dirty[kind][key] = null;
      ctx.known[kind].delete(key);
      return;
    }
    map.delete(key);
    delete ctx.rows[kind][key];
    ctx.known[kind].delete(key);
    return;
  }
  if (ch.kind !== 'song' && ch.kind !== 'setlist') return;
  const kind = ch.kind;
  const row = ch.row || {};
  const map = kind === 'song' ? ctx.songsById : ctx.setlistsById;
  const prev = ctx.rows[kind][key];
  const stamp = stampOf(kind, row, ch.seq, prev);
  const local = map.get(key);

  // A version we already hold — our own push echoing back, or a row an earlier
  // pass adopted. Nothing to re-parse, nothing to replace.
  if (local && prev && prev.version != null && prev.version === row.version) {
    ctx.rows[kind][key] = stamp;
    return;
  }

  const remote = kind === 'song' ? remoteSong(key, row, local) : remoteSetlist(key, row);
  if (!remote) {
    console.warn(`[replica] Skipping unreadable ${kind} ${key}`);
    return;
  }

  const isDirty = !ctx.readOnly && local && key in ctx.dirty[kind];
  if (isDirty) {
    if (!prev) {
      // First sight of this row while we hold an edit of it (a create that
      // collided, or a first-run pending edit): ours stays and pushes next.
      ctx.rows[kind][key] = stamp;
      return;
    }
    const base = fromBase(kind, key, ctx.dirty[kind][key]);
    if (base) {
      const { merged, conflictFields } = kind === 'song'
        ? threeWayMergeSong(base, local, remote)
        : threeWayMergeSetlist(base, local, remote);
      if (conflictFields.length === 0) {
        // Disjoint edits: adopt the merge, stay dirty on top of the server copy.
        map.set(key, merged);
        ctx.dirty[kind][key] = serialize(kind, remote);
        ctx.known[kind].set(key, remote);
        ctx.rows[kind][key] = stamp;
        return;
      }
    }
    // Both sides changed the same thing: the server copy is adopted (App's
    // contract — the cloud copy is already in state) and ours travels in the
    // conflict for the user to choose.
    ctx.conflicts.push({ kind, id: key, title: titleOf(kind, local), local, remote });
    map.set(key, remote);
    delete ctx.dirty[kind][key];
    ctx.known[kind].set(key, remote);
    ctx.rows[kind][key] = stamp;
    return;
  }

  // Clean: the server copy wins; keep identity when the bytes are equal so an
  // unchanged song is not rewritten to IndexedDB or reported as edited.
  const adopted = sameBytes(kind, local, row) ? local : remote;
  map.set(key, adopted);
  ctx.known[kind].set(key, adopted);
  ctx.rows[kind][key] = stamp;
  markUpgrade(ctx, kind, key, row);
}

// Back-compat for the member tests: a read-only fold of changes into maps.
export function applyChanges(changes, songsById, setlistsById, rows) {
  const ctx = { songsById, setlistsById, rows, dirty: emptyDirty(), known: emptyKnown(), conflicts: [], readOnly: true };
  for (const ch of changes || []) reconcileChange(ch, ctx);
}

function mdOf(song) {
  try { return songToMd(song); } catch { return null; }
}
// The server's song plus every local arrangement it lacks (by id). Used only
// where neither side has a base to say which of them added what.
function unionArrangements(remote, local) {
  const have = new Set((remote.arrangements || []).map(a => a.id));
  const extra = (local?.arrangements || []).filter(a => a?.id && !have.has(a.id));
  if (extra.length === 0) return remote;
  return { ...remote, arrangements: [...remote.arrangements, ...extra] };
}

// ── First run of a WRITER: hand over from the manifest engine ───────────────
// The feed from 0 is the whole server set. The old engine's baseline hashes say,
// per local item, whether this device carried an unpushed edit: local ≠ baseline
// while server = baseline means only we moved (push it); both moved is a
// conflict (server adopted, ours in the conflict); local = baseline or
// canonical-equal means nothing to push. Never-manifested local items are
// creates; manifested items the server no longer has were deleted elsewhere
// (dropped) unless edited here (kept, as a create — an edit beats a delete).
function freshWriterReconcile(changes, ctx, state, seeds = null) {
  const server = { song: new Map(), setlist: new Map() };
  // Keys the feed says were deleted and not re-created since.
  const deleted = { song: new Set(), setlist: new Set() };
  for (const ch of changes) {
    if (!ch?.key) continue;
    if (ch.kind === 'deletion') {
      const kind = ch.row?.kind === 'setlist' ? 'setlist' : 'song';
      server[kind].delete(ch.key);
      deleted[kind].add(ch.key);
    } else if (ch.kind === 'song' || ch.kind === 'setlist') {
      server[ch.kind].set(ch.key, ch);
      deleted[ch.kind].delete(ch.key);
    }
  }
  const manifests = { song: state?.syncManifest || {}, setlist: state?.setlistManifest || {} };
  const hashOf = (kind, ser) => (kind === 'song' ? canonicalSongHash(ser) : canonicalSetlistHash(ser));
  // A seeded song's baseline is its seed — as this build renders it, so the
  // hash matches what the seeded object hashes to. It counts as "synced once"
  // only where the feed proves the account had it (a row, or a deletion of
  // it); a seed the account never saw is a create like any other new song.
  // Unlike a manifest baseline the seed is a whole object, so "both moved"
  // can merge three-way instead of asking.
  const seedCache = new Map();
  const seedSong = (key) => {
    if (!seeds?.[key]) return null;
    if (!seedCache.has(key)) {
      try { seedCache.set(key, songFromFlat({ ...parseSongMd(seeds[key]), id: key })); } catch { seedCache.set(key, null); }
    }
    return seedCache.get(key);
  };
  const seedEntry = (kind, key) => {
    if (kind !== 'song') return null;
    const base = seedSong(key);
    const baseMd = base ? mdOf(base) : null;
    return baseMd == null ? null : { lastSyncedHash: hashOf('song', baseMd) };
  };

  for (const kind of KINDS) {
    const map = kind === 'song' ? ctx.songsById : ctx.setlistsById;
    const manifest = manifests[kind];
    for (const [key, ch] of server[kind]) {
      const row = ch.row || {};
      ctx.rows[kind][key] = stampOf(kind, row, ch.seq, null);
      const local = map.get(key);
      const remote = kind === 'song' ? remoteSong(key, row, local) : remoteSetlist(key, row);
      if (!remote) continue;
      if (!local) {
        map.set(key, remote);
        ctx.known[kind].set(key, remote);
        markUpgrade(ctx, kind, key, row);
        continue;
      }
      const docRow = kind === 'song' && hasDoc(row);
      const localSer = kind === 'song' ? (docRow ? docString(local) : mdOf(local)) : serialize('setlist', local);
      const serverSer = kind === 'song' ? (docRow ? stableStringify(row.doc) : row.content) : stableStringify(row.content);
      if (localSer != null && localSer === serverSer) {
        ctx.known[kind].set(key, local);
        markUpgrade(ctx, kind, key, row);
        continue;
      }
      const entry = manifest[key] || seedEntry(kind, key);
      // The manifest's baselines are markdown hashes, so the arithmetic below
      // is on the markdown for both kinds of row.
      const localMd = kind === 'song' ? mdOf(local) : null;
      const localHash = kind === 'song' ? (localMd == null ? null : hashOf(kind, localMd)) : hashOf(kind, local);
      const serverHash = hashOf(kind, row.content);
      if (localHash != null && localHash === serverHash) {
        if (docRow) {
          // Same markdown, different documents: what the markdown cannot carry
          // differs. Neither side has a base, so keep both — the server's copy
          // plus any arrangement only this device has — and push the union.
          const union = unionArrangements(remote, local);
          map.set(key, union);
          ctx.known[kind].set(key, remote);
          if (union !== remote) ctx.dirty[kind][key] = serverSer;
          continue;
        }
        // Same song, different bytes (another build's serialization): nothing to push.
        ctx.known[kind].set(key, local);
        markUpgrade(ctx, kind, key, row);
        continue;
      }
      if (entry?.lastSyncedHash != null && localHash === entry.lastSyncedHash) {
        // Only the server moved since this device last synced.
        map.set(key, remote);
        ctx.known[kind].set(key, remote);
        markUpgrade(ctx, kind, key, row);
        continue;
      }
      if (entry?.lastSyncedHash != null && serverHash === entry.lastSyncedHash) {
        // Only we moved: a pending edit, based on the server copy.
        ctx.dirty[kind][key] = serverSer;
        continue;
      }
      // Both moved (or no baseline to tell). A seed is a whole baseline, so
      // try the three-way merge first: disjoint edits land without a prompt.
      const seedBase = kind === 'song' ? seedSong(key) : null;
      if (seedBase) {
        const { merged, conflictFields } = threeWayMergeSong(seedBase, local, remote);
        if (conflictFields.length === 0) {
          map.set(key, merged);
          ctx.dirty[kind][key] = serverSer;
          ctx.known[kind].set(key, remote);
          continue;
        }
      }
      // The server copy is adopted, ours travels in the conflict.
      ctx.conflicts.push({ kind, id: key, title: titleOf(kind, local), local, remote });
      map.set(key, remote);
      ctx.known[kind].set(key, remote);
    }
    for (const [key, local] of map) {
      if (server[kind].has(key)) continue;
      const entry = manifest[key] || (deleted[kind].has(key) ? seedEntry(kind, key) : null);
      if (!entry) {
        ctx.dirty[kind][key] = null; // never synced: a create
        continue;
      }
      const localMd = kind === 'song' ? mdOf(local) : null;
      const localHash = kind === 'song' ? (localMd == null ? null : hashOf(kind, localMd)) : hashOf(kind, local);
      if (localHash != null && localHash !== entry.lastSyncedHash) {
        ctx.dirty[kind][key] = null; // edited here, deleted elsewhere: the edit wins
      } else {
        map.delete(key); // deleted elsewhere, untouched here
      }
    }
  }
}

export function createReplicaEngine(onStatusChange, teamId, {
  readOnly = false,
  client = defaultClient,
  pageSize = REPLICA_PAGE,
  onPullNeeded,
  // Where this engine keeps its replica + lock. A team library is keyed by
  // its team id; the personal library keeps its 'personal' key (the same
  // slot the file engine uses — the two never run together).
  libraryId = teamId,
  providerId = `supabase-team:${teamId}`,
  // A writer's first run may read the old file-manifest to tell "synced
  // once, deleted elsewhere" from "never synced". Only true for team
  // libraries: the personal library's manifest belongs to a cloud FOLDER,
  // so treating it as this server's history would drop every song the
  // folder had synced and the server has not seen yet.
  handoverFromManifest = true,
  // `{ [songId]: md }` — songs this device may have SEEDED rather than synced
  // (the demo songs). On a first run the seed is the song's baseline: an
  // unedited seed adopts the account's copy without a prompt, an edited one
  // merges three-way, and a seed the account deleted stays deleted.
  seedBaselines = null,
} = {}) {
  let syncing = false;
  let debounceTimer = null;
  let lastPushAt = 0;
  const setStatus = (state, extra = {}) => onStatusChange?.({ state, ...extra });

  // In-memory replica state. `initialized` = a persisted replica exists (a
  // full pull has happened and been adopted); `seeded` = `known` reflects the
  // local objects of this session.
  const mem = { initialized: false, seeded: false, since: 0, rows: emptyRows(), dirty: emptyDirty(), known: emptyKnown() };
  let latest = null; // the last arrays App handed to debouncedPush

  const rpcError = (error, what) => {
    const err = new Error(error?.message || `${what} failed`);
    err.code = isMissingRpc(error) ? 'replica_unavailable' : (error?.code || 'rpc_error');
    return err;
  };

  async function rpc(name, args) {
    // The RPC builder resolves with { data, error } for PostgREST errors and
    // rejects on transport failures — only the latter are retried.
    const { data, error } = await withRetry(() => client.rpc(name, args));
    if (error) throw rpcError(error, name);
    return typeof data === 'string' ? safeParse(data) : data;
  }

  async function fetchAll(since) {
    const changes = [];
    let cursor = since;
    for (;;) {
      const page = await rpc('sync_changes', { p_team_id: teamId, p_since: cursor, p_limit: pageSize });
      const batch = Array.isArray(page?.changes) ? page.changes : [];
      changes.push(...batch);
      const next = Number(page?.next_seq ?? cursor) || 0;
      if (next > cursor) cursor = next;
      if (!page?.more || batch.length === 0) break;
    }
    return { changes, nextSeq: cursor };
  }

  // Read the persisted replica (inside the lock — another tab may have moved
  // it). In-memory dirty marks win: they are edits this tab saw happen.
  async function loadPersisted() {
    const state = await getSyncState(libraryId);
    const p = normalizeReplica(state.replica);
    if (p) {
      mem.initialized = true;
      mem.since = p.since;
      mem.rows = p.rows;
      for (const kind of KINDS) {
        for (const [k, base] of Object.entries(p.dirty[kind])) {
          if (!(k in mem.dirty[kind])) mem.dirty[kind][k] = base;
        }
      }
    } else {
      mem.initialized = false;
    }
    return state;
  }

  async function persist() {
    await updateReplicaState({ since: mem.since, rows: mem.rows, dirty: mem.dirty, writer: !readOnly }, libraryId);
  }

  // `known` ← the local objects, for keys that are not dirty. After this,
  // "a different reference" means "edited here".
  // A writer also marks every song row the server holds as markdown only
  // (`fmt` 'md', or unknown — persisted before step 5) for its one upgrade
  // push, with our own rendering of the markdown as the base: it is what the
  // server has, give or take serialization, and a base is only read when
  // someone else writes the row first.
  function seed(songs, setlists) {
    for (const s of songs) {
      if (!s?.id || s.id in mem.dirty.song) continue;
      mem.known.song.set(s.id, s);
      const row = mem.rows.song[s.id];
      if (!readOnly && row && row.fmt !== 'doc') {
        const md = mdOf(s);
        if (md != null) mem.dirty.song[s.id] = md;
      }
    }
    for (const sl of setlists) if (sl?.id && !(sl.id in mem.dirty.setlist)) mem.known.setlist.set(sl.id, sl);
    mem.seeded = true;
  }

  // Compare the arrays App holds against what the server gave us. Returns true
  // when something new became dirty.
  function markDirty(songs, setlists) {
    if (readOnly) return false;
    let changed = false;
    const lists = { song: songs || [], setlist: setlists || [] };
    for (const kind of KINDS) {
      for (const obj of lists[kind]) {
        const key = obj?.id;
        if (!key || key in mem.dirty[kind]) continue;
        if (!mem.seeded) {
          // Unseeded (a temp engine, or before the first pull): only a key the
          // server does not have is knowably ours — a create.
          if (mem.initialized && !(key in mem.rows[kind])) { mem.dirty[kind][key] = null; changed = true; }
          continue;
        }
        const known = mem.known[kind].get(key);
        if (known === obj) continue;
        mem.dirty[kind][key] = known ? serialize(kind, known) : null;
        changed = true;
      }
    }
    return changed;
  }

  function buildCtx(songs, setlists) {
    return {
      songsById: new Map((songs || []).filter(s => s?.id).map(s => [s.id, s])),
      setlistsById: new Map((setlists || []).filter(sl => sl?.id).map(sl => [sl.id, sl])),
      rows: mem.rows,
      dirty: mem.dirty,
      known: mem.known,
      conflicts: [],
      readOnly,
    };
  }

  function opFor(kind, obj) {
    if (kind === 'song') {
      // `doc` is the song; `content` is its markdown for the builds that still
      // read it (and for the activity feed's no-op guard, via content_hash).
      const md = songToMd(obj);
      return { kind, op: 'put', id: obj.id, title: obj.title || 'Untitled', content: md, content_hash: canonicalSongHash(md), doc: songDoc(obj) };
    }
    return { kind, op: 'put', id: obj.id, title: obj.name || 'Untitled Setlist', content: obj, content_hash: canonicalSetlistHash(obj) };
  }

  // Send the dirty set and the tombstones. Mutates rows/dirty/known as the
  // server confirms. Throws on transport/RPC failure (dirty stays for later).
  async function pushDirty(ctx, tombstones) {
    const out = { uploaded: { songs: 0, setlists: 0 }, pruned: { song: new Set(), setlist: new Set() }, conflicts: 0, needsPull: false };
    if (readOnly) return out;
    const ops = [];
    const objects = new Map();
    for (const kind of KINDS) {
      const map = kind === 'song' ? ctx.songsById : ctx.setlistsById;
      for (const key of Object.keys(mem.dirty[kind])) {
        const obj = map.get(key);
        if (!obj) { delete mem.dirty[kind][key]; continue; } // gone locally — a tombstone handles the server side
        const known = mem.known[kind].get(key);
        if (known && known !== obj && serialize(kind, known) === serialize(kind, obj)) {
          // A new object, same bytes (play counts, a re-link that changed nothing): not an edit.
          delete mem.dirty[kind][key];
          mem.known[kind].set(key, obj);
          continue;
        }
        const op = opFor(kind, obj);
        op.base_version = mem.rows[kind][key]?.version ?? null;
        ops.push(op);
        objects.set(`${kind}:${key}`, obj);
      }
    }
    const tomb = { song: tombstones?.songs || [], setlist: tombstones?.setlists || [] };
    for (const kind of KINDS) {
      for (const t of tomb[kind]) {
        const row = mem.rows[kind][t.id];
        if (row) ops.push({ kind, op: 'delete', id: t.id, base_version: row.version ?? null });
        else out.pruned[kind].add(t.id); // nothing on the server to delete
      }
    }
    for (let i = 0; i < ops.length; i += APPLY_BATCH) {
      const chunk = ops.slice(i, i + APPLY_BATCH);
      const res = await rpc('apply_ops', { p_team_id: teamId, p_ops: chunk });
      for (const a of res?.applied || []) {
        if (!KINDS.includes(a.kind)) continue;
        if (a.op === 'put') {
          mem.rows[a.kind][a.id] = { version: a.version ?? null, seq: a.seq ?? null, rowId: a.row_id ?? mem.rows[a.kind][a.id]?.rowId ?? null, ...(a.kind === 'song' ? { fmt: 'doc' } : null) };
          const obj = objects.get(`${a.kind}:${a.id}`);
          if (obj) mem.known[a.kind].set(a.id, obj);
          delete mem.dirty[a.kind][a.id];
          out.uploaded[a.kind === 'song' ? 'songs' : 'setlists'] += 1;
        } else {
          delete mem.rows[a.kind][a.id];
          mem.known[a.kind].delete(a.id);
          out.pruned[a.kind].add(a.id);
        }
      }
      for (const c of res?.conflicts || []) {
        if (!KINDS.includes(c.kind)) continue;
        out.conflicts += 1;
        out.needsPull = true;
        if (c.op === 'put') {
          // 'version'/'exists': someone else wrote — the pull merges or asks.
          // 'missing': the row is gone — ours becomes a create on the next push.
          if (c.reason === 'missing') delete mem.rows[c.kind][c.id];
        } else {
          // An edit landed after our delete: their edit wins, our tombstone goes.
          out.pruned[c.kind].add(c.id);
        }
      }
    }
    if (out.uploaded.songs + out.uploaded.setlists > 0) lastPushAt = Date.now();
    return out;
  }

  function keepTombstones(tombstones, pruned) {
    const songs = (tombstones?.songs || []).filter(t => !pruned.song.has(t.id));
    const setlists = (tombstones?.setlists || []).filter(t => !pruned.setlist.has(t.id));
    const changed = songs.length !== (tombstones?.songs || []).length || setlists.length !== (tombstones?.setlists || []).length;
    return { tombstones: { songs, setlists }, changed };
  }

  async function runFullSync(songs, setlists, tombstones) {
    const state = await loadPersisted();
    const fresh = !mem.initialized;
    if (!fresh && !mem.seeded) seed(songs, setlists);
    if (!fresh) markDirty(songs, setlists);

    const { changes, nextSeq } = await fetchAll(fresh ? 0 : mem.since);
    const ctx = buildCtx(songs, setlists);
    if (fresh) {
      mem.rows = ctx.rows = emptyRows();
      if (readOnly) {
        for (const ch of changes) reconcileChange(ch, ctx);
        // A mirror IS the server set.
        for (const kind of KINDS) {
          const map = kind === 'song' ? ctx.songsById : ctx.setlistsById;
          for (const key of [...map.keys()]) if (!ctx.rows[kind][key]) map.delete(key);
        }
      } else {
        freshWriterReconcile(changes, ctx, handoverFromManifest ? state : null, seedBaselines);
      }
      mem.seeded = true;
    } else {
      for (const ch of changes) reconcileChange(ch, ctx);
    }
    mem.since = Math.max(mem.since, nextSeq);
    mem.initialized = true;

    // What stays: everything the server has, plus our unpushed creates/edits.
    const nextSongs = [];
    for (const [id, s] of ctx.songsById) if (ctx.rows.song[id] || id in mem.dirty.song) nextSongs.push(s);
    const nextSetlists = [];
    for (const [id, sl] of ctx.setlistsById) if (ctx.rows.setlist[id] || id in mem.dirty.setlist) nextSetlists.push(sl);

    const errors = [];
    let push = { uploaded: { songs: 0, setlists: 0 }, pruned: { song: new Set(), setlist: new Set() }, conflicts: 0, needsPull: false };
    try {
      push = await pushDirty(ctx, tombstones);
    } catch (err) {
      if (err?.code === 'replica_unavailable') throw err;
      errors.push({ kind: 'engine', message: err?.message || String(err) });
    }
    await persist();
    const kept = keepTombstones(tombstones, push.pruned);
    return {
      songs: nextSongs,
      setlists: nextSetlists,
      tombstones: kept.tombstones,
      tombstonesChanged: kept.changed,
      conflicts: ctx.conflicts,
      uploaded: push.uploaded,
      errors,
      changed: true,
      replaced: true,
      replica: { since: mem.since, applied: changes.length, fresh, pushConflicts: push.conflicts },
    };
  }

  async function runPush(songs, setlists, tombstones, onTombstonesPruned) {
    if (syncing || readOnly || !client) return;
    syncing = true;
    try {
      await withSyncLock(libraryId, async () => {
        const state = await loadPersisted();
        let ctx;
        if (!mem.initialized) {
          // Never pulled here (a temp engine pushing a moved/copied song): pull
          // once into a scratch view to learn the server set, push only what
          // it lacks, and persist nothing — no adopted state exists to anchor a
          // cursor, and the first real pass will run the handover properly.
          const { changes } = await fetchAll(0);
          ctx = buildCtx(songs, setlists);
          mem.rows = ctx.rows = emptyRows();
          freshWriterReconcile(changes, ctx, handoverFromManifest ? state : null, seedBaselines);
          for (const kind of KINDS) {
            for (const key of Object.keys(mem.dirty[kind])) {
              if (mem.dirty[kind][key] != null) delete mem.dirty[kind][key]; // only creates are ours to push here
            }
          }
          const push = await pushDirty(ctx, tombstones);
          mem.rows = emptyRows(); mem.dirty = emptyDirty(); mem.known = emptyKnown(); mem.seeded = false;
          const kept = keepTombstones(tombstones, push.pruned);
          if (kept.changed) onTombstonesPruned?.(kept.tombstones);
          if (push.uploaded.songs + push.uploaded.setlists > 0) {
            setStatus('synced', { lastSync: new Date().toISOString(), provider: providerId });
          }
          return;
        }
        if (!mem.seeded) seed(songs, setlists);
        markDirty(songs, setlists);
        ctx = buildCtx(songs, setlists);
        const push = await pushDirty(ctx, tombstones);
        await persist();
        const kept = keepTombstones(tombstones, push.pruned);
        if (kept.changed) onTombstonesPruned?.(kept.tombstones);
        if (push.uploaded.songs + push.uploaded.setlists > 0 || kept.changed) {
          setStatus('synced', { lastSync: new Date().toISOString(), provider: providerId });
        }
        if (push.needsPull) onPullNeeded?.();
      });
    } catch (err) {
      if (err?.code === 'replica_unavailable') console.warn('[replica]', MIGRATION_MISSING);
      else console.error('[replica] Push error:', err);
      setStatus('error');
      // Keep the dirty marks for the next attempt — but never mint a replica
      // state for a device that has not completed a first pull.
      if (mem.initialized) await persist().catch(() => {});
    } finally {
      syncing = false;
    }
  }

  return {
    async fullSync(songs, setlists, tombstones = { songs: [], setlists: [] }) {
      if (syncing || !client) return { songs, setlists, tombstones, changed: false };
      syncing = true;
      setStatus('syncing');
      try {
        const result = await withSyncLock(libraryId, () => runFullSync(songs, setlists, tombstones));
        setStatus('synced', { lastSync: new Date().toISOString(), provider: providerId });
        return result;
      } catch (err) {
        const missing = err?.code === 'replica_unavailable';
        if (missing) console.warn('[replica]', MIGRATION_MISSING);
        else console.error('[replica] Sync error:', err);
        setStatus('error');
        return { songs, setlists, tombstones, conflicts: [], changed: false, errors: [{ kind: 'engine', message: missing ? MIGRATION_MISSING : (err?.message || String(err)) }] };
      } finally {
        syncing = false;
      }
    },

    // Record what changed now (so a reload cannot lose it), push after a pause.
    debouncedPush(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (readOnly || !client) return;
      latest = { songs, setlists, tombstones, onTombstonesPruned };
      if (markDirty(songs, setlists) && mem.initialized) persist().catch(() => {});
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const l = latest;
        runPush(l.songs, l.setlists, l.tombstones, l.onTombstonesPruned);
      }, SYNC_DEBOUNCE_MS);
    },

    // Run a pending push now (tab hide/close).
    flushPending(songs, setlists, tombstones = { songs: [], setlists: [] }, onTombstonesPruned) {
      if (readOnly || !client) return;
      if (!debounceTimer) return;
      clearTimeout(debounceTimer);
      debounceTimer = null;
      latest = { songs, setlists, tombstones, onTombstonesPruned };
      markDirty(songs, setlists);
      return runPush(songs, setlists, tombstones, onTombstonesPruned);
    },

    cancelDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    // True if we wrote rows very recently — lets the realtime listener ignore
    // the echo of our own writes.
    recentlyPushed(windowMs = 4000) {
      return Date.now() - lastPushAt < windowMs;
    },

    // Diagnostics.
    get isReadOnly() { return readOnly; },
  };
}
