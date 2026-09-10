import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReplicaEngine } from '@/sync/replica-engine';
import { createTeamSyncEngine } from '@/sync/team-engine';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { canonicalSongHash } from '@/sync/canonical';
import { createFakeClient, mkSong, mkSetlist, makeRowHelpers, noTombstones } from '@/__tests__/helpers/fakeSupabase';

// ── Device-namespaced sync state (each device has its own IndexedDB) ─────────
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
    getSyncState: vi.fn(async (lib) => JSON.parse(JSON.stringify(get(lib)))),
    updateSyncManifest: vi.fn(async (m, lib) => { get(lib).syncManifest = m; }),
    updateSetlistManifest: vi.fn(async (m, lib) => { get(lib).setlistManifest = m; }),
    updateReplicaState: vi.fn(async (r, lib) => { get(lib).replica = JSON.parse(JSON.stringify(r)); }),
    setPendingPush: vi.fn(async (p, lib) => { get(lib).pendingPush = p; }),
    setHashVersion: vi.fn(async (v, lib) => { get(lib).hashVersion = v; }),
    updateTokens: vi.fn(),
    isTokenExpired: vi.fn(() => false),
    __setDevice: (d) => { device = d; },
    __resetSyncStates: () => { states.clear(); },
  };
});

import { __setDevice, __resetSyncStates, getSyncState, updateSyncManifest } from '@/sync/tokens';

const TEAM = 'team-1';
const { songRow, setlistRow } = makeRowHelpers(TEAM);
const md = (song) => songToMd(song);
const fingerprint = (songs) => new Map(songs.map(s => [s.id, md(s)]));

// A device on the replica engine, with App's adoption contract mirrored:
// fullSync results replace state; conflicts are queued; pushes go through the
// same debouncedPush + flushPending pair App uses on pagehide.
function makeDevice(name, db, { readOnly = false } = {}) {
  const statuses = [];
  const pulls = { requested: 0 };
  const engine = createReplicaEngine((s) => statuses.push(s.state), TEAM, {
    client: createFakeClient(db), readOnly, onPullNeeded: () => { pulls.requested += 1; },
  });
  const dev = {
    name, engine, statuses, pulls,
    songs: [], setlists: [], tombstones: noTombstones(), conflicts: [],
    async sync() {
      __setDevice(name);
      const r = await engine.fullSync(dev.songs, dev.setlists, dev.tombstones);
      if (r.replaced) { dev.songs = r.songs; dev.setlists = r.setlists; }
      if (r.tombstonesChanged) dev.tombstones = r.tombstones;
      dev.conflicts.push(...(r.conflicts || []));
      return r;
    },
    // App: state changed → auto-save effect → debouncedPush; pagehide → flushPending.
    async save() {
      __setDevice(name);
      engine.debouncedPush(dev.songs, dev.setlists, dev.tombstones, (t) => { dev.tombstones = t; });
      await engine.flushPending(dev.songs, dev.setlists, dev.tombstones, (t) => { dev.tombstones = t; });
    },
    addSong(song) { dev.songs = [...dev.songs, song]; },
    editSong(id, lyric) { dev.songs = dev.songs.map(s => (s.id === id ? mkSong(id, s.title, lyric) : s)); },
    retitle(id, title) { dev.songs = dev.songs.map(s => (s.id === id ? { ...s, title } : s)); },
    deleteSong(id) {
      dev.songs = dev.songs.filter(s => s.id !== id);
      dev.tombstones = { ...dev.tombstones, songs: [...dev.tombstones.songs, { id, deletedAt: Date.now() + 1 }] };
    },
    async state() { __setDevice(name); return getSyncState(TEAM); },
  };
  return dev;
}

beforeEach(() => {
  __resetSyncStates();
});

