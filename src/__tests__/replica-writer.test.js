import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReplicaEngine, MIGRATION_MISSING } from '@/sync/replica-engine';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat, addArrangement, withArrangement } from '@/arrangements';
import { canonicalSongHash } from '@/sync/canonical';
import { docString } from '@/sync/songDoc';
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

import { __setDevice, __resetSyncStates, getSyncState, updateSyncManifest, updateReplicaState } from '@/sync/tokens';

const TEAM = 'team-1';
const { songRow, setlistRow } = makeRowHelpers(TEAM);
const md = (song) => songToMd(song);
const fingerprint = (songs) => new Map(songs.map(s => [s.id, md(s)]));

// A device on the replica engine, with App's adoption contract mirrored:
// fullSync results replace state; conflicts are queued; pushes go through the
// same debouncedPush + flushPending pair App uses on pagehide.
function makeDevice(name, db, { readOnly = false, teamId = TEAM, libraryId = teamId, engineOpts = {} } = {}) {
  const statuses = [];
  const statusLog = [];
  const pulls = { requested: 0 };
  const engine = createReplicaEngine((s) => { statuses.push(s.state); statusLog.push(s); }, teamId, {
    client: createFakeClient(db), readOnly, onPullNeeded: () => { pulls.requested += 1; }, ...engineOpts,
  });
  const dev = {
    name, engine, statuses, statusLog, pulls,
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
    async state() { __setDevice(name); return getSyncState(libraryId); },
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
    // Step 5: the two markdown-only rows this device holds clean get an
    // "upgrade" put too — the document lands, the markdown does not move.
    const puts = db.__rpcs.filter(c => c.name === 'apply_ops').flatMap(c => c.args.p_ops).map(op => op.id).sort();
    expect(puts).toEqual(['brand-new', 'clean', 'gone-edited', 'moved', 'pending']);
    expect(db.team_songs.find(x => x.song_key === 'clean').content).toBe(md(clean));
    expect(db.team_songs.find(x => x.song_key === 'clean').doc).toBeTruthy();

    const st = await A.state();
    expect(st.replica.writer).toBe(true);
    expect(Object.keys(st.replica.rows.song).sort()).toEqual(ids);
    expect(st.replica.dirty.song).toEqual({});
  });

  it('a device coming from the manifest engine with no pending edits uploads nothing — except the documents the rows lack', async () => {
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
    // One batch, two upgrade puts: the markdown is byte-for-byte what it was.
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(1);
    expect(db.team_songs.map(x => x.content)).toEqual([md(s1), md(s2)]);
    expect(db.team_songs.every(x => x.doc)).toBe(true);
    expect(A.songs[0]).toBe(s1);
    expect(A.songs[1]).toBe(s2);
    // Nothing on the second pass.
    db.__rpcs.length = 0;
    await A.sync();
    expect(db.__rpcs.filter(c => c.name === 'apply_ops')).toHaveLength(0);
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

  it('a project without the sync migration is reported; nothing is written and nothing is minted locally', async () => {
    const db = { team_songs: [songRow(mkSong('s1', 'One', 'a'))], team_setlists: [], __rpcMissing: true };
    const A = makeDevice('A', db);
    const r = await A.sync();
    expect(r.changed).toBe(false);
    expect(r.errors[0].message).toBe(MIGRATION_MISSING);
    expect(A.songs).toEqual([]);
    A.addSong(mkSong('s2', 'Two', 'b'));
    await A.save();
    expect(A.statuses.at(-1)).toBe('error');
    expect(db.team_songs.map(r => r.song_key)).toEqual(['s1']);
    expect((await A.state()).replica).toBeNull(); // no cursor without a first pull
    expect(A.songs.map(s => s.id)).toEqual(['s2']); // still here, still local
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

  it('a stale build writing straight to the table (no RPC) is still picked up', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    await A.sync();
    A.addSong(mkSong('s1', 'One', 'from the replica'));
    await A.save();

    // A PWA still serving last month's shell writes the row directly; the
    // stamp trigger (emulated by the fake) bumps version + seq all the same.
    const row = db.team_songs[0];
    const stale = createFakeClient(db);
    await stale.from('team_songs')
      .update({ content: md(mkSong('s1', 'One', 'from the old build')), title: 'One', updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('team_id', TEAM).eq('updated_at', row.updated_at)
      .select('id, updated_at').maybeSingle();
    expect(db.team_songs[0].version).toBe(2);

    await A.sync();
    expect(md(A.songs[0])).toContain('from the old build');
    expect(A.conflicts).toHaveLength(0);
  });
});

// Keep the fixture helpers honest about what they build.
// ── The personal library as a workspace on Supabase (step 4) ───────────────
// The same writer replica, pointed at the account's own `teams` row, keeping
// the personal library's sync slot ('personal') and reporting as the account's
// cloud rather than a team's.
const WS = 'ws-personal-1';
const personalOpts = { libraryId: 'personal', providerId: `supabase-personal:${WS}`, handoverFromManifest: false };
const makePersonal = (name, db, extra = {}) => makeDevice(name, db, { teamId: WS, libraryId: 'personal', engineOpts: { ...personalOpts, ...extra } });

describe('writer replica — the personal workspace (step 4)', () => {
  it('keeps the personal sync slot, reports as the account cloud, and uploads the library on first run', async () => {
    const { songRow: wsSongRow } = makeRowHelpers(WS);
    const db = { team_songs: [wsSongRow(mkSong('cloud-only', 'From another device', 'x'))], team_setlists: [], __rpcs: [] };
    const A = makePersonal('A', db);
    A.songs = [mkSong('mine', 'Mine', 'created before the cloud existed')];
    A.setlists = [mkSetlist('sl', 'Sunday')];
    await A.sync();

    expect(A.songs.map(s => s.id).sort()).toEqual(['cloud-only', 'mine']);
    expect(db.team_songs.find(x => x.song_key === 'mine')?.team_id).toBe(WS);
    expect(db.team_setlists.find(x => x.setlist_key === 'sl')?.team_id).toBe(WS);
    expect(db.__rpcs.filter(c => c.name === 'apply_ops').every(c => c.args.p_team_id === WS)).toBe(true);
    expect(A.statusLog.at(-1)).toMatchObject({ state: 'synced', provider: `supabase-personal:${WS}` });

    __setDevice('A');
    expect((await getSyncState('personal')).replica?.writer).toBe(true);     // its own slot…
    expect((await getSyncState(WS)).replica).toBeNull();                     // …never the workspace id's
  });

  it('a cloud-folder manifest is not this server\'s history: every folder-synced song is uploaded, none dropped', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    const s2 = mkSong('s2', 'Two', 'b');
    // What the Drive engine left under 'personal': baselines for both songs.
    __setDevice('A');
    await updateSyncManifest({
      s1: { remoteId: 'drive-file-1', lastSyncedHash: canonicalSongHash(md(s1)), lastSyncedTime: 't' },
      s2: { remoteId: 'drive-file-2', lastSyncedHash: canonicalSongHash(md(s2)), lastSyncedTime: 't' },
    }, 'personal');
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makePersonal('A', db);
    A.songs = [s1, s2];
    await A.sync();
    expect(A.songs.map(s => s.id).sort()).toEqual(['s1', 's2']);
    expect(db.team_songs.map(x => x.song_key).sort()).toEqual(['s1', 's2']);
  });

  it('…which is exactly what the handover flag would get wrong (pins why it is off for the personal library)', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    __setDevice('A');
    await updateSyncManifest({ s1: { remoteId: 'drive-file-1', lastSyncedHash: canonicalSongHash(md(s1)), lastSyncedTime: 't' } }, 'personal');
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makePersonal('A', db, { handoverFromManifest: true });
    A.songs = [s1];
    await A.sync();
    expect(A.songs).toEqual([]);            // read as "synced once, deleted elsewhere" → dropped
    expect(db.team_songs).toEqual([]);
  });

  it('two devices of one account converge through the workspace', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makePersonal('A', db);
    const B = makePersonal('B', db);
    A.addSong(mkSong('a', 'From A', 'first'));
    await A.sync();
    await B.sync();
    expect(B.songs.map(s => s.id)).toEqual(['a']);
    B.editSong('a', 'edited on B');
    B.addSong(mkSong('b', 'From B', 'second'));
    await B.save();
    await A.sync();
    expect(fingerprint(A.songs)).toEqual(fingerprint(B.songs));
    expect(md(A.songs.find(s => s.id === 'a'))).toContain('edited on B');
    expect(A.conflicts).toEqual([]);
    expect(B.conflicts).toEqual([]);
  });
});

