import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReplicaEngine, applyChanges, isMissingRpc, MIGRATION_MISSING } from '@/sync/replica-engine';
import { songToMd } from '@/parser';
import { createFakeClient, mkSong, mkSetlist, makeRowHelpers, noTombstones } from '@/__tests__/helpers/fakeSupabase';

// ── Device-namespaced sync state (same trick as the convergence suite) ───────
vi.mock('../sync/tokens', () => {
  const states = new Map();
  let device = 'A';
  const keyOf = (lib) => `${device}:${lib}`;
  const get = (lib) => {
    if (!states.has(keyOf(lib))) {
      states.set(keyOf(lib), { activeProvider: null, tokens: null, lastSyncTime: null, syncManifest: {}, setlistManifest: {}, replica: null });
    }
    return states.get(keyOf(lib));
  };
  return {
    getSyncState: vi.fn(async (lib) => ({ ...get(lib) })),
    updateSyncManifest: vi.fn(async (m, lib) => { get(lib).syncManifest = m; }),
    updateSetlistManifest: vi.fn(async (m, lib) => { get(lib).setlistManifest = m; }),
    updateReplicaState: vi.fn(async (r, lib) => { get(lib).replica = r; }),
    setPendingPush: vi.fn(async (p, lib) => { get(lib).pendingPush = p; }),
    setHashVersion: vi.fn(async (v, lib) => { get(lib).hashVersion = v; }),
    updateTokens: vi.fn(),
    isTokenExpired: vi.fn(() => false),
    __setDevice: (d) => { device = d; },
    __resetSyncStates: () => { states.clear(); },
  };
});

import { __setDevice, __resetSyncStates, getSyncState } from '@/sync/tokens';

const TEAM = 'team-1';
const { songRow, setlistRow } = makeRowHelpers(TEAM);

// A read-only member's device.
function makeMember(name, db) {
  const statuses = [];
  const engine = createReplicaEngine((s) => statuses.push(s.state), TEAM, { client: createFakeClient(db), readOnly: true });
  return {
    name, engine, statuses,
    songs: [], setlists: [], tombstones: noTombstones(),
    async sync() {
      __setDevice(name);
      const r = await this.engine.fullSync(this.songs, this.setlists, this.tombstones);
      if (r.replaced) { this.songs = r.songs; this.setlists = r.setlists; }
      return r;
    },
    async state() { __setDevice(name); return getSyncState(TEAM); },
  };
}

// A writer's device on the replica: fullSync pulls, then pushes its dirty set.
function makeWriter(name, db) {
  const engine = createReplicaEngine(() => {}, TEAM, { client: createFakeClient(db) });
  return {
    name, engine,
    songs: [], setlists: [], tombstones: noTombstones(),
    async sync() {
      __setDevice(name);
      const r = await this.engine.fullSync(this.songs, this.setlists, this.tombstones);
      if (r.replaced) { this.songs = r.songs; this.setlists = r.setlists; }
      if (r.tombstonesChanged) this.tombstones = r.tombstones;
      return r;
    },
    addSong(song) { this.songs = [...this.songs, song]; },
    editSong(id, lyric) { this.songs = this.songs.map(s => (s.id === id ? mkSong(id, s.title, lyric) : s)); },
    deleteSong(id) {
      this.songs = this.songs.filter(s => s.id !== id);
      this.tombstones = { ...this.tombstones, songs: [...this.tombstones.songs, { id, deletedAt: Date.now() + 1 }] };
    },
  };
}

const fingerprint = (songs) => new Map(songs.map(s => [s.id, songToMd(s)]));

beforeEach(() => {
  __resetSyncStates();
});

