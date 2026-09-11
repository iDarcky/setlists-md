import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBackupMirror, isMassDelete, sanitizeFilename } from '@/sync/backup';
import { parseSongMd } from '@/parser';
import { songFromFlat } from '@/arrangements';

// One in-memory sync state for the personal library.
vi.mock('../sync/tokens', () => {
  let state = { activeProvider: 'fake', tokens: { accessToken: 't', expiresAt: Date.now() + 3600e3 }, syncManifest: {}, setlistManifest: {}, lastBackupTime: null };
  return {
    getSyncState: vi.fn(async () => JSON.parse(JSON.stringify(state))),
    updateSyncManifest: vi.fn(async (m) => { state.syncManifest = m; }),
    updateSetlistManifest: vi.fn(async (m) => { state.setlistManifest = m; }),
    updateTokens: vi.fn(async (t) => { state.tokens = { ...state.tokens, ...t }; }),
    markBackupTime: vi.fn(async (iso) => { state.lastBackupTime = iso; }),
    isTokenExpired: vi.fn(() => state.tokens?.expiresAt < Date.now()),
    __set: (patch) => { state = { ...state, ...patch }; },
    __get: () => state,
  };
});
import { __set, __get } from '@/sync/tokens';

// A folder as a provider sees it: two subfolders of { id, name, content }.
function fakeProvider() {
  let n = 0;
  const folders = { Songs: [], Setlists: [] };
  const log = [];
  const p = {
    folders, log,
    isConnected: () => true,
    setTokens: () => {},
    refreshToken: vi.fn(async () => ({ accessToken: 't2', expiresAt: Date.now() + 3600e3 })),
    ensureFolder: async () => 'root',
    listFiles: async (sub) => folders[sub].map(({ id, name }) => ({ id, name, modifiedTime: 'now', size: 1 })),
    uploadFile: async (sub, name, content) => {
      log.push(['upload', sub, name]);
      const existing = folders[sub].find(f => f.name === name);
      if (existing) { existing.content = content; return { id: existing.id, name, modifiedTime: 'now' }; }
      const f = { id: `f${++n}`, name, content };
      folders[sub].push(f);
      return { id: f.id, name, modifiedTime: 'now' };
    },
    downloadFile: async (id) => [...folders.Songs, ...folders.Setlists].find(f => f.id === id).content,
    deleteFile: async (id) => {
      log.push(['delete', id]);
      for (const sub of Object.keys(folders)) folders[sub] = folders[sub].filter(f => f.id !== id);
    },
  };
  return p;
}

const song = (id, title, lyric = 'grace') => songFromFlat({ ...parseSongMd(`---\ntitle: ${title}\nkey: C\n---\n\n## Verse 1\n[C]${lyric}\n`), id });
const setlist = (id, name) => ({ id, name, date: '2026-09-14', items: [{ songId: 's1' }] });
const names = (files) => files.map(f => f.name).sort();

let provider;
let statuses;
let mirror;
beforeEach(() => {
  __set({ activeProvider: 'fake', tokens: { accessToken: 't', expiresAt: Date.now() + 3600e3 }, syncManifest: {}, setlistManifest: {}, lastBackupTime: null });
  provider = fakeProvider();
  statuses = [];
  mirror = createBackupMirror((s) => statuses.push(s), { providerFor: () => provider });
});

