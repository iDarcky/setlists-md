import { describe, it, expect } from 'vitest';
import {
  getArrangement,
  resolveSongView,
  withArrangement,
  addArrangement,
  deleteArrangement,
  renameArrangement,
  setDefaultArrangement,
  songFromFlat,
} from '../arrangements';
import { parseSongMd, songToMd } from '../parser';

// ─── fixtures ────────────────────────────────────────────────────────────────

const arr1 = { id: 'arr_1', name: 'Main', key: 'G', tempo: 120, time: '4/4', capo: 0, notes: '', structure: [], sections: [] };
const arr2 = { id: 'arr_2', name: 'Acoustic', key: 'D', tempo: 90, time: '3/4', capo: 2, notes: 'capo notes', structure: ['Verse'], sections: [] };

const baseSong = {
  id: 'song_1',
  title: 'Test Song',
  artist: 'Test Artist',
  ccli: '123',
  tags: ['worship'],
  spotify: '',
  youtube: '',
  keyHistory: {},
  defaultArrangementId: 'arr_1',
  arrangements: [arr1, arr2],
  updatedAt: 1000,
};

// ─── getArrangement ───────────────────────────────────────────────────────────

describe('getArrangement', () => {
  it('returns null for null / undefined song', () => {
    expect(getArrangement(null, 'arr_1')).toBe(null);
    expect(getArrangement(undefined, 'arr_1')).toBe(null);
  });

  it('returns null when arrangements is missing or empty', () => {
    expect(getArrangement({}, 'arr_1')).toBe(null);
    expect(getArrangement({ arrangements: [] }, 'arr_1')).toBe(null);
    expect(getArrangement({ arrangements: null }, 'arr_1')).toBe(null);
  });

  it('returns the matching arrangement by id', () => {
    expect(getArrangement(baseSong, 'arr_2')).toBe(arr2);
  });

  it('falls back to the default arrangement when id not found', () => {
    expect(getArrangement(baseSong, 'arr_unknown')).toBe(arr1);
  });

  it('falls back to the default arrangement when no id supplied', () => {
    expect(getArrangement(baseSong, undefined)).toBe(arr1);
    expect(getArrangement(baseSong, null)).toBe(arr1);
  });

  it('falls back to the first arrangement when defaultArrangementId is also missing', () => {
    const song = { ...baseSong, defaultArrangementId: undefined };
    expect(getArrangement(song, 'arr_unknown')).toBe(arr1);
  });

  it('falls back to first arrangement when defaultArrangementId points to nothing', () => {
    const song = { ...baseSong, defaultArrangementId: 'arr_gone' };
    expect(getArrangement(song, null)).toBe(arr1);
  });
});

// ─── resolveSongView ──────────────────────────────────────────────────────────

describe('resolveSongView', () => {
  it('returns null for null song', () => {
    expect(resolveSongView(null)).toBe(null);
  });

  it('returns null when no arrangement can be resolved', () => {
    expect(resolveSongView({ id: 'x', arrangements: [] })).toBe(null);
  });

  it('flattens song + arrangement into a single view object', () => {
    const view = resolveSongView(baseSong, 'arr_1');
    expect(view.id).toBe('song_1');
    expect(view.title).toBe('Test Song');
    expect(view.artist).toBe('Test Artist');
    expect(view.key).toBe('G');
    expect(view.tempo).toBe(120);
    expect(view.time).toBe('4/4');
    expect(view.capo).toBe(0);
  });

  it('exposes arrangement metadata on underscore-prefixed keys', () => {
    const view = resolveSongView(baseSong, 'arr_1');
    expect(view._arrangementId).toBe('arr_1');
    expect(view._arrangementName).toBe('Main');
    expect(view._arrangementCount).toBe(2);
    expect(view._defaultArrangementId).toBe('arr_1');
    expect(view._allArrangements).toBe(baseSong.arrangements);
  });

  it('resolves the correct arrangement when id is supplied', () => {
    const view = resolveSongView(baseSong, 'arr_2');
    expect(view.key).toBe('D');
    expect(view.capo).toBe(2);
    expect(view._arrangementId).toBe('arr_2');
  });

  it('fills safe defaults for absent optional fields', () => {
    const minimal = {
      id: 's', title: 'T', artist: 'A',
      defaultArrangementId: 'a1',
      arrangements: [{ id: 'a1', name: 'Main', key: 'C', sections: [], structure: [] }],
    };
    const view = resolveSongView(minimal);
    expect(view.ccli).toBe('');
    expect(view.tags).toEqual([]);
    expect(view.spotify).toBe('');
    expect(view.youtube).toBe('');
    expect(view.keyHistory).toEqual({});
    expect(view.capo).toBe(0);
    expect(view.notes).toBe('');
    expect(view.duration).toBe('');
  });
});