describe('writer replica — the outbox', () => {
  it('creates, edits and deletes reach the server with versions, and a steady state is silent', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    await A.sync();

    A.addSong(mkSong('s1', 'First', 'v1'));
    A.setlists = [mkSetlist('sl1', 'Sunday')];
    await A.save();
    expect(db.team_songs).toHaveLength(1);
    expect(db.team_songs[0]).toMatchObject({ song_key: 's1', version: 1 });
    expect(db.team_setlists[0]).toMatchObject({ setlist_key: 'sl1', version: 1 });
    let st = await A.state();
    expect(st.replica.rows.song.s1.version).toBe(1);
    expect(st.replica.rows.setlist.sl1.rowId).toBe(db.team_setlists[0].id); // schedules can point at it right away
    expect(st.replica.dirty.song).toEqual({});

    A.editSong('s1', 'v2');
    await A.save();
    expect(db.team_songs[0].version).toBe(2);
    expect(md(A.songs[0])).toContain('v2');

    // Nothing changed → no apply_ops call at all, and the pull's echo does not
    // replace the object we hold.
    db.__rpcs.length = 0;
    const before = A.songs[0];
    await A.save();
    await A.sync();
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(0);
    expect(A.songs[0]).toBe(before);

    A.deleteSong('s1');
    await A.save();
    expect(db.team_songs).toHaveLength(0);
    expect(db.team_deletions).toHaveLength(1);
    expect(A.tombstones.songs).toEqual([]); // pruned once the server confirmed
    st = await A.state();
    expect(st.replica.rows.song.s1).toBeUndefined();
  });

  it('a tombstone for a song the server never had is pruned without a call', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    await A.sync();
    A.tombstones = { songs: [{ id: 'never-synced', deletedAt: Date.now() }], setlists: [] };
    db.__rpcs.length = 0;
    await A.save();
    expect(A.tombstones.songs).toEqual([]);
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(0);
  });

  it('a new object with identical bytes (play counts) is not an edit', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    await A.sync();
    A.addSong(mkSong('s1', 'First', 'v1'));
    await A.save();
    db.__rpcs.length = 0;
    A.songs = A.songs.map(s => ({ ...s, keyHistory: { C: 3 } }));
    await A.save();
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(0);
    expect(db.team_songs[0].version).toBe(1);
  });

  it('two writers converge; a concurrent edit of the same lyric surfaces one conflict carrying both sides', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Contested', 'base'));
    await A.save();
    await B.sync();
    expect(fingerprint(B.songs)).toEqual(fingerprint(A.songs));

    A.editSong('s1', 'A wins');
    B.editSong('s1', 'B loses');
    await A.save();               // A lands first: version 2
    await B.save();               // B's put is based on version 1 → conflict, pull requested
    expect(B.pulls.requested).toBe(1);
    expect(db.team_songs[0].version).toBe(2);
    expect(db.team_songs[0].content).toContain('A wins');

    await B.sync();               // the pull: both changed the chart → conflict, server adopted
    expect(B.conflicts).toHaveLength(1);
    expect(md(B.conflicts[0].local)).toContain('B loses');
    expect(md(B.conflicts[0].remote)).toContain('A wins');
    expect(md(B.songs[0])).toContain('A wins');
    expect((await B.state()).replica.dirty.song).toEqual({});

    // The user picks "mine": App restores the local copy → it is an edit on top
    // of the server's version 2 → pushes cleanly → everyone converges on it.
    B.songs = B.songs.map(s => (s.id === 's1' ? B.conflicts[0].local : s));
    await B.save();
    expect(db.team_songs[0].version).toBe(3);
    expect(db.team_songs[0].content).toContain('B loses');
    await A.sync();
    expect(fingerprint(A.songs)).toEqual(fingerprint(B.songs));
    expect(A.conflicts).toHaveLength(0);
  });

  it('disjoint edits merge silently: one fixes the title, the other the lyric', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Old Title', 'old lyric'));
    await A.save();
    await B.sync();

    A.retitle('s1', 'New Title');
    B.editSong('s1', 'new lyric');
    await A.save();               // server: New Title / old lyric (v2)
    await B.save();               // B based on v1 → conflict → pull requested
    await B.sync();               // three-way merge: title from the server, lyric from B → stays dirty
    expect(B.conflicts).toHaveLength(0);
    expect(B.songs[0].title).toBe('New Title');
    expect(md(B.songs[0])).toContain('new lyric');
    await B.save();               // pushes the merge on top of v2
    expect(db.team_songs[0].version).toBe(3);
    await A.sync();
    expect(A.songs[0].title).toBe('New Title');
    expect(md(A.songs[0])).toContain('new lyric');
    expect(fingerprint(A.songs)).toEqual(fingerprint(B.songs));
  });

  it('an edit beats a concurrent delete: the edited song comes back for everyone', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Keeper', 'v1'));
    await A.save();
    await B.sync();

    A.deleteSong('s1');
    B.editSong('s1', 'edited while A deleted it');
    await A.save();               // deleted on the server (tombstone)
    await B.save();               // B's put finds no row → 'missing' → pull requested
    await B.sync();               // deletion arrives; B is dirty → edit wins, it becomes a create
    expect(B.songs.map(s => s.id)).toEqual(['s1']);
    await B.save();
    expect(db.team_songs).toHaveLength(1);
    expect(db.team_songs[0].content).toContain('edited while A deleted it');
    await A.sync();
    expect(A.songs.map(s => s.id)).toEqual(['s1']);
  });

  it('a stale delete loses to a newer edit', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Keeper', 'v1'));
    await A.save();
    await B.sync();

    B.editSong('s1', 'v2 from B');
    await B.save();               // server v2
    A.deleteSong('s1');
    await A.save();               // A's delete is based on v1 → conflict → tombstone dropped, pull requested
    expect(db.team_songs).toHaveLength(1);
    expect(A.tombstones.songs).toEqual([]);
    await A.sync();
    expect(md(A.songs[0])).toContain('v2 from B');
  });

  it('unpushed edits survive a reload (identity is gone, the dirty set is not)', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    await A.sync();
    A.addSong(mkSong('s1', 'One', 'v1'));
    A.addSong(mkSong('s2', 'Two', 'w1'));
    await A.save();

    db.__offline = true;
    A.editSong('s1', 'edited offline');
    await A.save();               // fails; the edit is recorded as dirty with its base
    expect(A.statuses.at(-1)).toBe('error');
    expect((await A.state()).replica.dirty.song.s1).toContain('v1');
    db.__offline = false;

    // "Reload": a fresh engine over the same persisted state and the same
    // IndexedDB arrays (new object identities everywhere).
    const A2 = makeDevice('A', db);
    A2.songs = JSON.parse(JSON.stringify(A.songs));
    db.__rpcs = [];
    await A2.sync();
    const puts = db.__rpcs.filter(c => c.name === 'apply_ops').flatMap(c => c.args.p_ops);
    expect(puts.map(op => op.id)).toEqual(['s1']); // only the pending edit, not the whole library
    expect(db.team_songs.find(r => r.song_key === 's1').content).toContain('edited offline');
    expect(db.team_songs.find(r => r.song_key === 's2').version).toBe(1);
  });

  it('a reload mid-conflict still merges three-way, from the persisted base', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Old Title', 'old lyric'));
    await A.save();
    await B.sync();

    db.__offline = true;
    B.editSong('s1', 'new lyric');
    await B.save();               // dirty, base persisted
    db.__offline = false;
    A.retitle('s1', 'New Title');
    await A.save();

    const B2 = makeDevice('B', db);
    B2.songs = JSON.parse(JSON.stringify(B.songs));
    await B2.sync();
    expect(B2.conflicts).toHaveLength(0);
    expect(B2.songs[0].title).toBe('New Title');
    expect(md(B2.songs[0])).toContain('new lyric');
  });

  it('a mixed team converges: two writers on the replica, one member, seeded fuzz', async () => {
    let seed = 0xABCD;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    const M = makeDevice('M', db, { readOnly: true });
    const writers = [A, B];
    let n = 0;
    await A.sync(); await B.sync();

    for (let step = 0; step < 120; step++) {
      const roll = rand();
      const d = writers[Math.floor(rand() * 2)];
      if (roll < 0.25) {
        d.addSong(mkSong(`f${n}`, `Fuzz ${n}`, `born on ${d.name}`));
        n += 1;
      } else if (roll < 0.5 && d.songs.length > 0) {
        d.editSong(d.songs[Math.floor(rand() * d.songs.length)].id, `edit by ${d.name} at ${step}`);
      } else if (roll < 0.58 && d.songs.length > 1) {
        d.deleteSong(d.songs[Math.floor(rand() * d.songs.length)].id);
      } else if (roll < 0.8) {
        await d.save();
      } else if (roll < 0.92) {
        await d.sync();
      } else {
        await M.sync();
      }
    }
    // Quiesce: resolve every conflict by taking the cloud copy (already adopted),
    // then sync until nothing moves.
    for (let i = 0; i < 4; i++) {
      for (const d of writers) { await d.save(); await d.sync(); }
    }
    await M.sync();

    expect(fingerprint(A.songs)).toEqual(fingerprint(B.songs));
    expect(fingerprint(M.songs)).toEqual(fingerprint(A.songs));
    const serverKeys = db.team_songs.map(r => r.song_key).sort();
    expect(A.songs.map(s => s.id).sort()).toEqual(serverKeys);
    for (const row of db.team_songs) {
      expect(md(A.songs.find(s => s.id === row.song_key))).toBe(row.content);
    }
    expect((await A.state()).replica.dirty.song).toEqual({});
    expect((await B.state()).replica.dirty.song).toEqual({});
  });
});