describe('the backup mirror', () => {
  it('writes every song and setlist as a file, then writes nothing for an unchanged library', async () => {
    const songs = [song('s1', 'Amazing Grace'), song('s2', 'How Great')];
    const setlists = [setlist('l1', 'Sunday')];
    const r = await mirror.backupNow(songs, setlists);
    expect(r.uploaded).toEqual({ songs: 2, setlists: 1 });
    expect(names(provider.folders.Songs)).toEqual(['Amazing Grace.md', 'How Great.md']);
    expect(names(provider.folders.Setlists)).toEqual(['Sunday.json']);
    expect(provider.folders.Songs[0].content).toContain('songId: s1');
    expect(statuses.at(-1)).toMatchObject({ state: 'backed-up', provider: 'fake' });
    expect(__get().lastBackupTime).toBeTruthy();

    provider.log.length = 0;
    const again = await mirror.backupNow(songs, setlists);
    expect(again.uploaded).toEqual({ songs: 0, setlists: 0 });
    expect(provider.log).toEqual([]);
  });

  it('an edit rewrites one file; a rename replaces the old file; a delete removes it', async () => {
    let songs = [song('s1', 'Amazing Grace'), song('s2', 'How Great')];
    await mirror.backupNow(songs, []);
    provider.log.length = 0;

    songs = [song('s1', 'Amazing Grace', 'new lyric'), songs[1]];
    let r = await mirror.backupNow(songs, []);
    expect(r.uploaded.songs).toBe(1);
    expect(provider.log).toEqual([['upload', 'Songs', 'Amazing Grace.md']]);
    expect(provider.folders.Songs.find(f => f.name === 'Amazing Grace.md').content).toContain('new lyric');

    provider.log.length = 0;
    songs = [{ ...songs[0], title: 'Amazing Grace (hymn)' }, songs[1]];
    r = await mirror.backupNow(songs, []);
    expect(provider.log).toEqual([['delete', 'f1'], ['upload', 'Songs', 'Amazing Grace (hymn).md']]);
    expect(names(provider.folders.Songs)).toEqual(['Amazing Grace (hymn).md', 'How Great.md']);

    provider.log.length = 0;
    r = await mirror.backupNow([songs[0]], []);
    expect(r.deleted.songs).toBe(1);
    expect(names(provider.folders.Songs)).toEqual(['Amazing Grace (hymn).md']);
  });

  it('refuses to empty the folder from a truncated library', async () => {
    const songs = Array.from({ length: 10 }, (_, i) => song(`s${i}`, `Song ${i}`));
    await mirror.backupNow(songs, []);
    const r = await mirror.backupNow([], []);
    expect(r.deleted.songs).toBe(0);
    expect(r.errors[0].message).toMatch(/Safety guard/);
    expect(provider.folders.Songs).toHaveLength(10);
    expect(isMassDelete(8, 10)).toBe(true);
    expect(isMassDelete(3, 10)).toBe(false);
    expect(isMassDelete(9, 9)).toBe(true);
  });

  it('never reads the folder on a backup: a file edited or added there is ignored, and overwritten if it is ours', async () => {
    const songs = [song('s1', 'Amazing Grace')];
    await mirror.backupNow(songs, []);
    provider.folders.Songs[0].content = 'edited by hand in Drive';
    provider.folders.Songs.push({ id: 'x', name: 'Stranger.md', content: '---\ntitle: Stranger\n---\n' });
    const r = await mirror.backupNow(songs, []);
    expect(r.uploaded.songs).toBe(0);              // the manifest hash matches: nothing to write
    expect(provider.folders.Songs[0].content).toBe('edited by hand in Drive'); // …so the hand edit stands until the song changes
    const r2 = await mirror.backupNow([song('s1', 'Amazing Grace', 'changed')], []);
    expect(r2.uploaded.songs).toBe(1);
    expect(provider.folders.Songs[0].content).toContain('changed');
    expect(provider.folders.Songs.find(f => f.name === 'Stranger.md')).toBeTruthy(); // not ours: untouched
  });

  it('restore hands back what the folder holds, under the ids the files carry', async () => {
    await mirror.backupNow([song('s1', 'Amazing Grace')], [setlist('l1', 'Sunday')]);
    provider.folders.Songs.push({ id: 'x', name: 'Hand-made.md', content: '---\ntitle: Hand made\nkey: D\n---\n\n## Chorus\n[D]la\n' });
    const r = await mirror.restore();
    expect(r.songs.map(s => s.id).includes('s1')).toBe(true);
    expect(r.songs.find(s => s.title === 'Hand made')).toBeTruthy();
    expect(r.songs.find(s => s.title === 'Hand made').id).toBeTruthy();
    expect(r.setlists.map(s => s.id)).toEqual(['l1']);
    expect(r.errors).toEqual([]);
  });

  it('a debounced backup folds edits and a flush writes them now', async () => {
    vi.useFakeTimers();
    try {
      mirror.debouncedBackup([song('s1', 'One')], []);
      mirror.debouncedBackup([song('s1', 'One'), song('s2', 'Two')], []);
      expect(provider.folders.Songs).toHaveLength(0);
      await vi.runAllTimersAsync();
      expect(names(provider.folders.Songs)).toEqual(['One.md', 'Two.md']);
      mirror.debouncedBackup([song('s1', 'One'), song('s2', 'Two'), song('s3', 'Three')], []);
      await mirror.flushPending([song('s1', 'One'), song('s2', 'Two'), song('s3', 'Three')], []);
      expect(names(provider.folders.Songs)).toEqual(['One.md', 'Three.md', 'Two.md']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing without a connected folder, and reports an expired sign-in as needs-reconnect', async () => {
    __set({ activeProvider: null });
    const r = await mirror.backupNow([song('s1', 'One')], []);
    expect(r.skipped).toBe(true);
    expect(provider.folders.Songs).toHaveLength(0);

    __set({ activeProvider: 'fake', tokens: { accessToken: 't', expiresAt: 1 } });
    provider.refreshToken.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'reconnect_required' }));
    await mirror.backupNow([song('s1', 'One')], []);
    expect(statuses.at(-1)).toMatchObject({ state: 'needs-reconnect', provider: 'fake' });
    expect(provider.folders.Songs).toHaveLength(0);
  });

  it('file names are safe and stable', () => {
    expect(sanitizeFilename('What A Friend / We: Have?')).toBe('What A Friend We Have');
    expect(sanitizeFilename('')).toBe('Untitled');
    expect(sanitizeFilename('  spaced   out ')).toBe('spaced out');
  });
});