// ── JSON on the wire (step 5) ───────────────────────────────────────────────
// A song travels as its whole v2 document beside the markdown older builds
// still read. Everything markdown flattens away — other arrangements, the
// key-change overlay, the length — now reaches every device.
function withExtras(song) {
  const { song: two, arrangementId: secondId } = addArrangement(song, 'Acoustic');
  return withArrangement(
    withArrangement(two, song.defaultArrangementId, a => ({ ...a, duration: '3:45', keyChanges: [{ slot: 1, line: 0, semitones: 2 }] })),
    secondId, a => ({ ...a, key: 'D', capo: 2 }),
  );
}
// A second arrangement only — the default one, and so the markdown, untouched.
function withSecondArrangement(song) {
  const { song: two, arrangementId } = addArrangement(song, 'Acoustic');
  return withArrangement(two, arrangementId, a => ({ ...a, key: 'D' }));
}
// Change the lyric of the default arrangement without touching the others
// (`editSong` rebuilds a one-arrangement song, which is not what we want here).
const relyric = (song, lyric) => withArrangement(song, song.defaultArrangementId, a => ({ ...a, sections: [{ ...a.sections[0], lines: [`[C]${lyric}`] }] }));
// An older build writing straight to the table: markdown only, no document.
async function oldBuildWrites(db, rowId, song) {
  const client = createFakeClient(db);
  await client.from('team_songs').update({ title: song.title, content: md(song), updated_at: new Date().toISOString() }).eq('id', rowId).select().maybeSingle();
}

