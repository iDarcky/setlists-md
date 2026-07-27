import { describe, it, expect } from 'vitest';
import { exportSetlistZip, importSetlistZip } from '@/setlist-io';

// JSZip in Node.js doesn't accept the global Blob type; convert to ArrayBuffer.
async function blobToBuffer(blob) {
  return blob.arrayBuffer();
}

// ─── fixtures ────────────────────────────────────────────────────────────────

function makeSong(overrides = {}) {
  return {
    id: 'song_abc',
    title: 'Amazing Grace',
    artist: 'Traditional',
    ccli: '',
    tags: [],
    spotify: '',
    youtube: '',
    keyHistory: {},
    defaultArrangementId: 'arr_main',
    arrangements: [{
      id: 'arr_main',
      name: 'Main Arrangement',
      key: 'G',
      tempo: 72,
      time: '3/4',
      capo: 0,
      notes: '',
      structure: ['Verse 1'],
      sections: [{ name: 'Verse 1', lines: ['[G]Amazing grace how sweet the sound'] }],
      updatedAt: 1000,
    }],
    updatedAt: 1000,
    ...overrides,
  };
}

function makeSetlist(songId, arrangementId) {
  return {
    id: 'sl_abc',
    name: 'Sunday Morning',
    date: '2026-06-07',
    service: 'Morning',
    items: [{ songId, arrangementId, transpose: 0, capo: 0, note: '' }],
  };
}

// ─── export ──────────────────────────────────────────────────────────────────