// ─── withArrangement ──────────────────────────────────────────────────────────

describe('withArrangement', () => {
  it('returns the original value for null / no-arrangements song', () => {
    expect(withArrangement(null, 'arr_1', a => a)).toBe(null);
    const noArrs = { id: 'x' };
    expect(withArrangement(noArrs, 'arr_1', a => a)).toBe(noArrs);
  });

  it('applies the mutator to the matching arrangement', () => {
    const updated = withArrangement(baseSong, 'arr_1', a => ({ ...a, key: 'A' }));
    expect(updated.arrangements.find(a => a.id === 'arr_1').key).toBe('A');
  });

  it('preserves the arrangement id regardless of what the mutator returns', () => {
    const updated = withArrangement(baseSong, 'arr_1', a => ({ ...a, id: 'hacked' }));
    expect(updated.arrangements.find(a => a.id === 'arr_1').id).toBe('arr_1');
  });

  it('does not mutate non-matching arrangements', () => {
    const updated = withArrangement(baseSong, 'arr_1', a => ({ ...a, key: 'A' }));
    expect(updated.arrangements.find(a => a.id === 'arr_2').key).toBe('D');
  });

  it('updates song-level updatedAt', () => {
    const before = baseSong.updatedAt;
    const updated = withArrangement(baseSong, 'arr_1', a => a);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

// ─── addArrangement ───────────────────────────────────────────────────────────

describe('addArrangement', () => {
  it('returns a song with one additional arrangement', () => {
    const { song } = addArrangement(baseSong, 'Live');
    expect(song.arrangements).toHaveLength(3);
  });

  it('returns the new arrangement id', () => {
    const { arrangementId } = addArrangement(baseSong, 'Live');
    expect(typeof arrangementId).toBe('string');
    expect(arrangementId.length).toBeGreaterThan(0);
  });

  it('uses the provided name', () => {
    const { song, arrangementId } = addArrangement(baseSong, 'Live');
    const arr = song.arrangements.find(a => a.id === arrangementId);
    expect(arr.name).toBe('Live');
  });

  it('generates a default name when none provided', () => {
    const { song, arrangementId } = addArrangement(baseSong);
    const arr = song.arrangements.find(a => a.id === arrangementId);
    expect(arr.name).toMatch(/Arrangement/i);
  });

  it('seeds key/tempo/time from the default arrangement', () => {
    const { song, arrangementId } = addArrangement(baseSong);
    const arr = song.arrangements.find(a => a.id === arrangementId);
    expect(arr.key).toBe(arr1.key);
    expect(arr.tempo).toBe(arr1.tempo);
    expect(arr.time).toBe(arr1.time);
  });

  it('seeds from the provided base when given', () => {
    const base = { key: 'E', tempo: 150, time: '6/8' };
    const { song, arrangementId } = addArrangement(baseSong, 'Custom', base);
    const arr = song.arrangements.find(a => a.id === arrangementId);
    expect(arr.key).toBe('E');
    expect(arr.tempo).toBe(150);
    expect(arr.time).toBe('6/8');
  });

  it('starts with empty structure, sections, notes and capo=0', () => {
    const { song, arrangementId } = addArrangement(baseSong, 'X');
    const arr = song.arrangements.find(a => a.id === arrangementId);
    expect(arr.structure).toEqual([]);
    expect(arr.sections).toEqual([]);
    expect(arr.notes).toBe('');
    expect(arr.capo).toBe(0);
  });

  it('does not mutate the original song', () => {
    addArrangement(baseSong, 'X');
    expect(baseSong.arrangements).toHaveLength(2);
  });
});

// ─── deleteArrangement ────────────────────────────────────────────────────────

describe('deleteArrangement', () => {
  it('throws when song has only one arrangement', () => {
    const single = { ...baseSong, arrangements: [arr1] };
    expect(() => deleteArrangement(single, 'arr_1')).toThrow();
  });

  it('removes the specified arrangement', () => {
    const updated = deleteArrangement(baseSong, 'arr_2');
    expect(updated.arrangements).toHaveLength(1);
    expect(updated.arrangements[0].id).toBe('arr_1');
  });

  it('leaves defaultArrangementId unchanged when deleting a non-default arrangement', () => {
    const updated = deleteArrangement(baseSong, 'arr_2');
    expect(updated.defaultArrangementId).toBe('arr_1');
  });

  it('transfers defaultArrangementId to the first remaining when deleting the default', () => {
    const updated = deleteArrangement(baseSong, 'arr_1');
    expect(updated.defaultArrangementId).toBe('arr_2');
  });

  it('returns the original for null / no-arrangements song', () => {
    expect(deleteArrangement(null, 'arr_1')).toBe(null);
    const noArrs = { id: 'x' };
    expect(deleteArrangement(noArrs, 'arr_1')).toBe(noArrs);
  });
});

// ─── renameArrangement ────────────────────────────────────────────────────────

describe('renameArrangement', () => {
  it('updates the name of the matching arrangement', () => {
    const updated = renameArrangement(baseSong, 'arr_1', 'Studio');
    expect(updated.arrangements.find(a => a.id === 'arr_1').name).toBe('Studio');
  });

  it('does not affect other arrangements', () => {
    const updated = renameArrangement(baseSong, 'arr_1', 'Studio');
    expect(updated.arrangements.find(a => a.id === 'arr_2').name).toBe('Acoustic');
  });
});

// ─── setDefaultArrangement ────────────────────────────────────────────────────

describe('setDefaultArrangement', () => {
  it('updates defaultArrangementId', () => {
    const updated = setDefaultArrangement(baseSong, 'arr_2');
    expect(updated.defaultArrangementId).toBe('arr_2');
  });

  it('returns original song when id does not exist in arrangements', () => {
    const updated = setDefaultArrangement(baseSong, 'arr_ghost');
    expect(updated).toBe(baseSong);
  });

  it('returns original song for null/no-arrangements input', () => {
    expect(setDefaultArrangement(null, 'arr_1')).toBe(null);
    const noArrs = { id: 'x' };
    expect(setDefaultArrangement(noArrs, 'arr_1')).toBe(noArrs);
  });
});

// ─── songFromFlat ─────────────────────────────────────────────────────────────

describe('songFromFlat', () => {
  const flat = {
    id: 'song_flat',
    title: 'Flat Song',
    artist: 'Flat Artist',
    key: 'A',
    tempo: 100,
    time: '4/4',
    capo: 1,
    notes: 'some notes',
    structure: ['Verse', 'Chorus'],
    sections: [{ name: 'Verse', lines: [] }],
    ccli: '999',
    tags: ['fast'],
    spotify: 'https://spotify',
    youtube: 'https://youtube',
    keyHistory: { G: 3 },
  };

  it('creates a valid v2 song with one arrangement', () => {
    const song = songFromFlat(flat);
    expect(song.id).toBe('song_flat');
    expect(song.title).toBe('Flat Song');
    expect(song.arrangements).toHaveLength(1);
  });

  it('copies musical fields into the arrangement', () => {
    const song = songFromFlat(flat);
    const arr = song.arrangements[0];
    expect(arr.key).toBe('A');
    expect(arr.tempo).toBe(100);
    expect(arr.time).toBe('4/4');
    expect(arr.capo).toBe(1);
    expect(arr.notes).toBe('some notes');
    expect(arr.structure).toEqual(['Verse', 'Chorus']);
  });

  it('copies top-level identity fields onto the song', () => {
    const song = songFromFlat(flat);
    expect(song.ccli).toBe('999');
    expect(song.tags).toEqual(['fast']);
    expect(song.keyHistory).toEqual({ G: 3 });
  });

  it('preserves a provided arrangementId', () => {
    const song = songFromFlat({ ...flat, arrangementId: 'arr_fixed' });
    expect(song.arrangements[0].id).toBe('arr_fixed');
    expect(song.defaultArrangementId).toBe('arr_fixed');
  });

  it('generates an arrangementId when none provided', () => {
    const song = songFromFlat(flat);
    expect(typeof song.defaultArrangementId).toBe('string');
    expect(song.defaultArrangementId.length).toBeGreaterThan(0);
  });

  it('fills safe defaults for absent optional fields', () => {
    const song = songFromFlat({ id: 'x', title: 'T', artist: 'A' });
    expect(song.ccli).toBe('');
    expect(song.tags).toEqual([]);
    expect(song.arrangements[0].capo).toBe(0);
    expect(song.arrangements[0].notes).toBe('');
    expect(song.arrangements[0].structure).toEqual([]);
    expect(song.arrangements[0].sections).toEqual([]);
  });

  it('defaults title and artist when absent', () => {
    const song = songFromFlat({ id: 'x' });
    expect(song.title).toBe('Untitled');
    expect(song.artist).toBe('Unknown');
  });
});

// The sync engine compares a hash of the STORED markdown against a hash of the
// freshly re-serialized song. If the round-trip isn't byte-stable, every sync
// thinks the song changed and re-uploads it forever — which caused "edited"
// spam, identity churn, and duplicate/lost songs. resolveSongView must carry
// `_songId` so songToMd re-emits the `songId:` identity it was stored with.
describe('markdown round-trip is byte-stable (sync stability)', () => {
  const roundTrip = (content) => {
    const parsed = parseSongMd(content);
    const rebuilt = songFromFlat({ ...parsed, id: parsed.id || parsed.songId || 'x' });
    const view = resolveSongView(rebuilt, rebuilt.defaultArrangementId);
    return songToMd(view);
  };

  it('preserves songId/arrangementId identity across a re-serialize', () => {
    const content = [
      '---',
      'title: Aduceți ca jerfă mulțumiri',
      'artist: Chris Tomlin',
      'key: G',
      'tempo: 127',
      'time: 4/4',
      'structure: [Verse 1, Chorus 1]',
      'songId: mppfa60mx7t2lr',
      'arrangementId: arr_mppfa60mudrn9f',
      'arrangementName: Main Arrangement',
      '---',
      '',
      '## Verse 1',
      'Ad[G]uceți ca jertfă mulțumiri',
      '',
      '## Chorus 1',
      'În ve[G]ci El e puternic!',
      '',
    ].join('\n');
    expect(roundTrip(content).trim()).toBe(content.trim());
    expect(roundTrip(content)).toContain('songId: mppfa60mx7t2lr');
    expect(roundTrip(content)).not.toMatch(/\nid: /);
  });

  it('is idempotent (a second pass equals the first)', () => {
    const content = [
      '---',
      'title: Tu ești sfânt',
      'artist: Hillsong',
      'key: C',
      'writers: Marty Sampson',
      'year: 2001',
      'structure: [Verse 1]',
      'songId: mq9c63c4qk4sbd',
      'arrangementId: arr_mq9c63c4u0mkzj',
      'arrangementName: Main Arrangement',
      '---',
      '',
      '## Verse 1',
      '[C]Pe Tine, D[F]oamne',
      '',
    ].join('\n');
    const once = roundTrip(content);
    const twice = roundTrip(once);
    expect(twice).toBe(once);
  });

  // Corpus guard: the churn that broke sync came from songToMd → parse not
  // settling to a fixed point for some content shape. Each tricky format below
  // must reach a stable fixed point after one normalization pass — otherwise
  // every sync re-uploads it forever. If you add/alter a serializer, a failure
  // here means the new format is not round-trip stable; fix the serializer
  // (don't relax the assertion).
  describe('corpus is idempotent for every supported format', () => {
    const cases = {
      'tab block': '## Riff\n{tab, time: 4/4}\ne|--0--2--3--|\nB|--1--3--5--|\nG|--0--2--4--|\nD|-----------|\nA|--3--------|\nE|-----------|\n{/tab}',
      'tabref': '## Intro 1\n{tabref: Tab 1}',
      'modulate marker': '## Bridge\n[C]Before the change\n{modulate: +2}\n[Bm]After the change',
      'inline note': '## Verse 1\n[Am]More [F]lyrics {!watch the dynamics}',
      'band cue': '## Chorus\n> Build here, drummer in\n[G]Sing it out',
      'minor key + slash chords': '## Verse 1\n[Am]Walking [G/B]through the [C]valley [F/A]low',
      'romanian diacritics': '## Vers 1\n[C]Pe Tine, D[F]oamne, Te lăud[G]ăm și ne-nchin[Am]ăm',
      'empty lines between sections': '## Verse 1\n[C]Line one\n\n\n## Verse 2\n[G]Line two',
    };
    const frontmatter = (extra = '') => [
      '---',
      'title: Corpus Song',
      'key: Am',
      'capo: 2',
      'ccli: "1234567"',
      'tags: [worship, fast]',
      extra,
      'songId: corpus123',
      'arrangementId: arr_corpus123',
      'arrangementName: Main Arrangement',
      '---',
      '',
    ].filter(Boolean).join('\n');

    for (const [name, body] of Object.entries(cases)) {
      it(name, () => {
        const once = roundTrip(frontmatter() + body + '\n');
        expect(roundTrip(once)).toBe(once);
      });
    }
  });
});
