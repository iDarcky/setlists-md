import { describe, it, expect } from 'vitest';
import { groupByMonth, myStatus, bandSummary, needsPeople, canYouPlay } from '@/lib/scheduleData';
import { myServices } from '@/lib/homeData';

// Sunday 25 October 2026, 09:00 local.
const NOW = new Date(2026, 9, 25, 9, 0).getTime();
const sl = (id, date) => ({ id, name: id, date, time: '10:00', items: [] });
const SETLISTS = [sl('oct18', '2026-10-18'), sl('nov1', '2026-11-01'), sl('nov8', '2026-11-08'), sl('dec6', '2026-12-06'), { id: 'nodate', name: 'x' }];
const MAP = { nov8: 'row-nov8' };
const SCHEDULES = [
  { id: 'a', user_id: 'me', setlist_id: 'nov1', availability: 'available', role: 'Keys' },
  { id: 'b', user_id: 'me', setlist_id: 'row-nov8', availability: 'pending', role: 'Keys' },
  { id: 'c', user_id: 'ana', setlist_id: 'nov1', availability: 'unavailable' },
];
const AVAIL = [
  { user_id: 'me', date: '2026-12-06', status: 'unavailable' },
  { user_id: 'rob', date: '2026-11-01', status: 'available' },
  { user_id: 'me', date: '2026-11-01', status: 'available' },
];

describe('scheduleData', () => {
  it('groups upcoming setlists by month, soonest first, and past ones latest first', () => {
    expect(groupByMonth(SETLISTS, { now: NOW }).map(g => [g.month, g.setlists.map(s => s.id)])).toEqual([
      ['November 2026', ['nov1', 'nov8']],
      ['December 2026', ['dec6']],
    ]);
    expect(groupByMonth(SETLISTS, { now: NOW, past: true })[0].setlists.map(s => s.id)).toEqual(['oct18']);
  });

  it('works out where I stand on each setlist', () => {
    const ctx = { schedules: SCHEDULES, setlistMap: MAP, userId: 'me', availability: AVAIL };
    expect(myStatus(SETLISTS[1], ctx)).toMatchObject({ kind: 'playing', part: 'Keys' });
    expect(myStatus(SETLISTS[2], ctx)).toMatchObject({ kind: 'asked' });
    expect(myStatus(SETLISTS[3], ctx)).toEqual({ kind: 'cant' });
    expect(myStatus(SETLISTS[0], ctx)).toEqual({ kind: 'not' });
  });

  it('sums up a band and who else is free', () => {
    const s = bandSummary(SETLISTS[1], { schedules: SCHEDULES, setlistMap: MAP, availability: AVAIL });
    expect(s).toMatchObject({ yes: 1, no: 1, total: 2, free: 1 });
    expect(needsPeople(s)).toBe(true);
    expect(needsPeople(bandSummary(SETLISTS[3], {}))).toBe(true);
  });

  it('lays out the next five Sundays plus any weekday ask', () => {
    const asks = [{ schedule: { id: 'x' }, setlist: { id: 'yn', name: 'Youth Night', date: '2026-11-06' } }];
    const plays = myServices({ schedules: SCHEDULES, userId: 'me', setlists: SETLISTS, setlistMap: MAP, now: NOW });
    const tiles = canYouPlay({ now: NOW, setlists: SETLISTS, asks, plays, mine: [{ date: '2026-11-08', status: 'unavailable' }] });
    expect(tiles.map(t => t.date)).toEqual(['2026-10-25', '2026-11-01', '2026-11-06', '2026-11-08', '2026-11-15', '2026-11-22']);
    const byDate = Object.fromEntries(tiles.map(t => [t.date, t]));
    expect(byDate['2026-11-01']).toMatchObject({ playing: true, names: ['nov1'], weekday: 'Sun', day: 1 });
    expect(byDate['2026-11-01'].rows.map(r => r.id)).toEqual(['a']);
    expect(byDate['2026-11-06'].asks).toHaveLength(1);
    expect(byDate['2026-11-08'].status).toBe('unavailable');
  });
});
