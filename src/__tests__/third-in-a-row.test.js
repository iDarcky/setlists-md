import { describe, it, expect } from 'vitest';
import { thirdInARow, bandGrid } from '@/lib/scheduleData';

const sl = (id, date) => ({ id, date, time: '10:00', name: id });
const setlists = [sl('a', '2026-11-01'), sl('b', '2026-11-08'), sl('c', '2026-11-15'), sl('d', '2026-11-22')];
const setlistMap = { a: 'ra', b: 'rb', c: 'rc', d: 'rd' };
const row = (id, setlist_id, user_id, availability = 'available') => ({ id, setlist_id, user_id, availability });

describe('3 in a row', () => {
  it('warns when the two same weekdays before are taken', () => {
    const schedules = [row(1, 'ra', 'u1'), row(2, 'rb', 'u1')];
    expect(thirdInARow({ uid: 'u1', date: '2026-11-15', setlists, schedules, setlistMap })).toBe(true);
    expect(thirdInARow({ uid: 'u1', date: '2026-11-22', setlists, schedules, setlistMap })).toBe(false);
  });
  it('ignores a No, and counts an invite not sent yet', () => {
    const schedules = [row(1, 'ra', 'u1'), row(2, 'rb', 'u1', 'unavailable')];
    expect(thirdInARow({ uid: 'u1', date: '2026-11-15', setlists, schedules, setlistMap })).toBe(false);
    expect(thirdInARow({ uid: 'u1', date: '2026-11-15', setlists, schedules: [row(1, 'ra', 'u1')], setlistMap, plan: { 'b:u1': 'add' } })).toBe(true);
  });
  it('marks the Band grid cell', () => {
    const schedules = [row(1, 'ra', 'u1'), row(2, 'rb', 'u1'), row(3, 'rc', 'u1')];
    const g = bandGrid({ setlists: setlists.slice(2), allSetlists: setlists, members: [{ user_id: 'u1', instruments: ['keys'] }], schedules, setlistMap });
    expect(g.people[0].cells[0].warn).toBe('3 Sundays in a row');
    expect(g.people[0].cells[1].warn).toBe('');
  });
});
