// In-memory stand-in for the Supabase client, shaped to exactly the query
// surface the team sync engine uses. Shared by the engine unit tests and the
// two-device convergence suite.
//
// Emulated server behaviour:
//  * select chains: .eq / .gt / .in / .order / .limit, awaitable builder,
//    .maybeSingle(); an optional `db.__queries` array logs every executed
//    select ({ table, cols, filters }) so tests can assert what was fetched.
//  * insert: single or bulk (atomic — a duplicate anywhere aborts the whole
//    chunk), unique (team_id, song_key/setlist_key) index emulation, and the
//    server-side stamp trigger that derives a missing key from the content.
//  * write timestamps are STRICTLY MONOTONIC (a serializing server clock):
//    two writes can never share an updated_at, so CAS comparisons behave like
//    they do against a real Postgres.

import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { stableStringify } from '@/sync/canonical';

let rowSeq = 0;
let lastTs = 0;
// Emulates public.sync_seq + trg_sync_stamp (20260910_sync_versions): every
// insert, every real change and every deletion gets the next feed position.
let seqCounter = 0;
const nextSeq = () => ++seqCounter;
const tableKind = (table) => (table === 'team_songs' ? 'song' : table === 'team_setlists' ? 'setlist' : null);
function nextTs() {
  const now = Math.max(Date.now(), lastTs + 1);
  lastTs = now;
  return new Date(now).toISOString();
}

// public.apply_ops(team, ops) — the validated semantics of 20260910_sync_versions
// (+ row_id in applied puts, 20260910_apply_ops_row_id): put/delete per op,
// guarded by base_version; identical content on a stale base counts as applied;
// a real change bumps version + seq (trg_sync_stamp); a delete leaves a
// tombstone (trg_record_deletion). `db.__writerDenied` refuses like RLS would.
function applyOps(db, { p_team_id, p_ops }) {
  if (db.__writerDenied) return { data: null, error: { code: '42501', message: 'apply_ops: not a writer of this workspace' } };
  const applied = [];
  const conflicts = [];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  for (const op of p_ops || []) {
    const kind = op.kind;
    const table = kind === 'song' ? 'team_songs' : 'team_setlists';
    const keyCol = kind === 'song' ? 'song_key' : 'setlist_key';
    const nameCol = kind === 'song' ? 'title' : 'name';
    const rows = (db[table] ||= []);
    const idx = rows.findIndex(r => r.team_id === p_team_id && r[keyCol] === op.id);
    const r = idx >= 0 ? rows[idx] : null;
    const base = op.base_version ?? null;
    const serverOf = (row) => ({ row_id: row.id, version: row.version, seq: row.seq, content: clone(row.content), title: row[nameCol], updated_at: row.updated_at });
    const same = r && (kind === 'song' ? r.content === op.content : stableStringify(r.content) === stableStringify(op.content));
    const ack = (row) => ({ kind, id: op.id, op: 'put', row_id: row.id, version: row.version, seq: row.seq, updated_at: row.updated_at });
    if (op.op === 'delete') {
      if (!r) applied.push({ kind, id: op.id, op: 'delete', version: null });
      else if (base == null || r.version === base) {
        rows.splice(idx, 1);
        (db.team_deletions ||= []).push({ id: `row_${++rowSeq}`, team_id: r.team_id, kind, key: op.id, row_id: r.id, seq: nextSeq(), deleted_at: nextTs() });
        applied.push({ kind, id: op.id, op: 'delete', version: r.version });
      } else conflicts.push({ kind, id: op.id, op: 'delete', reason: 'version', server: serverOf(r) });
      continue;
    }
    if (!r) {
      if (base != null) { conflicts.push({ kind, id: op.id, op: 'put', reason: 'missing' }); continue; }
      const row = { id: `row_${++rowSeq}`, team_id: p_team_id, [keyCol]: op.id, [nameCol]: op.title, content: clone(op.content), content_hash: op.content_hash ?? null, updated_at: nextTs(), version: 1, seq: nextSeq(), updated_by: db.__uid ?? null };
      rows.push(row);
      applied.push(ack(row));
    } else if (base != null && r.version === base) {
      if (!same || r[nameCol] !== op.title) {
        r.content = clone(op.content); r[nameCol] = op.title; r.content_hash = op.content_hash ?? null;
        r.version += 1; r.seq = nextSeq(); r.updated_at = nextTs(); r.updated_by = db.__uid ?? null;
      }
      applied.push(ack(r));
    } else if (same) {
      applied.push(ack(r));
    } else {
      conflicts.push({ kind, id: op.id, op: 'put', reason: base == null ? 'exists' : 'version', server: serverOf(r) });
    }
  }
  return { data: { applied, conflicts }, error: null };
}

