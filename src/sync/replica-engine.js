// The replica engine — a member's device as a pure mirror of the team library.
//
// docs/SYNC-REDESIGN.md, step 3 (first half). Members cannot write, so their
// device never has anything the server does not. That collapses sync to one
// question — "what changed after the last thing I saw?" — and the server
// answers it directly: `sync_changes(team, since)` returns every song, setlist
// and DELETION with a feed position (`seq`) after the cursor, in order. No
// hashing, no manifests, no baselines, no inferring a delete from a row that
// went missing. The old manifest engine stays on for writers until the outbox
// lands (step 3, second half).
//
// Shape of the persisted state (`sync:<teamId>`.replica):
//   { since: <last seq applied>,
//     rows: { song: { [key]: { version, seq, rowId } },
//             setlist: { [key]: { version, seq, rowId } } } }
// `rows` is the complete server set as this device knows it — puts add to it,
// deletions remove from it — so "a local item the feed never named" is, by
// construction, not on the server and is dropped (App's trash safety net keeps
// it for 30 days). `rowId` is what `team_schedules.setlist_id` points at; the
// setlist map hook reads it from here instead of the manifest.
//
// A delta feed trusts the rows it already holds: the server does not re-send
// what it has not changed. So a local mutation of a member's copy — which the
// UI forbids, and which nothing here ever uploads — lingers until that row next
// changes on the server, and then the server copy wins outright. The manifest
// engine had the same property; it is the price of not re-downloading the
// library on every pull.
//
// Same interface as the other engines (fullSync / debouncedPush / flushPending /
// cancelDebounce / recentlyPushed) and the same `replaced: true` result, so
// App's adoption path is untouched. If the RPC is missing — a client running
// ahead of the migration, or a project without it — the engine falls back to
// the read-only manifest engine for the session instead of failing.

import { supabase as defaultClient } from '@/auth/supabase';
import { getSyncState, updateReplicaState } from './tokens';
import { parseSongMd } from '@/parser';
import { mergeRemoteSong } from './mergeRemote';
import { withRetry } from './retry';
import { withSyncLock } from './lock';
import { createTeamSyncEngine } from './team-engine';

export const REPLICA_PAGE = 500;

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

// Fold one page of feed changes into the maps. Ordered by seq, so a put and a
// later deletion of the same key resolve in feed order.
export function applyChanges(changes, songsById, setlistsById, rows) {
  for (const ch of changes || []) {
    const key = ch?.key;
    if (!key) continue;
    if (ch.kind === 'song') {
      let parsed;
      try {
        parsed = parseSongMd(ch.row?.content);
      } catch (err) {
        console.warn(`[replica] Skipping unparseable song ${key}:`, err);
        continue;
      }
      const serverTs = ch.row?.updated_at ? new Date(ch.row.updated_at).getTime() : Date.now();
      songsById.set(key, mergeRemoteSong(songsById.get(key) || null, { ...parsed, id: key }, serverTs));
      rows.song[key] = { version: ch.row?.version ?? null, seq: ch.seq, rowId: ch.row?.row_id ?? null };
    } else if (ch.kind === 'setlist') {
      const content = typeof ch.row?.content === 'string' ? safeParse(ch.row.content) : ch.row?.content;
      if (!content || typeof content !== 'object') {
        console.warn(`[replica] Skipping invalid setlist ${key}`);
        continue;
      }
      setlistsById.set(key, { ...content, id: key });
      rows.setlist[key] = { version: ch.row?.version ?? null, seq: ch.seq, rowId: ch.row?.row_id ?? null };
    } else if (ch.kind === 'deletion') {
      const kind = ch.row?.kind === 'setlist' ? 'setlist' : 'song';
      if (kind === 'song') songsById.delete(key);
      else setlistsById.delete(key);
      delete rows[kind][key];
    }
  }
}