describe('writer replica — handover from the manifest engine', () => {
  it('the first run pushes exactly the pending edits and creates, adopts what only the server changed, and asks about real conflicts', async () => {
    const clean = mkSong('clean', 'Clean', 'same everywhere');
    const pending = mkSong('pending', 'Pending', 'server copy');
    const serverMoved = mkSong('moved', 'Moved', 'old on this device');
    const both = mkSong('both', 'Both', 'baseline');
    const goneClean = mkSong('gone-clean', 'Gone', 'baseline');
    const goneEdited = mkSong('gone-edited', 'Gone but edited', 'baseline');
    const db = {
      team_songs: [
        songRow(clean),
        songRow(pending),
        songRow(mkSong('moved', 'Moved', 'newer on the server')),
        songRow(mkSong('both', 'Both', 'server changed this')),
      ],
      team_setlists: [],
      __rpcs: [],
    };
    // The manifest the OLD engine left behind: baselines for every synced song.
    __setDevice('A');
    await updateSyncManifest({
      clean: { remoteId: 'r1', lastSyncedHash: canonicalSongHash(md(clean)), lastSyncedTime: 't' },
      pending: { remoteId: 'r2', lastSyncedHash: canonicalSongHash(md(pending)), lastSyncedTime: 't' },
      moved: { remoteId: 'r3', lastSyncedHash: canonicalSongHash(md(serverMoved)), lastSyncedTime: 't' },
      both: { remoteId: 'r4', lastSyncedHash: canonicalSongHash(md(both)), lastSyncedTime: 't' },
      'gone-clean': { remoteId: 'r5', lastSyncedHash: canonicalSongHash(md(goneClean)), lastSyncedTime: 't' },
      'gone-edited': { remoteId: 'r6', lastSyncedHash: canonicalSongHash(md(goneEdited)), lastSyncedTime: 't' },
    }, TEAM);

    const A = makeDevice('A', db);
    A.songs = [
      clean,
      mkSong('pending', 'Pending', 'edited here, not yet pushed'),
      serverMoved,
      mkSong('both', 'Both', 'edited here too'),
      goneClean,
      mkSong('gone-edited', 'Gone but edited', 'edited here after someone deleted it'),
      mkSong('brand-new', 'Never synced', 'created offline'),
    ];
    const r = await A.sync();

    const ids = A.songs.map(s => s.id).sort();
    expect(ids).toEqual(['both', 'brand-new', 'clean', 'gone-edited', 'moved', 'pending']);
    expect(A.songs.find(s => s.id === 'clean')).toBe(clean);                                  // untouched, same reference
    expect(md(A.songs.find(s => s.id === 'moved'))).toContain('newer on the server');           // only the server moved → adopted
    expect(md(A.songs.find(s => s.id === 'pending'))).toContain('edited here, not yet pushed'); // only we moved → kept and pushed
    expect(db.team_songs.find(x => x.song_key === 'pending').content).toContain('edited here, not yet pushed');
    expect(db.team_songs.find(x => x.song_key === 'brand-new')).toBeTruthy();                   // never synced → created
    expect(db.team_songs.find(x => x.song_key === 'gone-edited')).toBeTruthy();                 // edited here after a delete → re-created
    expect(db.team_songs.find(x => x.song_key === 'gone-clean')).toBeUndefined();               // deleted elsewhere, untouched → dropped
    expect(r.conflicts.map(c => c.id)).toEqual(['both']);                                       // both moved → one prompt
    expect(md(A.songs.find(s => s.id === 'both'))).toContain('server changed this');            // server adopted meanwhile
    expect(db.team_songs.find(x => x.song_key === 'both').content).toContain('server changed this'); // never overwritten
    const puts = db.__rpcs.filter(c => c.name === 'apply_ops').flatMap(c => c.args.p_ops).map(op => op.id).sort();
    expect(puts).toEqual(['brand-new', 'gone-edited', 'pending']);

    const st = await A.state();
    expect(st.replica.writer).toBe(true);
    expect(Object.keys(st.replica.rows.song).sort()).toEqual(ids);
    expect(st.replica.dirty.song).toEqual({});
  });

  it('a device coming from the manifest engine with no pending edits uploads nothing', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    const s2 = mkSong('s2', 'Two', 'b');
    const db = { team_songs: [songRow(s1), songRow(s2)], team_setlists: [], __rpcs: [] };
    __setDevice('A');
    await updateSyncManifest({
      s1: { remoteId: 'x', lastSyncedHash: canonicalSongHash(md(s1)), lastSyncedTime: 't' },
      s2: { remoteId: 'y', lastSyncedHash: canonicalSongHash(md(s2)), lastSyncedTime: 't' },
    }, TEAM);
    const A = makeDevice('A', db);
    A.songs = [s1, s2];
    await A.sync();
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(0);
    expect(A.songs[0]).toBe(s1);
    expect(A.songs[1]).toBe(s2);
  });
});

