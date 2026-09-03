import { describe, it, expect } from 'vitest';
import { threeWayMergeSong, threeWayMergeSetlist } from '@/sync/merge';

// Minimal v2-ish song. `arr` lets a test mutate the chart (arrangements) as one unit.
function song(over = {}) {
  return {
    id: 's1', title: 'Song', artist: 'A', tempo: 120, tags: [],
    key: 'G', year: '', spotify: '', youtube: '',
    keyHistory: {}, defaultArrangementId: 'arr1',
    arrangements: [{ id: 'arr1', key: 'G', sections: [{ type: 'Verse', lines: ['a'] }] }],
    ...over,
  };
}

describe('threeWayMergeSong', () => {
  it('auto-merges disjoint metadata edits (no conflict)', () => {
    const base = song();
    const local = song({ year: '2011' });         // local changed year
    const remote = song({ artist: 'B' });         // remote changed artist
    const { merged, conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.year).toBe('2011');             // local edit kept
    expect(merged.artist).toBe('B');              // remote edit kept
    expect(merged.id).toBe('s1');
  });

  it('takes the side that changed when the other is untouched', () => {
    const base = song();
    const local = song();                          // local unchanged
    const remote = song({ title: 'New' });         // only remote changed
    const { merged, conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.title).toBe('New');
  });

  it('flags a conflict when both change the SAME field differently', () => {
    const base = song();
    const local = song({ title: 'Mine' });
    const remote = song({ title: 'Theirs' });
    const { conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toContain('title');
  });

  it('no conflict when both made the identical edit', () => {
    const base = song();
    const local = song({ title: 'Same' });
    const remote = song({ title: 'Same' });
    const { conflictFields, merged } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.title).toBe('Same');
  });

  it('treats the chart (arrangements) as one unit — both-edited → conflict', () => {
    const base = song();
    const local = song({ arrangements: [{ id: 'arr1', key: 'A', sections: [{ type: 'Verse', lines: ['a'] }] }] });
    const remote = song({ arrangements: [{ id: 'arr1', key: 'G', sections: [{ type: 'Verse', lines: ['b'] }] }] });
    const { conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toContain('arrangements');
  });

  it('auto-merges a chart edit on one side with metadata edit on the other', () => {
    const base = song();
    const local = song({ arrangements: [{ id: 'arr1', key: 'A', sections: [{ type: 'Verse', lines: ['x'] }] }] });
    const remote = song({ tags: ['fast'] });
    const { merged, conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.arrangements[0].key).toBe('A');   // local chart edit kept
    expect(merged.tags).toEqual(['fast']);          // remote tag kept
  });

  it('unions keyHistory play counts, never conflicts on them', () => {
    const base = song({ keyHistory: { G: 1 } });
    const local = song({ keyHistory: { G: 3, A: 1 } });
    const remote = song({ keyHistory: { G: 2, B: 5 } });
    const { merged, conflictFields } = threeWayMergeSong(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.keyHistory).toEqual({ G: 3, A: 1, B: 5 });
  });

  it('signals no-baseline so the caller can fall back to the conflict UI', () => {
    const { conflictFields } = threeWayMergeSong(null, song(), song());
    expect(conflictFields).toEqual(['__nobase__']);
  });
});

describe('threeWayMergeSetlist', () => {
  const sl = (over = {}) => ({ id: 'sl1', name: 'Sun', date: '2026-06-01', tags: [], items: [{ songId: 'a' }], ...over });

  it('auto-merges disjoint edits (name vs date)', () => {
    const { merged, conflictFields } = threeWayMergeSetlist(sl(), sl({ name: 'Evening' }), sl({ date: '2026-06-08' }));
    expect(conflictFields).toEqual([]);
    expect(merged.name).toBe('Evening');
    expect(merged.date).toBe('2026-06-08');
  });

  it('flags a conflict when both reorder items differently', () => {
    const base = sl();
    const local = sl({ items: [{ songId: 'a' }, { songId: 'b' }] });
    const remote = sl({ items: [{ songId: 'a' }, { songId: 'c' }] });
    expect(threeWayMergeSetlist(base, local, remote).conflictFields).toContain('items');
  });

  it('keeps one side items change when the other only edited metadata', () => {
    const base = sl();
    const local = sl({ items: [{ songId: 'a' }, { songId: 'b' }] });
    const remote = sl({ name: 'Renamed' });
    const { merged, conflictFields } = threeWayMergeSetlist(base, local, remote);
    expect(conflictFields).toEqual([]);
    expect(merged.items).toHaveLength(2);
    expect(merged.name).toBe('Renamed');
  });
});
