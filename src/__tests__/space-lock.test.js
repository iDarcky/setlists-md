import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReplicaEngine } from '@/sync/replica-engine';
import { markOrigin, originOf, ownItems } from '@/sync/provenance';
import { createFakeClient, mkSong, noTombstones } from '@/__tests__/helpers/fakeSupabase';

vi.mock('../sync/tokens', () => {
  const states = new Map();
  const get = (lib) => {
    if (!states.has(lib)) {
      states.set(lib, { activeProvider: null, tokens: null, lastSyncTime: null, syncManifest: {}, setlistManifest: {}, replica: null });
    }
    return states.get(lib);
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
    __resetSyncStates: () => { states.clear(); },
  };
});

import { __resetSyncStates } from '@/sync/tokens';

const CHURCH = 'church-1';

beforeEach(() => { __resetSyncStates(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('provenance', () => {
  it('stamps objects without changing them and filters foreign ones', () => {
    const a = mkSong('a', 'A');
    const b = mkSong('b', 'B');
    const fresh = mkSong('c', 'C');
    const before = JSON.stringify(a);
    markOrigin([a], 'other-church');
    markOrigin([b], CHURCH);
    expect(JSON.stringify(a)).toBe(before);
    expect(originOf(a)).toBe('other-church');
    expect(originOf(fresh)).toBeUndefined();

    const foreign = [];
    const kept = ownItems([a, b, fresh], CHURCH, (x) => foreign.push(x));
    expect(kept).toEqual([b, fresh]);
    expect(foreign).toEqual([a]);

    const same = [b, fresh];
    expect(ownItems(same, CHURCH)).toBe(same);
  });
});

describe('space lock — an engine only uploads its own Space', () => {
  it('a church engine handed another library\'s songs pushes nothing for them', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const engine = createReplicaEngine(() => {}, CHURCH, { client: createFakeClient(db), onPullNeeded: () => {} });
    await engine.fullSync([], [], noTombstones());

    const other = markOrigin([mkSong('p1', 'Mare ești'), mkSong('p2', 'Tu ești vrednic')], 'other-church');
    const mine = mkSong('c1', 'New church song');
    const songs = [...other, mine];

    engine.debouncedPush(songs, [], noTombstones(), () => {});
    await engine.flushPending(songs, [], noTombstones(), () => {});

    expect(db.team_songs.map(r => r.song_key)).toEqual(['c1']);

    // A full sync with the same leaked state uploads nothing more and drops them.
    const r = await engine.fullSync(songs, [], noTombstones());
    expect(db.team_songs.map(r2 => r2.song_key)).toEqual(['c1']);
    if (r.replaced) expect(r.songs.map(s => s.id)).not.toContain('p1');
  });

  it('songs pulled by one Space are stamped with it and refused by another', async () => {
    const db = { team_songs: [], team_setlists: [], __rpcs: [] };
    const church = createReplicaEngine(() => {}, CHURCH, { client: createFakeClient(db), onPullNeeded: () => {} });
    await church.fullSync([mkSong('c1', 'Church song')], [], noTombstones());
    const r = await church.fullSync([mkSong('c1', 'Church song')], [], noTombstones());
    const pulled = r.replaced ? r.songs : [];
    if (pulled.length) expect(originOf(pulled[0])).toBe(CHURCH);

    const otherDb = { team_songs: [], team_setlists: [], __rpcs: [] };
    const band = createReplicaEngine(() => {}, 'band-2', { client: createFakeClient(otherDb), onPullNeeded: () => {} });
    await band.fullSync([], [], noTombstones());
    const leaked = markOrigin([mkSong('c1', 'Church song')], CHURCH);
    band.debouncedPush(leaked, [], noTombstones(), () => {});
    await band.flushPending(leaked, [], noTombstones(), () => {});
    expect(otherDb.team_songs).toHaveLength(0);
  });
});
