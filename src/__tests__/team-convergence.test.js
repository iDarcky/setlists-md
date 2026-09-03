import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamSyncEngine } from '@/sync/team-engine';
import { songToMd } from '@/parser';
import { createFakeClient, mkSong, mkSetlist, noTombstones } from '@/__tests__/helpers/fakeSupabase';

// ── Two-device harness ────────────────────────────────────────────────────────
// Each simulated device runs its own engine against ONE shared fake server,
// but must keep its OWN local sync state (manifests). The engine keys its
// persisted state by libraryId (= the team id, identical on both devices), so
// the tokens mock namespaces the store by a switchable "current device".

vi.mock('../sync/tokens', () => {
  const states = new Map();
  let device = 'A';
  const keyOf = (lib) => `${device}:${lib}`;
  const get = (lib) => {
    if (!states.has(keyOf(lib))) {
      states.set(keyOf(lib), { activeProvider: null, tokens: null, lastSyncTime: null, syncManifest: {}, setlistManifest: {} });
    }
    return states.get(keyOf(lib));
  };
  return {
    getSyncState: vi.fn(async (lib) => ({ ...get(lib) })),
    updateSyncManifest: vi.fn(async (m, lib) => { get(lib).syncManifest = m; }),
    updateSetlistManifest: vi.fn(async (m, lib) => { get(lib).setlistManifest = m; }),
    setPendingPush: vi.fn(async (p, lib) => { get(lib).pendingPush = p; }),
    setHashVersion: vi.fn(async (v, lib) => { get(lib).hashVersion = v; }),
    updateTokens: vi.fn(),
    isTokenExpired: vi.fn(() => false),
    __setDevice: (d) => { device = d; },
    __resetSyncStates: () => { states.clear(); },
  };
});

import { __setDevice, __resetSyncStates } from '@/sync/tokens';

const TEAM = 'team-1';

function makeDevice(name, db) {
  const engine = createTeamSyncEngine(() => {}, TEAM, { client: createFakeClient(db) });
  return {
    name,
    songs: [],
    setlists: [],
    tombstones: noTombstones(),
    conflicts: [],
    // Mirrors App's adoption of a server-authoritative result.
    async sync() {
      __setDevice(name);
      const r = await engine.fullSync(this.songs, this.setlists, this.tombstones);
      this.songs = r.songs;
      this.setlists = r.setlists;
      this.tombstones = r.tombstones;
      this.conflicts.push(...(r.conflicts || []));
      return r;
    },
    addSong(song) { this.songs = [...this.songs, song]; },
    editSong(id, lyric) {
      this.songs = this.songs.map(s => (s.id === id ? mkSong(id, s.title, lyric) : s));
    },
    deleteSong(id) {
      this.songs = this.songs.filter(s => s.id !== id);
      this.tombstones = { ...this.tombstones, songs: [...this.tombstones.songs, { id, deletedAt: Date.now() + 1 }] };
    },
  };
}

// Library fingerprint: id → serialized content. Convergence = equal maps.
const fingerprint = (songs) => new Map(songs.map(s => [s.id, songToMd(s)]));
function expectConverged(...devices) {
  const [first, ...rest] = devices.map(d => fingerprint(d.songs));
  for (const other of rest) {
    expect([...other.keys()].sort()).toEqual([...first.keys()].sort());
    for (const [id, md] of first) expect(other.get(id)).toBe(md);
  }
}

beforeEach(() => {
  __resetSyncStates();
});