describe('writer replica — edges', () => {
  it('a temp engine that never pulled (song moved into another library) pushes only the new song and persists nothing', async () => {
    const existing = mkSong('t1', 'Target One', 'x');
    const db = { team_songs: [songRow(existing)], team_setlists: [], __rpcs: [] };
    const moved = mkSong('moved', 'Moved In', 'from personal');
    __setDevice('T');
    const temp = createReplicaEngine(() => {}, TEAM, { client: createFakeClient(db) });
    temp.debouncedPush([existing, moved], [], noTombstones(), () => {});
    await temp.flushPending([existing, moved], [], noTombstones(), () => {});

    expect(db.team_songs.map(r => r.song_key).sort()).toEqual(['moved', 't1']);
    const puts = db.__rpcs.filter(c => c.name === 'apply_ops').flatMap(c => c.args.p_ops).map(op => op.id);
    expect(puts).toEqual(['moved']);
    expect((await getSyncState(TEAM)).replica).toBeNull(); // nothing adopted → no cursor persisted
  });

  it('a large first upload is chunked', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    await A.sync();
    for (let i = 0; i < 230; i++) A.addSong(mkSong(`b${i}`, `Bulk ${i}`, `l${i}`));
    await A.save();
    expect(db.team_songs).toHaveLength(230);
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(3); // 100 + 100 + 30
  });

  it('a device that is not a writer on the server is refused, and nothing lands', async () => {
    const db = { team_songs: [], team_setlists: [], __writerDenied: true };
    const A = makeDevice('A', db);
    await A.sync();
    A.addSong(mkSong('s1', 'Nope', 'x'));
    await A.save();
    expect(db.team_songs).toHaveLength(0);
    expect(A.statuses.at(-1)).toBe('error');
    expect((await A.state()).replica.dirty.song.s1).toBeNull(); // still pending, nothing lost
  });

  it('falls back to the manifest engine when the RPCs are missing', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'a'))], team_setlists: [], __rpcMissing: true };
    const A = makeDevice('A', db);
    await A.sync();
    expect(A.engine.isReplica).toBe(false);
    expect(A.songs.map(s => s.id)).toEqual(['s1']);
    // …and the fallback writes the old way.
    A.addSong(mkSong('s2', 'Two', 'b'));
    await A.save();
    expect(db.team_songs.map(r => r.song_key).sort()).toEqual(['s1', 's2']);
  });

  it('setlists take the same road: create, edit with a stale base, three-way merge on disjoint fields', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    await A.sync();
    A.setlists = [{ ...mkSetlist('sl1', 'Sunday'), date: '2026-09-13', notes: '' }];
    await A.save();
    await B.sync();
    expect(B.setlists[0].name).toBe('Sunday');

    A.setlists = A.setlists.map(sl => ({ ...sl, name: 'Sunday AM' }));
    B.setlists = B.setlists.map(sl => ({ ...sl, notes: 'bring the cajon' }));
    await A.save();
    await B.save();
    await B.sync();
    expect(B.conflicts).toHaveLength(0);
    expect(B.setlists[0]).toMatchObject({ name: 'Sunday AM', notes: 'bring the cajon' });
    await B.save();
    await A.sync();
    expect(A.setlists[0]).toMatchObject({ name: 'Sunday AM', notes: 'bring the cajon' });
    expect(db.team_setlists[0].version).toBe(3);
  });

  it('the old manifest engine and the replica can share a server (a stale build still writing)', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    await A.sync();
    A.addSong(mkSong('s1', 'One', 'from the replica'));
    await A.save();

    __setDevice('OLD');
    const old = createTeamSyncEngine(() => {}, TEAM, { client: createFakeClient(db) });
    let r = await old.fullSync([], [], noTombstones());
    expect(md(r.songs[0])).toContain('from the replica');
    const edited = r.songs.map(s => mkSong(s.id, s.title, 'from the old build'));
    r = await old.fullSync(edited, [], noTombstones());
    expect(db.team_songs[0].version).toBe(2);

    await A.sync();
    expect(md(A.songs[0])).toContain('from the old build');
    expect(A.conflicts).toHaveLength(0);
  });
});

// Keep the fixture helpers honest about what they build.
describe('fixtures', () => {
  it('mkSong round-trips through the parser', () => {
    const s = mkSong('x', 'T', 'lyric');
    expect(songFromFlat({ ...parseSongMd(md(s)), id: 'x' }).title).toBe('T');
    expect(setlistRow(mkSetlist('sl', 'N')).setlist_key).toBe('sl');
  });
});
