import { describe, it, expect } from 'vitest';
import { newSetlistFrom, nextFreeDay, blankDate, dayLabel } from '@/lib/newSetlist';

const TODAY = '2026-11-02'; // a Monday

const setlists = [
  { id: 'a', name: 'Sunday morning', service: 'Sunday morning', date: '2026-10-25', time: '10:00', location: 'Main hall', rehearsalDate: '2026-10-23', rehearsalTime: '19:00',
    items: [{ type: 'break', label: 'Welcome', duration: 5 }, { songId: 's1', leadBy: 'u1' }, { type: 'break', label: 'Offering' }] },
  { id: 'b', name: 'Sunday morning', service: 'Sunday morning', date: '2026-11-08', time: '10:00', items: [] },
  { id: 'c', name: 'Youth', service: 'Youth night', date: '2026-10-30', time: '19:00', items: [{ type: 'break', label: 'Games' }] },
  { id: 't', isTemplate: true, templateName: 'Christmas', name: 'Christmas template', items: [{ songId: 's9', leadBy: 'u2' }, { type: 'break', label: 'Carols' }] },
];

describe('nextFreeDay', () => {
  it('finds the next weekday, skipping taken dates', () => {
    expect(nextFreeDay(0, new Set(), TODAY)).toBe('2026-11-08');
    expect(nextFreeDay(0, new Set(['2026-11-08']), TODAY)).toBe('2026-11-15');
    expect(nextFreeDay(1, new Set(), TODAY)).toBe(TODAY);
  });
  it('blankDate is the next Sunday', () => {
    expect(blankDate(TODAY)).toBe('2026-11-08');
  });
});

describe('newSetlistFrom', () => {
  it('a blank one is an empty draft on the date', () => {
    const sl = newSetlistFrom(null, '2026-11-08');
    expect(sl).toMatchObject({ name: '', date: '2026-11-08', status: 'draft', items: [] });
    expect(sl.id).toBeTruthy();
  });
  it('copies the pattern and shifts the rehearsal, never who leads', () => {
    const pattern = setlists[0];
    const sl = newSetlistFrom({ name: 'Sunday morning', pattern, items: pattern.items, service: 'Sunday morning' }, '2026-11-15');
    expect(sl).toMatchObject({ name: 'Sunday morning', service: 'Sunday morning', time: '10:00', location: 'Main hall', rehearsalDate: '2026-11-13', rehearsalTime: '19:00' });
    expect(sl.items.some(it => 'leadBy' in it)).toBe(false);
    expect(sl.items).not.toBe(pattern.items);
  });
  it('labels a day', () => {
    expect(dayLabel('2026-11-08')).toBe('Sun 8 Nov');
    expect(dayLabel('')).toBe('');
  });
});
