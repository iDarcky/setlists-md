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

import { parseSongMd, songToMd } from '../../parser';
import { songFromFlat } from '../../arrangements';

let rowSeq = 0;
let lastTs = 0;
function nextTs() {
  const now = Math.max(Date.now(), lastTs + 1);
  lastTs = now;
  return new Date(now).toISOString();
}

export function createFakeClient(db) {
  return {
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
              const row = { id: rowId, ...p, [keyCol]: key };
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
                if (filters.every(([c, v]) => rows[i][c] === v)) rows.splice(i, 1);
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
      return { id: `row_${++rowSeq}`, team_id: teamId, title: song.title, content: songToMd(song), song_key: song.id, updated_at: updatedAt };
    },
    setlistRow(sl, updatedAt = '2026-06-01T00:00:00.000Z') {
      return { id: `row_${++rowSeq}`, team_id: teamId, name: sl.name, content: JSON.parse(JSON.stringify(sl)), setlist_key: sl.id, updated_at: updatedAt };
    },
  };
}