describe('JSON on the wire (step 5)', () => {
  it('a push carries the whole song: every arrangement, the key-change overlay and the length reach the other device', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.addSong(withExtras(mkSong('x', 'Two ways', 'lyric')));
    await A.sync();
    const row = db.team_songs[0];
    expect(row.doc.arrangements).toHaveLength(2);
    expect(row.doc.arrangements[0].keyChanges).toEqual([{ slot: 1, line: 0, semitones: 2 }]);
    expect(row.doc.arrangements[0].duration).toBe('3:45');
    // The markdown beside it is what an older build reads: ONE arrangement, and
    // now with the overlay and the length it used to drop (PLAN §2.3).
    expect(parseSongMd(row.content).arrangementId).toBe(A.songs[0].defaultArrangementId);
    expect(row.content).toContain('duration: 3:45');
    expect(row.content).toContain('keyChanges: [1:0:+2]');
    await B.sync();
    expect(docString(B.songs[0])).toBe(docString(A.songs[0]));
    expect(B.songs[0].arrangements.map(a => a.name)).toEqual(['Main Arrangement', 'Acoustic']);
    expect(B.songs[0].arrangements[1]).toMatchObject({ key: 'D', capo: 2 });
    // Play histories are per device, never on the wire.
    expect(row.doc.keyHistory).toBeUndefined();
    expect(B.songs[0].keyHistory).toEqual({});
  });

  it('a markdown-only row is read from its markdown and upgraded once: the document lands, the markdown does not move', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    const s2 = mkSong('s2', 'Two', 'b');
    const db = { team_songs: [songRow(s1), songRow(s2)], team_setlists: [], __rpcs: [] };
    const M = makeDevice('M', db, { readOnly: true });
    await M.sync();
    expect(db.team_songs.every(x => x.doc == null)).toBe(true);     // a member never upgrades anything
    const A = makeDevice('A', db);
    await A.sync();
    expect(db.team_songs.map(x => x.content)).toEqual([md(s1), md(s2)]);
    expect(db.team_songs.map(x => x.version)).toEqual([2, 2]);
    expect(db.team_songs.every(x => x.doc?.arrangements?.length === 1)).toBe(true);
    const st = await A.state();
    expect(Object.values(st.replica.rows.song).map(r => r.fmt)).toEqual(['doc', 'doc']);
    expect(st.replica.dirty.song).toEqual({});
    // The member pulls the upgraded rows; identical songs, new bytes.
    const before = M.songs;
    await M.sync();
    expect(fingerprint(M.songs)).toEqual(fingerprint(before));
  });

  it('a device that synced before step 5 upgrades the rows it holds on its next pass (no fmt in its persisted rows)', async () => {
    const s1 = mkSong('s1', 'One', 'a');
    const db = { team_songs: [songRow(s1)], team_setlists: [], __rpcs: [] };
    const row = db.team_songs[0];
    __setDevice('A');
    // The replica state the previous build left: a row stamp without `fmt`.
    await updateReplicaState({ since: row.seq, rows: { song: { s1: { version: 1, seq: row.seq, rowId: row.id } }, setlist: {} }, dirty: { song: {}, setlist: {} }, writer: true }, TEAM);
    const A = makeDevice('A', db);
    A.songs = [s1];
    await A.sync();
    expect(row.doc).toBeTruthy();
    expect(row.content).toBe(md(s1));
    expect((await A.state()).replica.rows.song.s1.fmt).toBe('doc');
  });

  it("an older build's markdown write drops the document; this build reads the markdown, keeps its extra arrangement, and restores the document", async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    A.addSong(withExtras(mkSong('x', 'Two ways', 'lyric')));
    await A.sync();
    const row = () => db.team_songs[0];
    expect(row().doc.arrangements).toHaveLength(2);
    // The older build edits the title: markdown only.
    await oldBuildWrites(db, row().id, mkSong('x', 'Renamed', 'lyric'));
    expect(row().doc).toBeNull();
    expect(row().version).toBe(2);
    await A.sync();
    expect(A.songs[0].title).toBe('Renamed');
    expect(A.songs[0].arrangements.map(a => a.name)).toEqual(['Main Arrangement', 'Acoustic']);
    expect(A.conflicts).toEqual([]);
    // …and the server has the whole song again.
    expect(row().doc.arrangements).toHaveLength(2);
    expect(row().doc.title).toBe('Renamed');
    expect(row().version).toBe(3);
  });

  it('two writers upgrading the same row do not conflict; the one holding an extra arrangement wins the union', async () => {
    const base = mkSong('x', 'Shared', 'lyric');
    const db = { team_songs: [songRow(base)], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.songs = [base];
    B.songs = [withSecondArrangement(base)]; // an arrangement that never left this device
    await A.sync();
    expect(db.team_songs[0].doc.arrangements).toHaveLength(1);
    // B sees A's document on its first run: same markdown, different documents,
    // no base to say who added what → keep both and push the union.
    await B.sync();
    await B.sync();
    expect(B.conflicts).toEqual([]);
    expect(A.conflicts).toEqual([]);
    expect(db.team_songs[0].doc.arrangements).toHaveLength(2);
    await A.sync();
    expect(fingerprint(A.songs)).toEqual(fingerprint(B.songs));
    expect(A.songs[0].arrangements).toHaveLength(2);
  });

  it('a dirty base the previous build persisted as markdown still merges three-way', async () => {
    const orig = mkSong('x', 'Title', 'lyric');
    const db = { team_songs: [songRow(orig)], team_setlists: [], __rpcs: [] };
    const row = db.team_songs[0];
    // Someone else changed the lyric on the server since (this build: a document).
    const Other = makeDevice('O', db);
    Other.songs = [orig];
    await Other.sync();
    Other.editSong('x', 'their lyric');
    await Other.save();
    // This device: a title edit pending from before the upgrade, base = markdown.
    __setDevice('A');
    await updateReplicaState({ since: row.seq - 2, rows: { song: { x: { version: 1, seq: 1, rowId: row.id } }, setlist: {} }, dirty: { song: { x: md(orig) } }, writer: true }, TEAM);
    const A = makeDevice('A', db);
    A.songs = [{ ...orig, title: 'My title' }];
    await A.sync();
    expect(A.conflicts).toEqual([]);
    expect(A.songs[0].title).toBe('My title');
    expect(md(A.songs[0])).toContain('their lyric');
    expect(row.doc.title).toBe('My title');
    expect(row.content).toContain('their lyric');
  });

  it('the conflict payload carries the document, so keep-theirs restores every arrangement', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.addSong(withExtras(mkSong('x', 'Two ways', 'lyric')));
    await A.sync();
    await B.sync();
    A.songs = [relyric(A.songs[0], 'A lyric')];
    B.songs = [relyric(B.songs[0], 'B lyric')];
    await A.save();
    await B.save();
    await B.sync();
    expect(B.conflicts).toHaveLength(1);
    expect(B.conflicts[0].remote.arrangements).toHaveLength(2); // the server copy, whole
    expect(B.songs[0].arrangements).toHaveLength(2);
  });
});

describe('fixtures', () => {
  it('mkSong round-trips through the parser', () => {
    const s = mkSong('x', 'T', 'lyric');
    expect(songFromFlat({ ...parseSongMd(md(s)), id: 'x' }).title).toBe('T');
    expect(setlistRow(mkSetlist('sl', 'N')).setlist_key).toBe('sl');
  });
});
