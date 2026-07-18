import { describe, it, expect } from 'vitest';
import {
  availableColumns,
  resolveVisibleColumns,
  toggleColumn,
  defaultVisibleColumns,
  orderedVisibleColumns,
  reorderColumns,
} from '../lib/tableColumns';

describe('availableColumns', () => {
  it('drops entitlement-gated columns when the context flag is off', () => {
    const ids = availableColumns('setlists', {}).map(c => c.id);
    expect(ids).toEqual(['date', 'songs', 'tags']); // no service/schedule
  });
  it('includes gated columns when allowed', () => {
    const ids = availableColumns('setlists', { showService: true, showSchedule: true }).map(c => c.id);
    expect(ids).toContain('service');
    expect(ids).toContain('instr');
  });
});

describe('resolveVisibleColumns', () => {
  it('falls back to defaults when nothing is saved', () => {
    const vis = resolveVisibleColumns('library', undefined, {});
    expect([...vis].sort()).toEqual(['artist', 'key', 'tags']); // tempo/updated off
  });
  it('honors saved prefs and treats new columns as opt-in (hidden)', () => {
    const vis = resolveVisibleColumns('library', { library: ['key', 'tempo'] }, {});
    expect([...vis].sort()).toEqual(['key', 'tempo']);
    expect(vis.has('artist')).toBe(false);
  });
  it('drops unavailable (gated) columns even if saved', () => {
    const vis = resolveVisibleColumns('setlists', { setlists: ['date', 'service'] }, { showService: false });
    expect(vis.has('service')).toBe(false);
    expect(vis.has('date')).toBe(true);
  });
});

describe('toggleColumn', () => {
  it('turns a column off, preserving the remaining order', () => {
    const next = toggleColumn('library', { library: ['artist', 'key', 'tags'] }, {}, 'key');
    expect(next).toEqual(['artist', 'tags']);
  });
  it('appends a newly-shown column at the end (order is user-controlled)', () => {
    const next = toggleColumn('library', { library: ['artist', 'key', 'tags'] }, {}, 'tempo');
    expect(next).toEqual(['artist', 'key', 'tags', 'tempo']);
  });
});

describe('plus-gated columns + ordering', () => {
  it('unlocks extra library columns only when the plus context flag is set', () => {
    const off = availableColumns('library', {}).map(c => c.id);
    expect(off).not.toContain('ccli');
    const on = availableColumns('library', { plus: true }).map(c => c.id);
    expect(on).toContain('ccli');
    expect(on).toContain('duration');
    expect(on).toContain('usage');
  });
  it('orderedVisibleColumns honors the saved order', () => {
    const cols = orderedVisibleColumns('library', { library: ['tags', 'key', 'artist'] }, {});
    expect(cols.map(c => c.id)).toEqual(['tags', 'key', 'artist']);
  });
  it('reorderColumns moves a column to a new index', () => {
    const next = reorderColumns('library', { library: ['artist', 'key', 'tags'] }, {}, 'tags', 0);
    expect(next).toEqual(['tags', 'artist', 'key']);
  });
});

describe('defaultVisibleColumns', () => {
  it('returns available defaults only', () => {
    expect(defaultVisibleColumns('setlists', {})).toEqual(['date', 'songs', 'tags']);
  });
});
