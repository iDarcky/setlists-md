import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTeamSyncEngine, stableStringify } from '../sync/team-engine';
import { parseSongMd, songToMd } from '../parser';
import { songFromFlat } from '../arrangements';
import { SYNC_DEBOUNCE_MS } from '../sync/constants';

// In-memory sync-state store standing in for the IndexedDB-backed tokens module.
vi.mock('../sync/tokens', () => {
  const states = new Map();
  const get = (lib) => {
    if (!states.has(lib)) {
      states.set(lib, { activeProvider: null, tokens: null, lastSyncTime: null, syncManifest: {}, setlistManifest: {} });
    }
    return states.get(lib);
  };
  return {
    getSyncState: vi.fn(async (lib) => ({ ...get(lib) })),
    updateSyncManifest: vi.fn(async (m, lib) => { get(lib).syncManifest = m; }),
    updateSetlistManifest: vi.fn(async (m, lib) => { get(lib).setlistManifest = m; }),
    updateTokens: vi.fn(),
    isTokenExpired: vi.fn(() => false),
    __resetSyncStates: () => states.clear(),
  };
});

import { __resetSyncStates, getSyncState, updateSyncManifest } from '../sync/tokens';

// ── Fake Supabase client over in-memory tables ───────────────────────────────

let rowSeq = 0;
function createFakeClient(db) {
  return {
    from(table) {
      const rows = db[table];
      return {
        select() {
          // Unified chain: fetchRows uses .eq().order().range(); adoption uses
          // .eq().eq().limit().maybeSingle().
          const filters = [];
          const matching = () => rows.filter(r => filters.every(([c, v]) => r[c] === v)).map(r => ({ ...r }));
          const chain = {
            eq: (col, val) => { filters.push([col, val]); return chain; },
            order: () => chain,
            limit: () => chain,
            range: (from, to) => Promise.resolve({ data: matching().slice(from, to + 1), error: null }),
            maybeSingle: async () => {
              const m = matching();
              return { data: m[0] ? { id: m[0].id, updated_at: m[0].updated_at } : null, error: null };
            },
          };
          return chain;
        },
        insert(payload) {
          return {
            select: () => ({
              single: async () => {
                // Emulate the unique (team_id, title) index on team_songs.
                if (table === 'team_songs' && rows.some(r => r.team_id === payload.team_id && r.title === payload.title)) {
                  return { data: null, error: { message: 'duplicate key value violates unique constraint "idx_team_songs_team_title"' } };
                }
                const row = { id: `row_${++rowSeq}`, ...payload };
                rows.push(row);
                return { data: { id: row.id, updated_at: row.updated_at }, error: null };
              },
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
                rows[idx] = { ...rows[idx], ...payload };
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEAM = 'team-1';
const noTombstones = () => ({ songs: [], setlists: [] });

function mkSong(id, title, lyric = 'Amazing grace') {
  const md = `---\ntitle: ${title}\nkey: C\n---\n\n## Verse 1\n[C]${lyric}\n`;
  return songFromFlat({ ...parseSongMd(md), id });
}

function songRow(song, updatedAt = '2026-06-01T00:00:00.000Z') {
  return { id: `row_${++rowSeq}`, team_id: TEAM, title: song.title, content: songToMd(song), updated_at: updatedAt };
}

function mkSetlist(id, name) {
  return { id, name, date: '2026-06-14', items: [{ songId: 's1', note: '' }] };
}

function setlistRow(sl, updatedAt = '2026-06-01T00:00:00.000Z') {
  return { id: `row_${++rowSeq}`, team_id: TEAM, name: sl.name, content: JSON.parse(JSON.stringify(sl)), updated_at: updatedAt };
}

function makeEngine(db, opts = {}) {
  return createTeamSyncEngine(() => {}, TEAM, { client: createFakeClient(db), ...opts });
}

beforeEach(() => {
  __resetSyncStates();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('team engine — pull (server-authoritative)', () => {
  it('adopts server content over a stale local copy on first sync', async () => {
    const serverSong = mkSong('s1', 'Server Title', 'server lyric');
    const db = { team_songs: [songRow(serverSong)], team_setlists: [] };
    const localStale = mkSong('s1', 'Old Title', 'old lyric');

    const result = await makeEngine(db).fullSync([localStale], [], noTombstones());

    expect(result.replaced).toBe(true);
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].title).toBe('Server Title');
    expect(songToMd(result.songs[0])).toContain('server lyric');
  });

  it('removes a previously-synced song locally when its server row is gone', async () => {
    const song = mkSong('s1', 'Doomed');
    const db = { team_songs: [songRow(song)], team_setlists: [] };
    const engine = makeEngine(db);

    const first = await engine.fullSync([], [], noTombstones());
    expect(first.songs).toHaveLength(1);

    db.team_songs.length = 0; // another member deleted it
    const second = await engine.fullSync(first.songs, [], noTombstones());
    expect(second.songs).toHaveLength(0);
  });

  it('keeps a never-synced local song and inserts it on the server', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const local = mkSong('s2', 'Brand New');

    const result = await makeEngine(db).fullSync([local], [], noTombstones());

    expect(result.songs).toHaveLength(1);
    expect(result.uploaded.songs).toBe(1);
    expect(db.team_songs).toHaveLength(1);
    expect(db.team_songs[0].content).toBe(songToMd(local));
  });

  it('reports a conflict when local diverged and the server also changed', async () => {
    const song = mkSong('s1', 'Original');
    const db = { team_songs: [songRow(song)], team_setlists: [] };
    const engine = makeEngine(db);
    const first = await engine.fullSync([], [], noTombstones());

    // Another member edits the row…
    const remoteEdit = mkSong('s1', 'Their Edit');
    db.team_songs[0].content = songToMd(remoteEdit);
    db.team_songs[0].updated_at = '2026-06-02T00:00:00.000Z';
    // …while we edited our local copy too.
    const localEdit = mkSong('s1', 'My Edit');

    const second = await engine.fullSync([localEdit], [], noTombstones());
    expect(second.songs[0].title).toBe('Their Edit'); // server wins
    expect(second.conflicts).toContainEqual(expect.objectContaining({ kind: 'song', id: 's1' }));
    // The conflict must carry BOTH sides so the resolver can offer a choice and
    // the divergent local edit is never silently lost.
    const conflict = second.conflicts.find(c => c.id === 's1');
    expect(conflict.local).toBeTruthy();
    expect(conflict.remote).toBeTruthy();
    expect(conflict.local.title).toBe('My Edit');
    expect(conflict.remote.title).toBe('Their Edit');
    void first;
  });

  it('heals duplicate rows for the same song id, keeping the newest', async () => {
    const older = songRow(mkSong('s1', 'Old Copy'), '2026-06-01T00:00:00.000Z');
    const newer = songRow(mkSong('s1', 'New Copy'), '2026-06-03T00:00:00.000Z');
    const db = { team_songs: [older, newer], team_setlists: [] };

    const result = await makeEngine(db).fullSync([], [], noTombstones());

    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].title).toBe('New Copy');
    expect(db.team_songs).toHaveLength(1);
    expect(db.team_songs[0].id).toBe(newer.id);
  });
});

describe('team engine — migration from the file-manifest engine', () => {
  it('keeps the local song id for a legacy row with no embedded id, via the old manifest', async () => {
    // A row pushed before id preservation: content has no `id:`/`songId:`.
    const legacyMd = '---\ntitle: Legacy Song\nkey: G\n---\n\n## Chorus\n[G]Old faithful\n';
    const row = { id: 'row_legacy', team_id: TEAM, title: 'Legacy Song', content: legacyMd, updated_at: '2026-06-01T00:00:00.000Z' };
    const db = { team_songs: [row], team_setlists: [] };

    // The old engine's manifest knew this row belonged to local id 'local-7'.
    await updateSyncManifest({ 'local-7': { remoteId: 'row_legacy', lastSyncedHash: 'old-scheme-hash', lastSyncedTime: '2026-05-01T00:00:00.000Z' } }, TEAM);
    const localCopy = songFromFlat({ ...parseSongMd(legacyMd), id: 'local-7' });

    const result = await makeEngine(db).fullSync([localCopy], [], noTombstones());

    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('local-7'); // identity preserved, no orphaning
    const state = await getSyncState(TEAM);
    expect(state.syncManifest['local-7']).toBeDefined();
    expect(state.syncManifest['row_legacy']).toBeUndefined();
  });
});

describe('team engine — steady state (no toast spam)', () => {
  it('uploads nothing on a second sync with no changes', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Stable'))], team_setlists: [setlistRow(mkSetlist('sl1', 'Sunday'))] };
    const engine = makeEngine(db);

    const first = await engine.fullSync([], [], noTombstones());
    const second = await engine.fullSync(first.songs, first.setlists, noTombstones());

    expect(second.uploaded.songs).toBe(0);
    expect(second.uploaded.setlists).toBe(0);
    expect(second.errors).toHaveLength(0);
  });

  it('is insensitive to JSONB key reordering in setlist content', async () => {
    const sl = mkSetlist('sl1', 'Sunday');
    const db = { team_songs: [], team_setlists: [setlistRow(sl)] };
    const engine = makeEngine(db);
    const first = await engine.fullSync([], [], noTombstones());

    // Simulate JSONB returning the same object with different key order.
    const reordered = { items: sl.items, date: sl.date, name: sl.name, id: sl.id };
    db.team_setlists[0].content = reordered;

    const second = await engine.fullSync(first.songs, first.setlists, noTombstones());
    expect(second.uploaded.setlists).toBe(0);
    expect(stableStringify(reordered)).toBe(stableStringify(sl));
  });
});

describe('team engine — deletes and tombstones', () => {
  it('deletes the server row for a locally-tombstoned song and prunes the tombstone', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Bye'))], team_setlists: [] };
    const engine = makeEngine(db);
    const first = await engine.fullSync([], [], noTombstones());
    expect(first.songs).toHaveLength(1);

    const tombstones = { songs: [{ id: 's1', deletedAt: Date.now() }], setlists: [] };
    const second = await engine.fullSync([], [], tombstones);

    expect(db.team_songs).toHaveLength(0);
    expect(second.songs).toHaveLength(0);
    expect(second.tombstones.songs).toHaveLength(0); // pruned after remote delete
  });

  it('adopts an existing row on a unique-title conflict instead of failing/duplicating', async () => {
    // Server has the song under one id; locally it drifted to a different id
    // (e.g. after the churn). Pushing the local copy would INSERT and collide
    // with the unique (team_id, title) index.
    const serverSong = mkSong('server-id', 'Same Title', 'server body');
    const db = { team_songs: [songRow(serverSong)], team_setlists: [] };
    const engine = makeEngine(db);

    const localDrifted = mkSong('drifted-id', 'Same Title', 'local body');
    const result = await engine.fullSync([localDrifted], [], noTombstones());

    // No hard failure, no duplicate row — the existing row was adopted/updated.
    expect(result.errors).toHaveLength(0);
    expect(db.team_songs).toHaveLength(1);
    expect(db.team_songs[0].content).toContain('local body');
  });

  it('circuit breaker: refuses to delete a large share of the library in one sync', async () => {
    // 10 songs synced; a desync tombstones 9 of them at once.
    const songs = Array.from({ length: 10 }, (_, i) => mkSong(`s${i}`, `Song ${i}`));
    const db = { team_songs: songs.map(s => songRow(s)), team_setlists: [] };
    const engine = makeEngine(db);
    await engine.fullSync(songs, [], noTombstones());

    const now = Date.now();
    const tombstones = { songs: songs.slice(0, 9).map(s => ({ id: s.id, deletedAt: now })), setlists: [] };
    const result = await engine.fullSync([songs[9]], [], tombstones);

    // No rows deleted, and an error explains why.
    expect(db.team_songs).toHaveLength(10);
    expect(result.errors.some(e => /Safety guard/.test(e.message || ''))).toBe(true);
  });

  it('circuit breaker: refuses to re-upload a large share of the library in one sync', async () => {
    // 10 songs synced clean. Then every song's serialized form differs from the
    // manifest at once (the signature of a serialization regression, not a human
    // editing). The breaker must halt the mass re-upload and leave the server
    // rows untouched.
    const songs = Array.from({ length: 10 }, (_, i) => mkSong(`s${i}`, `Song ${i}`, 'original'));
    const db = { team_songs: songs.map(s => songRow(s)), team_setlists: [] };
    const engine = makeEngine(db);
    await engine.fullSync(songs, [], noTombstones());
    const serverContentBefore = db.team_songs.map(r => r.content);

    // Re-mint each song with changed content but the SAME id (so they map to
    // existing rows → the update path, not inserts).
    const churned = songs.map((_, i) => mkSong(`s${i}`, `Song ${i}`, 'churned-body'));
    const result = await engine.fullSync(churned, [], noTombstones());

    expect(result.errors.some(e => /Safety guard/.test(e.message || ''))).toBe(true);
    expect(db.team_songs.map(r => r.content)).toEqual(serverContentBefore); // nothing rewritten
  });

  it('does NOT trip the update breaker for a legitimate first upload of many songs', async () => {
    // New songs (no remoteId yet) are inserts, not rewrites — importing a
    // library must never be blocked.
    const songs = Array.from({ length: 12 }, (_, i) => mkSong(`n${i}`, `New ${i}`));
    const db = { team_songs: [], team_setlists: [] };
    const engine = makeEngine(db);
    const result = await engine.fullSync(songs, [], noTombstones());

    expect(result.errors).toHaveLength(0);
    expect(db.team_songs).toHaveLength(12);
  });

  it('resurrects a song when the server row was edited after the local delete', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Kept'), '2026-06-10T00:00:00.000Z')], team_setlists: [] };
    const engine = makeEngine(db);
    await engine.fullSync([], [], noTombstones());

    const deletedAt = new Date('2026-06-05T00:00:00.000Z').getTime(); // older than row
    const result = await engine.fullSync([], [], { songs: [{ id: 's1', deletedAt }], setlists: [] });

    expect(db.team_songs).toHaveLength(1);
    expect(result.songs).toHaveLength(1);
    expect(result.tombstones.songs).toHaveLength(0);
    expect(result.tombstonesChanged).toBe(true);
  });
});

describe('team engine — read-only members', () => {
  it('mirrors the server and never writes', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Team Song'))], team_setlists: [] };
    const engine = makeEngine(db, { readOnly: true });

    const localOnly = mkSong('s9', 'Members Draft');
    const result = await engine.fullSync([localOnly], [], noTombstones());

    expect(result.songs.map(s => s.id)).toContain('s1');
    expect(result.uploaded.songs).toBe(0);
    expect(db.team_songs).toHaveLength(1); // no insert of the local draft
  });
});

describe('team engine — concurrent edit safety (CAS)', () => {
  it('debouncedPush refuses to overwrite a row another member changed since our pull', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Original'), '2026-06-01T00:00:00.000Z')], team_setlists: [] };
    const engine = makeEngine(db);
    const first = await engine.fullSync([], [], noTombstones());

    // Another member writes after our pull (updated_at moves on).
    const theirs = mkSong('s1', 'Their Newer Edit');
    db.team_songs[0].content = songToMd(theirs);
    db.team_songs[0].updated_at = '2026-06-02T00:00:00.000Z';

    // Our stale local edit goes out via debouncedPush.
    vi.useFakeTimers();
    const mine = mkSong('s1', 'My Stale Edit');
    engine.debouncedPush([mine], first.setlists, noTombstones(), () => {});
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS + 50);

    // CAS missed: their edit is intact, ours was not written.
    expect(db.team_songs[0].content).toBe(songToMd(theirs));
  });

  it('debouncedPush writes cleanly when nothing changed remotely', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Original'))], team_setlists: [] };
    const engine = makeEngine(db);
    const first = await engine.fullSync([], [], noTombstones());

    vi.useFakeTimers();
    const mine = mkSong('s1', 'My Edit');
    engine.debouncedPush([mine], first.setlists, noTombstones(), () => {});
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS + 50);

    expect(db.team_songs[0].content).toBe(songToMd(mine));
  });
});
