// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { keyDistance, flowHints, playedRecently } from '@/lib/newSetlist';
import { readNewDraft, writeNewDraft } from '@/lib/setlistDraft';

describe('keyDistance', () => {
  it('counts steps on the circle of fifths', () => {
    expect(keyDistance('C', 'G')).toBe(1);
    expect(keyDistance('Eb', 'A')).toBe(6);
    expect(keyDistance('D', 'D')).toBe(0);
    expect(keyDistance('Am', 'C')).toBe(0);
    expect(keyDistance('x', 'C')).toBe(null);
  });
});

describe('flowHints', () => {
  it('flags a far key or a big tempo jump against the song before, skipping moments', () => {
    const rows = [
      { kind: 'song', idx: 0, key: 'D', tempo: 70 },
      { kind: 'moment', idx: 1 },
      { kind: 'song', idx: 2, key: 'G', tempo: 76 },
      { kind: 'song', idx: 3, key: 'Db', tempo: 130 },
      { kind: 'song', idx: 4, placeholder: true },
    ];
    expect(flowHints(rows)).toEqual({ 3: 'G → Db, far key · 76 → 130 BPM' });
  });
});

describe('playedRecently', () => {
  const setlists = [
    { id: 'a', date: '2026-11-01', items: [{ songId: 's' }] },
    { id: 'b', date: '2026-10-01', items: [{ songId: 'old' }] },
    { id: 't', isTemplate: true, date: '2026-11-07', items: [{ songId: 's' }] },
  ];
  it('names last Sunday, a date within three weeks, nothing older', () => {
    expect(playedRecently('s', setlists, '2026-11-08')).toBe('Played last Sunday');
    expect(playedRecently('s', setlists, '2026-11-15')).toBe('Played 1 Nov');
    expect(playedRecently('old', setlists, '2026-11-08')).toBe('');
    expect(playedRecently('s', setlists, '2026-11-08', 'a')).toBe('');
  });
});

describe('setlistDraft', () => {
  beforeEach(() => localStorage.clear());
  it('keeps one unsaved new setlist per space', () => {
    writeNewDraft('t1', { id: 'x', name: 'BBPT #424 AM' });
    expect(readNewDraft('t1')?.name).toBe('BBPT #424 AM');
    expect(readNewDraft('personal')).toBe(null);
    writeNewDraft('t1', null);
    expect(readNewDraft('t1')).toBe(null);
  });
});
