import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory fake of idb-keyval. The storage module imports these directly, so
// we mock the module and back it with a Map we can inspect/reset per test.
const store = new Map();
const setSpy = vi.fn();
const setManySpy = vi.fn();
const delManySpy = vi.fn();

vi.mock('idb-keyval', () => ({
  get: async (k) => store.get(k),
  set: async (k, v) => { setSpy(k, v); store.set(k, v); },
  del: async (k) => { store.delete(k); },
  getMany: async (ks) => ks.map(k => store.get(k)),
  setMany: async (entries) => { setManySpy(entries); for (const [k, v] of entries) store.set(k, v); },
  delMany: async (ks) => { delManySpy(ks); for (const k of ks) store.delete(k); },
  keys: async () => [...store.keys()],
}));

const { loadSongs, saveSongs, clearAll } = await import('../storage');

let seq = 0;
function song(overrides = {}) {
  const id = overrides.id || `s_${++seq}`;
  return {
    id, title: 'T', artist: 'A',
    defaultArrangementId: 'arr_1',
    arrangements: [{ id: 'arr_1', name: 'Main', key: 'C', sections: [] }],
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  setSpy.mockClear();
  setManySpy.mockClear();
  delManySpy.mockClear();
});

describe('per-song persistence', () => {
  it('round-trips songs through per-song keys + an index', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song();
    await saveSongs([a, b], lib);

    expect(store.has(`setlists-md:song:${lib}:${a.id}`)).toBe(true);
    expect(store.has(`setlists-md:song:${lib}:${b.id}`)).toBe(true);
    expect(store.get(`setlists-md:songidx:${lib}`).ids).toEqual([a.id, b.id]);

    const loaded = await loadSongs(lib);
    expect(loaded.map(s => s.id)).toEqual([a.id, b.id]);
  });

  it('writes only the edited song on a single-song change', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song(), c = song();
    const initial = await loadSongs(lib); // primes cache (empty)
    expect(initial).toEqual([]);
    await saveSongs([a, b, c], lib);

    setSpy.mockClear(); setManySpy.mockClear();
    // Replace only b's reference (React's immutable update pattern).
    const b2 = { ...b, title: 'Edited' };
    await saveSongs([a, b2, c], lib);

    // One setMany with exactly the edited song; index unchanged (no set).
    expect(setManySpy).toHaveBeenCalledTimes(1);
    expect(setManySpy.mock.calls[0][0]).toEqual([[`setlists-md:song:${lib}:${b.id}`, b2]]);
    expect(setSpy).not.toHaveBeenCalled(); // index not rewritten
  });

  it('no-ops when nothing changed (same references)', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song();
    await saveSongs([a, b], lib);
    setSpy.mockClear(); setManySpy.mockClear(); delManySpy.mockClear();

    await saveSongs([a, b], lib);
    expect(setSpy).not.toHaveBeenCalled();
    expect(setManySpy).not.toHaveBeenCalled();
    expect(delManySpy).not.toHaveBeenCalled();
  });

  it('deletes the removed song key and rewrites the index', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song();
    await saveSongs([a, b], lib);
    setSpy.mockClear(); delManySpy.mockClear();

    await saveSongs([a], lib);
    expect(delManySpy).toHaveBeenCalledWith([`setlists-md:song:${lib}:${b.id}`]);
    expect(store.has(`setlists-md:song:${lib}:${b.id}`)).toBe(false);
    expect(store.get(`setlists-md:songidx:${lib}`).ids).toEqual([a.id]);
  });

  it('migrates a legacy whole-library blob to per-song keys on load', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song();
    store.set(`setlists-md:songs:${lib}`, { schemaVersion: 2, songs: [a, b] });

    const loaded = await loadSongs(lib);
    expect(loaded.map(s => s.id)).toEqual([a.id, b.id]);
    // Blob removed, per-song layout written.
    expect(store.has(`setlists-md:songs:${lib}`)).toBe(false);
    expect(store.has(`setlists-md:song:${lib}:${a.id}`)).toBe(true);
    expect(store.get(`setlists-md:songidx:${lib}`).ids).toEqual([a.id, b.id]);
  });

  it('clearAll removes all per-song keys and the index', async () => {
    const lib = `lib_${++seq}`;
    const a = song(), b = song();
    await saveSongs([a, b], lib);

    await clearAll(lib);
    expect(store.has(`setlists-md:song:${lib}:${a.id}`)).toBe(false);
    expect(store.has(`setlists-md:song:${lib}:${b.id}`)).toBe(false);
    expect(store.has(`setlists-md:songidx:${lib}`)).toBe(false);
  });
});