export function createFakeClient(db) {
  return {
    // public.sync_changes(team, since, limit): songs + setlists + deletions
    // after a cursor, ordered by seq. Rows seeded straight into `db` without
    // a seq get one here — the migration's backfill. `db.__rpcMissing` makes
    // the call fail like a project without the migration (PGRST202).
    async rpc(name, args = {}) {
      db.__rpcs?.push({ name, args: { ...args } });
      if (db.__rpcMissing) {
        return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name} in the schema cache` } };
      }
      if (db.__offline) { const e = new Error('Failed to fetch'); e.status = 0; throw e; }
      if (name === 'apply_ops') return applyOps(db, args);
      if (name !== 'sync_changes') return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
      const { p_team_id, p_since = 0, p_limit = 500 } = args;
      const limit = Math.max(1, Math.min(p_limit ?? 500, 1000));
      const backfill = (r) => { if (r.seq == null) r.seq = nextSeq(); if (r.version == null) r.version = 1; return r; };
      const feed = [];
      for (const r of db.team_songs || []) {
        backfill(r);
        if (r.team_id === p_team_id && r.seq > p_since) feed.push({ seq: r.seq, kind: 'song', key: r.song_key, row: { row_id: r.id, title: r.title, content: r.content, content_hash: r.content_hash ?? null, version: r.version, updated_at: r.updated_at, updated_by: r.updated_by ?? null } });
      }
      for (const r of db.team_setlists || []) {
        backfill(r);
        if (r.team_id === p_team_id && r.seq > p_since) feed.push({ seq: r.seq, kind: 'setlist', key: r.setlist_key, row: { row_id: r.id, name: r.name, content: r.content, content_hash: r.content_hash ?? null, version: r.version, updated_at: r.updated_at, updated_by: r.updated_by ?? null, created_by: r.created_by ?? null } });
      }
      for (const d of db.team_deletions || []) {
        if (d.team_id === p_team_id && d.seq > p_since) feed.push({ seq: d.seq, kind: 'deletion', key: d.key, row: { kind: d.kind, row_id: d.row_id, deleted_at: d.deleted_at, deleted_by: d.deleted_by ?? null } });
      }
      feed.sort((a, b) => a.seq - b.seq);
      const page = feed.slice(0, limit);
      return {
        data: { changes: page, next_seq: page.length ? page[page.length - 1].seq : p_since, more: page.length >= limit },
        error: null,
      };
    },
    from(table) {
      const rows = db[table];
      return {
        select(cols = '*') {
          const filters = [];
          let orderCol = null;
          let limitN = null;
          const matching = () => {
            db.__queries?.push({ table, cols, filters: filters.map(f => f[0] + ':' + f[1]) });
            const m = rows
              .filter(r => filters.every(([op, c, v]) =>
                op === 'gt' ? r[c] > v : op === 'in' ? v.includes(r[c]) : r[c] === v))
              .map(r => ({ ...r }));
            if (orderCol) m.sort((a, b) => (a[orderCol] < b[orderCol] ? -1 : a[orderCol] > b[orderCol] ? 1 : 0));
            return limitN != null ? m.slice(0, limitN) : m;
          };
          const chain = {
            eq: (col, val) => { filters.push(['eq', col, val]); return chain; },
            gt: (col, val) => { filters.push(['gt', col, val]); return chain; },
            in: (col, vals) => { filters.push(['in', col, vals]); return chain; },
            order: (col) => { orderCol = col; return chain; },
            limit: (n) => { limitN = n; return chain; },
            maybeSingle: async () => {
              const m = matching();
              return { data: m[0] ? { id: m[0].id, updated_at: m[0].updated_at } : null, error: null };
            },
            then: (resolve, reject) =>
              Promise.resolve({ data: matching(), error: null }).then(resolve, reject),
          };
          return chain;
        },
        insert(payload) {
          const keyCol = table === 'team_songs' ? 'song_key' : 'setlist_key';
          // Emulate the server-side stamp trigger: default the identity key
          // from the row's content when the writer didn't send one.
          const extractKey = (p, rowId) => {
            if (p[keyCol]) return p[keyCol];
            if (table === 'team_songs') {
              const m = /\nsongId:[ \t]*([^\n\r]+)/.exec(p.content || '');
              return m ? m[1].trim() : rowId;
            }
            const c = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
            return c?.id || rowId;
          };
          const doInsert = () => {
            const list = Array.isArray(payload) ? payload : [payload];
            const staged = [];
            for (const p of list) {
              const rowId = `row_${++rowSeq}`;
              const key = extractKey(p, rowId);
              const dupe = [...rows, ...staged].some(r => r.team_id === p.team_id && r[keyCol] === key);
              if (dupe) {
                return { data: null, error: { message: `duplicate key value violates unique constraint "idx_${table}_team_key"` } };
              }
              const row = { id: rowId, ...p, [keyCol]: key, version: 1, seq: nextSeq() };
              if (row.updated_at) row.updated_at = nextTs();
              staged.push(row);
            }
            rows.push(...staged);
            return { data: staged.map(r => ({ id: r.id, [keyCol]: r[keyCol], updated_at: r.updated_at })), error: null };
          };
          return {
            select: () => ({
              single: async () => {
                const r = doInsert();
                return r.error ? r : { data: r.data[0], error: null };
              },
              then: (resolve, reject) => Promise.resolve(doInsert()).then(resolve, reject),
            }),
          };
        },
        update(payload) {
          const filters = [];
          const chain = {
            eq: (col, val) => { filters.push([col, val]); return chain; },
            select: () => ({
              maybeSingle: async () => {
                const idx = rows.findIndex(r => filters.every(([c, v]) => r[c] === v));
                if (idx < 0) return { data: null, error: null };
                const next = { ...rows[idx], ...payload };
                if (payload.updated_at) next.updated_at = nextTs();
                // trg_sync_stamp: a real change bumps version + seq; a no-op does not.
                const before = rows[idx];
                const changed = ['content', 'title', 'name'].some(c => c in payload && stableStringify(payload[c]) !== stableStringify(before[c]));
                if (changed) {
                  next.version = (before.version ?? 1) + 1;
                  next.seq = nextSeq();
                }
                rows[idx] = next;
                return { data: { id: rows[idx].id, updated_at: rows[idx].updated_at }, error: null };
              },
            }),
          };
          return chain;
        },
        delete() {
          const filters = [];
          const chain = {
            eq: (col, val) => { filters.push([col, val]); return chain; },
            then: (resolve, reject) => {
              for (let i = rows.length - 1; i >= 0; i--) {
                if (!filters.every(([c, v]) => rows[i][c] === v)) continue;
                const [gone] = rows.splice(i, 1);
                // trg_record_deletion: a delete leaves a tombstone in the feed.
                const kind = tableKind(table);
                if (kind) {
                  (db.team_deletions ||= []).push({
                    id: `row_${++rowSeq}`, team_id: gone.team_id, kind,
                    key: gone.song_key ?? gone.setlist_key ?? gone.id, row_id: gone.id,
                    seq: nextSeq(), deleted_at: nextTs(),
                  });
                }
              }
              return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    },
  };
}

// ── Fixture helpers ──────────────────────────────────────────────────────────

export const noTombstones = () => ({ songs: [], setlists: [] });

export function mkSong(id, title, lyric = 'Amazing grace') {
  const md = `---\ntitle: ${title}\nkey: C\n---\n\n## Verse 1\n[C]${lyric}\n`;
  return songFromFlat({ ...parseSongMd(md), id });
}

export function mkSetlist(id, name) {
  return { id, name, date: '2026-06-14', items: [{ songId: 's1', note: '' }] };
}

export function makeRowHelpers(teamId) {
  return {
    songRow(song, updatedAt = '2026-06-01T00:00:00.000Z') {
      return { id: `row_${++rowSeq}`, team_id: teamId, title: song.title, content: songToMd(song), song_key: song.id, updated_at: updatedAt, version: 1, seq: nextSeq() };
    },
    setlistRow(sl, updatedAt = '2026-06-01T00:00:00.000Z') {
      return { id: `row_${++rowSeq}`, team_id: teamId, name: sl.name, content: JSON.parse(JSON.stringify(sl)), setlist_key: sl.id, updated_at: updatedAt, version: 1, seq: nextSeq() };
    },
  };
}
