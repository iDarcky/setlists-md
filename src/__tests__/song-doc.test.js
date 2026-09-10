import { describe, it, expect } from 'vitest';
import { parseSongMd, songToMd } from '@/parser';
import { songFromFlat, addArrangement, withArrangement } from '@/arrangements';
import { DEMO_SONGS_MD } from '@/data/demos';
import { songDoc, docString, songFromDoc, isSongDoc } from '@/sync/songDoc';
import { threeWayMergeSong } from '@/sync/merge';

const fromMd = (md, id = 'x') => songFromFlat({ ...parseSongMd(md), id });
const simple = () => fromMd('---\ntitle: Song\nkey: C\n---\n\n## Verse 1\n[C]Amazing grace\n');

describe('the song document (step 5)', () => {
  it('is the whole v2 song: every arrangement, the overlay, the length, the tab library', () => {
    const { song: two, arrangementId } = addArrangement(simple(), 'Acoustic');
    const song = withArrangement(withArrangement(two, two.defaultArrangementId, a => ({ ...a, duration: '3:45', keyChanges: [{ slot: 1, line: 0, semitones: 2 }] })), arrangementId, a => ({ ...a, capo: 2 }));
    const doc = songDoc(song);
    expect(doc.arrangements).toHaveLength(2);
    expect(doc.arrangements[0]).toMatchObject({ duration: '3:45', keyChanges: [{ slot: 1, line: 0, semitones: 2 }] });
    expect(doc.arrangements[1]).toMatchObject({ name: 'Acoustic', capo: 2 });
    expect(doc.defaultArrangementId).toBe(song.defaultArrangementId);
  });

  it('never carries play histories or stamps, and drops the defaults it would only restore', () => {
    const song = { ...simple(), keyHistory: { C: 3 }, tempoHistory: { 120: 1 }, updatedAt: 123 };
    const doc = songDoc(song);
    expect(doc.keyHistory).toBeUndefined();
    expect(doc.tempoHistory).toBeUndefined();
    expect(doc.updatedAt).toBeUndefined();
    expect(doc.arrangements[0].updatedAt).toBeUndefined();
    for (const k of ['ccli', 'tags', 'spotify', 'youtube', 'language']) expect(k in doc).toBe(false);
    for (const k of ['tempo', 'time', 'duration', 'capo', 'notes', 'keyChanges', 'tabLibrary', 'structureMode']) expect(k in doc.arrangements[0]).toBe(false);
    expect(doc.arrangements[0].sections).toHaveLength(1);
    expect(doc.arrangements[0].structure).toEqual(['Verse 1']);
  });

  it('a legacy object that lacks a field and a fresh parse that carries its default are the same document', () => {
    const fresh = simple();
    const legacy = { ...fresh, tags: undefined, arrangements: fresh.arrangements.map(a => { const { keyChanges, tabLibrary, duration, structureMode, ...rest } = a; void keyChanges; void tabLibrary; void duration; void structureMode; return rest; }) };
    expect(docString(legacy)).toBe(docString(fresh));
  });

  it('round-trips: songFromDoc(songDoc(s)) is the in-app shape and serializes to the same document', () => {
    const { song } = addArrangement(simple(), 'Acoustic');
    const doc = songDoc(song);
    const back = songFromDoc(doc, 'x', 1000, { keyHistory: { D: 2 } });
    expect(docString(back)).toBe(docString(song));
    expect(back.keyHistory).toEqual({ D: 2 });
    expect(back.updatedAt).toBe(1000);
    expect(back.arrangements.every(a => a.updatedAt === 1000)).toBe(true);
    expect(back.arrangements[0]).toMatchObject({ tempo: null, time: '', duration: '', capo: 0, notes: '', keyChanges: [], tabLibrary: [], structureMode: 'auto' });
    expect(back.tags).toEqual([]);
    expect(back.id).toBe('x');
  });

  it('the feed key wins over the id inside the document', () => {
    expect(songFromDoc(songDoc(simple()), 'other').id).toBe('other');
  });

  it('refuses a document the app cannot hold', () => {
    expect(songFromDoc(null, 'x')).toBeNull();
    expect(songFromDoc({ title: 'No arrangements' }, 'x')).toBeNull();
    expect(songFromDoc({ arrangements: [{ name: 'no id', sections: [] }] }, 'x')).toBeNull();
    expect(isSongDoc('---\ntitle: md\n---')).toBe(false);
    expect(isSongDoc(songDoc(simple()))).toBe(true);
  });

  it('three-way merge sees a hydrated document and a parsed markdown of the same song as equal', () => {
    const base = simple();
    const remote = songFromDoc(songDoc(base), 'x', 5);
    const local = { ...base, title: 'Retitled' };
    const { merged, conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.title).toBe('Retitled');
  });

  it('the demo songs round-trip through markdown without loss (no upgrade churn for plain songs)', () => {
    for (const md of DEMO_SONGS_MD) {
      const song = fromMd(md);
      const again = fromMd(songToMd(song));
      expect(docString(again)).toBe(docString(song));
    }
  });
});

describe('markdown export carries the overlay and the length (PLAN §2.3)', () => {
  it('a v2 song serializes duration and keyChanges and they parse back', () => {
    const s = simple();
    const song = withArrangement(s, s.defaultArrangementId, a => ({ ...a, duration: '4:20', keyChanges: [{ slot: 1, line: 0, semitones: 2 }, { slot: 3, line: 2, semitones: -1 }] }));
    const md = songToMd(song);
    expect(md).toContain('duration: 4:20');
    expect(md).toContain('keyChanges: [1:0:+2, 3:2:-1]');
    const back = fromMd(md);
    expect(back.arrangements[0].duration).toBe('4:20');
    expect(back.arrangements[0].keyChanges).toEqual([{ slot: 1, line: 0, semitones: 2 }, { slot: 3, line: 2, semitones: -1 }]);
    expect(docString(back)).toBe(docString(song));
  });
});
