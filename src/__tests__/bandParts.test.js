import { describe, it, expect } from 'vitest';
import { partOf, bandSlots, candidates, lastParts } from '@/lib/bandParts';

const m = (id, instruments, name = id) => ({ user_id: id, instruments, profile: { display_name: name } });

describe('partOf', () => {
  it('reduces any stored role to its top-level part', () => {
    expect(partOf('Drums')).toBe('drums');
    expect(partOf('vocals:alto')).toBe('vocals');
    expect(partOf('nonsense')).toBe(null);
  });
});

describe('bandSlots', () => {
  it('fills needed parts, leaves the rest empty, adds unsent picks and drops removed rows', () => {
    const rows = [{ id: 's1', user_id: 'a', role: 'keys', availability: 'available' }, { id: 's2', user_id: 'b', role: 'drums', availability: 'pending' }];
    const slots = bandSlots({ rows, adds: [{ part: 'vocals', userId: 'c' }], removes: new Set(['s2']), needed: ['vocals', 'vocals', 'keys', 'drums'] });
    expect(slots.map(s => [s.part, s.userId, s.status])).toEqual([
      ['vocals', 'c', 'notsent'], ['vocals', null, 'empty'], ['keys', 'a', 'available'], ['drums', null, 'empty'],
    ]);
  });
});

describe('lastParts', () => {
  it('takes the parts of the last setlist with the same name', () => {
    const setlists = [{ id: 'old', name: 'Sunday Morning', date: '2026-10-25' }, { id: 'new', name: 'Sunday morning', date: '2026-11-01' }];
    const schedules = [{ setlist_id: 'old', user_id: 'a', role: 'drums' }, { setlist_id: 'old', user_id: 'b', role: 'vocals:alto' }];
    expect(lastParts({ setlist: setlists[1], setlists, schedules })).toEqual(['vocals', 'drums']);
  });
});

describe('candidates', () => {
  it('groups by the day, skips who is taken, and warns on a third week running', () => {
    const setlist = { id: 'x', date: '2026-11-15' };
    const setlists = [setlist, { id: 'p1', date: '2026-11-08' }, { id: 'p2', date: '2026-11-01' }];
    const schedules = [
      { setlist_id: 'p1', user_id: 'eli', availability: 'available' },
      { setlist_id: 'p2', user_id: 'eli', availability: 'available' },
    ];
    const members = [m('mara', ['vocals:alto'], 'Mara'), m('eli', ['Vocals'], 'Eli'), m('sara', ['vocals'], 'Sara'), m('kim', ['vocals'], 'Kim'), m('rob', ['drums'], 'Rob'), m('ana', ['vocals'], 'Ana')];
    const availability = [
      { user_id: 'mara', date: '2026-11-15', status: 'available' },
      { user_id: 'eli', date: '2026-11-15', status: 'available' },
      { user_id: 'kim', date: '2026-11-15', status: 'unavailable' },
    ];
    const g = candidates({ part: 'vocals', setlist, members, schedules, setlists, availability, taken: ['ana'], nameOf: (x) => x.profile.display_name });
    expect(g.free.map(p => p.name)).toEqual(['Mara', 'Eli']);
    expect(g.free[1].warn).toBe('Would be 3 Sundays in a row');
    expect(g.none.map(p => p.name)).toEqual(['Sara']);
    expect(g.cant.map(p => p.name)).toEqual(['Kim']);
  });
});
