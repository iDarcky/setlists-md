import { describe, it, expect } from 'vitest';
import { reconcileAdopt, applyPulled } from '@/sync/adopt';

const s = (id, v = 0) => ({ id, title: `Song ${id}`, v });

describe('reconcileAdopt (server-authoritative adoption)', () => {
  it('adopts the result wholesale when nothing changed mid-sync', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const result = [s('a', 1), s('b', 1), s('c')];
    expect(reconcileAdopt(base, base, result)).toEqual(result);
  });

  it('keeps an item the user edited while the sync was in flight', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const editedA = s('a', 99);
    const prev = [editedA, b];
    const result = [s('a', 1), s('b', 1)];
    const out = reconcileAdopt(prev, base, result);
    expect(out[0]).toBe(editedA);        // mid-sync edit survives
    expect(out[1]).toEqual(s('b', 1));   // untouched item adopts the result
  });

  it('does not resurrect an item the user deleted mid-sync', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const prev = [b]; // user deleted `a` while the sync ran
    const result = [s('a', 1), s('b', 1)];
    const out = reconcileAdopt(prev, base, result);
    expect(out.map(x => x.id)).toEqual(['b']);
  });

  it('keeps an item the user created mid-sync', () => {
    const a = s('a');
    const base = [a];
    const created = s('new');
    const prev = [a, created];
    const result = [s('a', 1)];
    const out = reconcileAdopt(prev, base, result);
    expect(out.map(x => x.id)).toEqual(['a', 'new']);
    expect(out[1]).toBe(created);
  });

  it('drops items deleted on the server when untouched locally', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const result = [s('a', 1)]; // server deleted b
    const out = reconcileAdopt(base, base, result);
    expect(out.map(x => x.id)).toEqual(['a']);
  });

  it('an in-flight edit beats a concurrent server deletion', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const editedB = s('b', 99);
    const prev = [a, editedB];
    const result = [s('a', 1)]; // server deleted b while the user edited it
    const out = reconcileAdopt(prev, base, result);
    expect(out.map(x => x.id)).toEqual(['a', 'b']);
    expect(out[1]).toBe(editedB);
  });

  it('adds brand-new server items', () => {
    const base = [s('a')];
    const result = [s('a'), s('fresh')];
    const out = reconcileAdopt(base, base, result);
    expect(out.map(x => x.id)).toEqual(['a', 'fresh']);
  });
});

describe('applyPulled (partial file-provider adoption)', () => {
  it('replaces only pulled, locally-untouched items', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const pulledA = s('a', 1);
    const out = applyPulled(base, base, [pulledA, b], new Set(['a']));
    expect(out[0]).toBe(pulledA);
    expect(out[1]).toBe(b);
  });

  it('keeps a mid-sync local edit over the pulled copy', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const editedA = s('a', 99);
    const prev = [editedA, b];
    const out = applyPulled(prev, base, [s('a', 1), b], new Set(['a']));
    expect(out[0]).toBe(editedA);
  });

  it('appends new remote items but not mid-sync-deleted ones', () => {
    const a = s('a'), b = s('b');
    const base = [a, b];
    const prev = [a]; // user deleted b mid-sync
    const out = applyPulled(prev, base, [a, s('b', 1), s('c')], new Set(['b', 'c']));
    expect(out.map(x => x.id)).toEqual(['a', 'c']);
  });

  it('returns prev by reference when nothing applies', () => {
    const base = [s('a')];
    expect(applyPulled(base, base, base, new Set())).toBe(base);
  });
});