describe('exportSetlistZip', () => {
  it('returns a Blob with non-zero size', async () => {
    const song = makeSong();
    const setlist = makeSetlist(song.id, 'arr_main');
    const blob = await exportSetlistZip(setlist, [song]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces a zip containing _setlist.json', async () => {
    const JSZip = (await import('jszip')).default;
    const song = makeSong();
    const setlist = makeSetlist(song.id, 'arr_main');
    const buf = await blobToBuffer(await exportSetlistZip(setlist, [song]));
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file('_setlist.json')).not.toBeNull();
  });

  it('includes a .md file for each song', async () => {
    const JSZip = (await import('jszip')).default;
    const song = makeSong();
    const setlist = makeSetlist(song.id, 'arr_main');
    const buf = await blobToBuffer(await exportSetlistZip(setlist, [song]));
    const zip = await JSZip.loadAsync(buf);
    const mdFiles = Object.keys(zip.files).filter(f => f.endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('writes correct setlist metadata into _setlist.json', async () => {
    const JSZip = (await import('jszip')).default;
    const song = makeSong();
    const setlist = makeSetlist(song.id, 'arr_main');
    const buf = await blobToBuffer(await exportSetlistZip(setlist, [song]));
    const zip = await JSZip.loadAsync(buf);
    const manifest = JSON.parse(await zip.file('_setlist.json').async('string'));
    expect(manifest.name).toBe('Sunday Morning');
    expect(manifest.date).toBe('2026-06-07');
    expect(manifest.service).toBe('Morning');
    expect(manifest.items).toHaveLength(1);
  });

  it('does not duplicate the .md file when a song appears multiple times', async () => {
    const JSZip = (await import('jszip')).default;
    const song = makeSong();
    const setlist = {
      ...makeSetlist(song.id, 'arr_main'),
      items: [
        { songId: song.id, arrangementId: 'arr_main', transpose: 0, capo: 0, note: '' },
        { songId: song.id, arrangementId: 'arr_main', transpose: 2, capo: 0, note: 'key of A' },
      ],
    };
    const buf = await blobToBuffer(await exportSetlistZip(setlist, [song]));
    const zip = await JSZip.loadAsync(buf);
    const mdFiles = Object.keys(zip.files).filter(f => f.endsWith('.md'));
    expect(mdFiles).toHaveLength(1);
  });

  it('serializes break items into the manifest without a .md file', async () => {
    const JSZip = (await import('jszip')).default;
    const song = makeSong();
    const setlist = {
      id: 'sl_1', name: 'S', date: '2026-01-01', service: 'Morning',
      items: [
        { type: 'break', label: 'Prayer', note: 'Pray for the offering', duration: 180 },
        { songId: song.id, arrangementId: 'arr_main', transpose: 0, capo: 0, note: '' },
      ],
    };
    const buf = await blobToBuffer(await exportSetlistZip(setlist, [song]));
    const zip = await JSZip.loadAsync(buf);
    const manifest = JSON.parse(await zip.file('_setlist.json').async('string'));
    expect(manifest.items[0].type).toBe('break');
    expect(manifest.items[0].label).toBe('Prayer');
  });

  it('skips items whose songId is not found in the library', async () => {
    const JSZip = (await import('jszip')).default;
    const setlist = {
      id: 'sl_1', name: 'S', date: '2026-01-01', service: 'Morning',
      items: [{ songId: 'ghost_id', arrangementId: 'arr_1', transpose: 0, capo: 0, note: '' }],
    };
    const buf = await blobToBuffer(await exportSetlistZip(setlist, []));
    const zip = await JSZip.loadAsync(buf);
    const manifest = JSON.parse(await zip.file('_setlist.json').async('string'));
    expect(manifest.items).toHaveLength(0);
  });
});

// ─── round-trip ──────────────────────────────────────────────────────────────

describe('exportSetlistZip → importSetlistZip round-trip', () => {
  async function roundTrip(setlist, songs, existing = []) {
    const buf = await blobToBuffer(await exportSetlistZip(setlist, songs));
    return importSetlistZip(buf, existing);
  }

  it('reconstructs the setlist name, date and service', async () => {
    const song = makeSong();
    const { setlist: imported } = await roundTrip(makeSetlist(song.id, 'arr_main'), [song]);
    expect(imported.name).toBe('Sunday Morning');
    expect(imported.date).toBe('2026-06-07');
    expect(imported.service).toBe('Morning');
  });

  it('reconstructs one new song with the correct title and artist', async () => {
    const song = makeSong();
    const { newSongs } = await roundTrip(makeSetlist(song.id, 'arr_main'), [song]);
    expect(newSongs).toHaveLength(1);
    expect(newSongs[0].title).toBe('Amazing Grace');
    expect(newSongs[0].artist).toBe('Traditional');
  });

  it('preserves the original song id via songId frontmatter', async () => {
    const song = makeSong();
    const { newSongs } = await roundTrip(makeSetlist(song.id, 'arr_main'), [song]);
    expect(newSongs[0].id).toBe('song_abc');
  });

  it('links the setlist item to the reconstructed song', async () => {
    const song = makeSong();
    const { setlist: imported, newSongs } = await roundTrip(makeSetlist(song.id, 'arr_main'), [song]);
    expect(imported.items).toHaveLength(1);
    expect(imported.items[0].songId).toBe(newSongs[0].id);
  });

  it('does not add a new song when it already exists in the library', async () => {
    const song = makeSong();
    const { newSongs } = await roundTrip(makeSetlist(song.id, 'arr_main'), [song], [song]);
    expect(newSongs).toHaveLength(0);
  });

  it('round-trips break items', async () => {
    const song = makeSong();
    const setlist = {
      id: 'sl_1', name: 'S', date: '2026-01-01', service: 'Morning',
      items: [
        { type: 'break', label: 'Offering', note: 'Pass the plate', duration: 120 },
        { songId: song.id, arrangementId: 'arr_main', transpose: 0, capo: 0, note: '' },
      ],
    };
    const { setlist: imported } = await roundTrip(setlist, [song]);
    expect(imported.items[0].type).toBe('break');
    expect(imported.items[0].label).toBe('Offering');
    expect(imported.items[1].songId).toBeDefined();
  });

  it('falls back to title+artist matching when no songId in frontmatter', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('my-song.md', [
      '---',
      'title: My Song',
      'artist: My Artist',
      'key: C',
      '---',
      '',
      '## Verse 1',
      '[C]Hello world',
    ].join('\n'));
    zip.file('_setlist.json', JSON.stringify({
      name: 'Test', date: '2026-01-01', service: 'Morning',
      items: [{ file: 'my-song.md', transpose: 0, capo: 0, note: '' }],
    }));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { newSongs, setlist } = await importSetlistZip(buf, []);
    expect(newSongs).toHaveLength(1);
    expect(newSongs[0].title).toBe('My Song');
    expect(setlist.items[0].songId).toBe(newSongs[0].id);
  });

  it('matches by title+artist when song already exists and has no songId', async () => {
    const JSZip = (await import('jszip')).default;
    const existingSong = makeSong({ id: 'existing_id', title: 'My Song', artist: 'My Artist' });
    const zip = new JSZip();
    zip.file('my-song.md', [
      '---',
      'title: My Song',
      'artist: My Artist',
      'key: G',
      '---',
    ].join('\n'));
    zip.file('_setlist.json', JSON.stringify({
      name: 'Test', date: '2026-01-01', service: 'Morning',
      items: [{ file: 'my-song.md', transpose: 0, capo: 0, note: '' }],
    }));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const { newSongs, setlist } = await importSetlistZip(buf, [existingSong]);
    expect(newSongs).toHaveLength(0);
    expect(setlist.items[0].songId).toBe('existing_id');
  });
});