describe('two-device convergence', () => {
  it('a song created on A reaches B, and steady state stays silent', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);

    A.addSong(mkSong('s1', 'New Song', 'written on A'));
    await A.sync();
    await B.sync();

    expectConverged(A, B);
    expect(songToMd(B.songs[0])).toContain('written on A');

    // Nothing changed → neither device uploads or conflicts again.
    const a2 = await A.sync();
    const b2 = await B.sync();
    expect(a2.uploaded.songs + b2.uploaded.songs).toBe(0);
    expect(A.conflicts).toHaveLength(0);
    expect(B.conflicts).toHaveLength(0);
  });

  it('an edit on A propagates to B without a conflict', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.addSong(mkSong('s1', 'Shared', 'v1'));
    await A.sync();
    await B.sync();

    A.editSong('s1', 'v2 from A');
    await A.sync();
    await B.sync();

    expectConverged(A, B);
    expect(songToMd(B.songs[0])).toContain('v2 from A');
    expect(B.conflicts).toHaveLength(0);
  });

  it('concurrent edits: server copy wins everywhere, loser gets a conflict carrying both sides', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.addSong(mkSong('s1', 'Contested', 'base'));
    await A.sync();
    await B.sync();

    A.editSong('s1', 'A wins');
    B.editSong('s1', 'B loses');
    await A.sync(); // A lands first
    await B.sync(); // B pulls A's version; its own edit becomes a conflict

    expect(B.conflicts).toHaveLength(1);
    expect(songToMd(B.conflicts[0].local)).toContain('B loses'); // nothing lost
    expect(songToMd(B.conflicts[0].remote)).toContain('A wins');
    await A.sync();
    expectConverged(A, B);
    expect(songToMd(A.songs[0])).toContain('A wins');
    expect(db.team_songs).toHaveLength(1);
  });

  it('a delete on A propagates to B', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);
    A.addSong(mkSong('s1', 'Doomed', 'x'));
    A.addSong(mkSong('s2', 'Keeper', 'y'));
    await A.sync();
    await B.sync();

    A.deleteSong('s1');
    await A.sync();
    await B.sync();

    expectConverged(A, B);
    expect(A.songs.map(s => s.id)).toEqual(['s2']);
    expect(db.team_songs).toHaveLength(1);
  });

  it('interleaved creates on both devices merge without duplicates', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);

    A.addSong(mkSong('x', 'From A', 'a'));
    B.addSong(mkSong('y', 'From B', 'b'));
    await A.sync();
    await B.sync();
    await A.sync();

    expectConverged(A, B);
    expect(A.songs.map(s => s.id).sort()).toEqual(['x', 'y']);
    expect(db.team_songs).toHaveLength(2);
  });

  it('the same song imported on both devices lands as ONE server row', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);

    // e.g. both members import the same .zip (identical embedded ids).
    A.addSong(mkSong('shared', 'Imported', 'same content'));
    B.addSong(mkSong('shared', 'Imported', 'same content'));
    await A.sync();
    await B.sync();
    await A.sync();

    expectConverged(A, B);
    expect(db.team_songs).toHaveLength(1);
  });

  it('setlists converge too', async () => {
    const db = { team_songs: [], team_setlists: [] };
    const A = makeDevice('A', db);
    const B = makeDevice('B', db);

    A.setlists = [mkSetlist('sl1', 'Sunday Service')];
    await A.sync();
    await B.sync();
    expect(B.setlists.map(sl => sl.id)).toEqual(['sl1']);

    // B renames it; A picks it up.
    B.setlists = B.setlists.map(sl => ({ ...sl, name: 'Sunday PM' }));
    await B.sync();
    await A.sync();
    expect(A.setlists[0].name).toBe('Sunday PM');
    expect(db.team_setlists).toHaveLength(1);
  });

  it('randomized interleaving converges with no data loss (seeded fuzz)', async () => {
    // Deterministic PRNG so a failure is reproducible.
    let seed = 0xC0FFEE;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const db = { team_songs: [], team_setlists: [] };
    const devices = [makeDevice('A', db), makeDevice('B', db)];
    let songN = 0;

    for (let step = 0; step < 60; step++) {
      const d = devices[Math.floor(rand() * devices.length)];
      const roll = rand();
      if (roll < 0.3) {
        d.addSong(mkSong(`f${songN}`, `Fuzz ${songN}`, `born on ${d.name}`));
        songN += 1;
      } else if (roll < 0.55 && d.songs.length > 0) {
        const target = d.songs[Math.floor(rand() * d.songs.length)];
        d.editSong(target.id, `edited on ${d.name} at step ${step}`);
      } else if (roll < 0.65 && d.songs.length > 1) {
        d.deleteSong(d.songs[Math.floor(rand() * d.songs.length)].id);
      } else {
        await d.sync();
      }
    }

    // Quiesce: everyone syncs until steady state.
    for (let i = 0; i < 3; i++) {
      for (const d of devices) await d.sync();
    }

    expectConverged(...devices);
    // Server mirrors the converged set exactly — no orphan or duplicate rows.
    expect(db.team_songs.length).toBe(devices[0].songs.length);
    const serverKeys = db.team_songs.map(r => r.song_key).sort();
    expect(serverKeys).toEqual(devices[0].songs.map(s => s.id).sort());
  });
});