describe('replica engine — a member device mirrors the feed', () => {
  it('first pull mirrors the whole library and records the cursor + server set', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    const s2 = mkSong('s2', 'Two', 'b');
    const sl = mkSetlist('sl1', 'Sunday');
    const db = { team_songs: [songRow(s1), songRow(s2)], team_setlists: [setlistRow(sl)], __rpcs: [] };
    const B = makeMember('B', db);

    const r = await B.sync();

    expect(r.replaced).toBe(true);
    expect(r.uploaded).toEqual({ songs: 0, setlists: 0 });
    expect(r.conflicts).toEqual([]);
    expect(B.songs.map(s => s.id).sort()).toEqual(['s1', 's2']);
    expect(songToMd(B.songs.find(s => s.id === 's1'))).toBe(songToMd(s1));
    expect(B.setlists.map(sl => sl.id)).toEqual(['sl1']);
    expect(B.statuses).toEqual(['syncing', 'synced']);

    const state = await B.state();
    expect(Object.keys(state.replica.rows.song).sort()).toEqual(['s1', 's2']);
    expect(Object.keys(state.replica.rows.setlist)).toEqual(['sl1']);
    expect(state.replica.rows.setlist.sl1.rowId).toBe(db.team_setlists[0].id); // what team_schedules points at
    expect(state.replica.since).toBe(Math.max(...db.team_songs.map(r => r.seq), ...db.team_setlists.map(r => r.seq)));
    expect(db.__rpcs[0]).toMatchObject({ name: 'sync_changes', args: { p_team_id: TEAM, p_since: 0 } });
  });

  it('a delta pull asks only for what is after the cursor and keeps untouched objects by reference', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'a')), songRow(mkSong('s2', 'Two', 'b'))], team_setlists: [], __rpcs: [] };
    const B = makeMember('B', db);
    await B.sync();
    const cursor = (await B.state()).replica.since;
    const untouched = B.songs.find(s => s.id === 's2');

    // A leader edits s1 on the server.
    const A = makeWriter('A', db);
    await A.sync();
    A.editSong('s1', 'a2 from the leader');
    await A.sync();

    db.__rpcs.length = 0;
    const r = await B.sync();

    expect(db.__rpcs).toHaveLength(1);
    expect(db.__rpcs[0].args.p_since).toBe(cursor);
    // Two changes: s1's edit, and s2's one-time upgrade to a JSON document by
    // the leader's device (step 5) — same song, new bytes on the server.
    expect(r.replica.applied).toBe(2);
    expect(songToMd(B.songs.find(s => s.id === 's1'))).toContain('a2 from the leader');
    expect(B.songs.find(s => s.id === 's2')).toBe(untouched); // the document equals what we hold → reference preserved → no IndexedDB rewrite, no "edited" churn
    expect((await B.state()).replica.since).toBeGreaterThan(cursor);
  });

  it('a delete on the server arrives as a deletion row and removes the song', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeWriter('A', db);
    const B = makeMember('B', db);
    A.addSong(mkSong('s1', 'Doomed', 'x'));
    A.addSong(mkSong('s2', 'Keeper', 'y'));
    await A.sync();
    await B.sync();
    expect(B.songs.map(s => s.id).sort()).toEqual(['s1', 's2']);

    A.deleteSong('s1');
    await A.sync();
    expect(db.team_deletions).toHaveLength(1);

    await B.sync();
    expect(B.songs.map(s => s.id)).toEqual(['s2']);
    expect((await B.state()).replica.rows.song.s1).toBeUndefined();
  });

  it('a local item the server never named is dropped (the mirror IS the server set)', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'Real', 'a'))], team_setlists: [] };
    const B = makeMember('B', db);
    B.songs = [mkSong('ghost', 'Left over from a demoted admin', 'z')];
    B.setlists = [mkSetlist('ghost-sl', 'Never synced')];

    const r = await B.sync();

    expect(r.songs.map(s => s.id)).toEqual(['s1']);
    expect(r.setlists).toEqual([]);
  });

  it('play histories survive adoption (they are device-derived and never on the wire)', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'server lyric'))], team_setlists: [] };
    const B = makeMember('B', db);
    B.songs = [{ ...mkSong('s1', 'One', 'stale local lyric'), keyHistory: { G: 4 }, tempoHistory: { 72: 2 } }];

    await B.sync();

    const song = B.songs[0];
    expect(songToMd(song)).toContain('server lyric');
    expect(song.keyHistory).toEqual({ G: 4 });
    expect(song.tempoHistory).toEqual({ 72: 2 });
  });

  it('never writes', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'a'))], team_setlists: [] };
    const B = makeMember('B', db);
    await B.sync();
    const snapshot = JSON.stringify(db.team_songs);

    B.songs = [mkSong('s1', 'One', 'a member tried to edit this')];
    B.engine.debouncedPush(B.songs, B.setlists, B.tombstones, () => {});
    await B.engine.flushPending(B.songs, B.setlists, B.tombstones, () => {});
    B.engine.cancelDebounce();
    await B.sync();

    expect(JSON.stringify(db.team_songs)).toBe(snapshot);
    expect(B.engine.recentlyPushed()).toBe(false);

    // A delta feed does not re-send rows the server has not changed, so a local
    // mutation (which the UI forbids for members) lingers until that row next
    // changes on the server — and then the server copy wins outright.
    const A = makeWriter('A', db);
    await A.sync();
    A.editSong('s1', 'the leader touched it');
    await A.sync();
    await B.sync();
    expect(songToMd(B.songs[0])).toContain('the leader touched it');
    expect(songToMd(B.songs[0])).not.toContain('tried to edit');
  });

  it('pages through a large feed with the cursor', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    for (let i = 0; i < 7; i++) db.team_songs.push(songRow(mkSong(`s${i}`, `Song ${i}`, `l${i}`)));
    const engine = createReplicaEngine(() => {}, TEAM, { client: createFakeClient(db), pageSize: 3, readOnly: true });
    __setDevice('B');

    const r = await engine.fullSync([], [], noTombstones());

    expect(r.songs).toHaveLength(7);
    expect(db.__rpcs.map(c => c.args.p_since)).toHaveLength(3); // 3 + 3 + 1
    const seqs = db.team_songs.map(row => row.seq).sort((a, b) => a - b);
    expect(db.__rpcs[1].args.p_since).toBe(seqs[2]);
    expect(db.__rpcs[2].args.p_since).toBe(seqs[5]);
  });

  it('a project without the sync migration is reported, and local data is left alone', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'a'))], team_setlists: [], __rpcMissing: true, __rpcs: [] };
    const statuses = [];
    const engine = createReplicaEngine((s) => statuses.push(s.state), TEAM, { client: createFakeClient(db), readOnly: true });
    __setDevice('B');
    const local = [mkSong('keep', 'Local', 'x')];

    const r = await engine.fullSync(local, [], noTombstones());

    expect(r.changed).toBe(false);
    expect(r.songs).toBe(local);
    expect(r.errors[0].message).toBe(MIGRATION_MISSING);
    expect(statuses.at(-1)).toBe('error');
    expect((await getSyncState(TEAM)).replica).toBeNull();
    expect(isMissingRpc({ code: 'PGRST202' })).toBe(true);
    expect(isMissingRpc({ code: '42883' })).toBe(true);
    expect(isMissingRpc({ message: 'Could not find the function public.sync_changes' })).toBe(true);
    expect(isMissingRpc({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('applyChanges resolves a put then a deletion of the same key in feed order', () => {
    const songs = new Map();
    const setlists = new Map();
    const rows = { song: {}, setlist: {} };
    const md = songToMd(mkSong('s1', 'One', 'a'));
    applyChanges([
      { seq: 1, kind: 'song', key: 's1', row: { row_id: 'r1', content: md, version: 1, updated_at: '2026-09-10T00:00:00Z' } },
      { seq: 2, kind: 'deletion', key: 's1', row: { kind: 'song', row_id: 'r1' } },
      { seq: 3, kind: 'setlist', key: 'sl1', row: { row_id: 'r2', content: { id: 'sl1', name: 'X', items: [] }, version: 1 } },
      { seq: 4, kind: 'song', key: 'bad', row: { row_id: 'r3', content: null, version: 1 } },
    ], songs, setlists, rows);
    expect(songs.size).toBe(0);
    expect(rows.song).toEqual({});
    expect(setlists.get('sl1')).toEqual({ id: 'sl1', name: 'X', items: [] });
    expect(rows.setlist.sl1).toEqual({ version: 1, seq: 3, rowId: 'r2' });
  });
});

describe('replica engine — converges with a writer on the replica', () => {
  it('create / edit / delete / setlist rename all reach the member', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeWriter('A', db);
    const B = makeMember('B', db);

    A.addSong(mkSong('s1', 'First', 'v1'));
    A.setlists = [mkSetlist('sl1', 'Sunday Service')];
    await A.sync();
    await B.sync();
    expect(fingerprint(B.songs)).toEqual(fingerprint(A.songs));
    expect(B.setlists[0].name).toBe('Sunday Service');

    A.editSong('s1', 'v2');
    A.addSong(mkSong('s2', 'Second', 'w1'));
    A.setlists = A.setlists.map(sl => ({ ...sl, name: 'Sunday PM' }));
    await A.sync();
    await B.sync();
    expect(fingerprint(B.songs)).toEqual(fingerprint(A.songs));
    expect(B.setlists[0].name).toBe('Sunday PM');

    A.deleteSong('s1');
    await A.sync();
    await B.sync();
    expect(B.songs.map(s => s.id)).toEqual(['s2']);

    // Steady state: nothing to apply, cursor stays.
    const before = (await B.state()).replica.since;
    const r = await B.sync();
    expect(r.replica.applied).toBe(0);
    expect((await B.state()).replica.since).toBe(before);
  });

  it('randomized writer activity with a member syncing at arbitrary points converges (seeded fuzz)', async () => {
    let seed = 0xBEEF;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const db = { team_songs: [], team_setlists: [] };
    const A = makeWriter('A', db);
    const B = makeMember('B', db);
    let n = 0;

    for (let step = 0; step < 80; step++) {
      const roll = rand();
      if (roll < 0.3) {
        A.addSong(mkSong(`f${n}`, `Fuzz ${n}`, `born ${n}`));
        n += 1;
      } else if (roll < 0.55 && A.songs.length > 0) {
        A.editSong(A.songs[Math.floor(rand() * A.songs.length)].id, `edit at ${step}`);
      } else if (roll < 0.65 && A.songs.length > 1) {
        A.deleteSong(A.songs[Math.floor(rand() * A.songs.length)].id);
      } else if (roll < 0.85) {
        await A.sync();
      } else {
        await B.sync();
      }
    }
    await A.sync();
    await A.sync();
    await B.sync();

    expect(fingerprint(B.songs)).toEqual(fingerprint(A.songs));
    const serverKeys = db.team_songs.map(r => r.song_key).sort();
    expect(B.songs.map(s => s.id).sort()).toEqual(serverKeys);
    expect(Object.keys((await B.state()).replica.rows.song).sort()).toEqual(serverKeys);
  });
});