export function createReplicaEngine(onStatusChange, teamId, { client = defaultClient, pageSize = REPLICA_PAGE, fallback } = {}) {
  let syncing = false;
  let fallbackEngine = null;
  const setStatus = (state, extra = {}) => onStatusChange?.({ state, ...extra });

  const getFallback = () => {
    if (!fallbackEngine) {
      fallbackEngine = fallback
        ? fallback()
        : createTeamSyncEngine(onStatusChange, teamId, { readOnly: true, client });
    }
    return fallbackEngine;
  };

  async function fetchPage(since) {
    // The RPC builder resolves with { data, error } for PostgREST errors and
    // rejects on transport failures — only the latter are retried.
    const { data, error } = await withRetry(() =>
      client.rpc('sync_changes', { p_team_id: teamId, p_since: since, p_limit: pageSize }));
    if (error) {
      const err = new Error(error.message || 'sync_changes failed');
      err.code = isMissingRpc(error) ? 'replica_unavailable' : (error.code || 'rpc_error');
      throw err;
    }
    const page = typeof data === 'string' ? safeParse(data) : data;
    return {
      changes: Array.isArray(page?.changes) ? page.changes : [],
      nextSeq: Number(page?.next_seq ?? since) || 0,
      more: !!page?.more,
    };
  }

  async function pull(songs, setlists) {
    const state = await getSyncState(teamId);
    const prev = state.replica;
    const fresh = !prev?.rows?.song || !prev?.rows?.setlist;
    let since = fresh ? 0 : Number(prev.since) || 0;
    const rows = fresh
      ? { song: {}, setlist: {} }
      : { song: { ...prev.rows.song }, setlist: { ...prev.rows.setlist } };
    const songsById = new Map(songs.map(s => [s.id, s]));
    const setlistsById = new Map(setlists.map(sl => [sl.id, sl]));
    let applied = 0;

    for (;;) {
      const page = await fetchPage(since);
      applyChanges(page.changes, songsById, setlistsById, rows);
      applied += page.changes.length;
      if (page.nextSeq > since) since = page.nextSeq;
      if (!page.more || page.changes.length === 0) break;
    }

    // The mirror IS the server set: a local item the feed never named is not on
    // the server. Order: local order first, newly pulled items after.
    const nextSongs = [];
    for (const [id, song] of songsById) if (rows.song[id]) nextSongs.push(song);
    const nextSetlists = [];
    for (const [id, sl] of setlistsById) if (rows.setlist[id]) nextSetlists.push(sl);

    return { songs: nextSongs, setlists: nextSetlists, replica: { since, rows }, applied, fresh };
  }

  return {
    async fullSync(songs, setlists, tombstones = { songs: [], setlists: [] }) {
      if (fallbackEngine) return fallbackEngine.fullSync(songs, setlists, tombstones);
      if (syncing || !client) return { songs, setlists, tombstones, changed: false };
      syncing = true;
      setStatus('syncing');
      try {
        return await withSyncLock(teamId, async () => {
          const r = await pull(songs, setlists);
          await updateReplicaState(r.replica, teamId);
          setStatus('synced', { lastSync: new Date().toISOString(), provider: `supabase-team:${teamId}` });
          return {
            songs: r.songs,
            setlists: r.setlists,
            tombstones,
            conflicts: [],
            uploaded: { songs: 0, setlists: 0 },
            errors: [],
            changed: true,
            replaced: true,
            replica: { since: r.replica.since, applied: r.applied, fresh: r.fresh },
          };
        });
      } catch (err) {
        if (err?.code === 'replica_unavailable') {
          console.warn('[replica] sync_changes is not available on this project — using the manifest engine (read-only).');
          syncing = false;
          return getFallback().fullSync(songs, setlists, tombstones);
        }
        console.error('[replica] Sync error:', err);
        setStatus('error');
        return { songs, setlists, tombstones, conflicts: [], changed: false, errors: [{ kind: 'engine', message: err?.message || String(err) }] };
      } finally {
        syncing = false;
      }
    },

    // A mirror never writes. These exist so App can call them unconditionally.
    debouncedPush() {},
    flushPending() {},
    cancelDebounce() {},
    recentlyPushed() { return false; },

    // Diagnostics.
    get isReplica() { return !fallbackEngine; },
  };
}
