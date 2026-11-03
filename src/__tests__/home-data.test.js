import { describe, it, expect } from 'vitest';
import {
  toDateStr, myAsks, myServices, nextUp, daysUntil, twoWeeks, whoCanPlay, needsYou, latestSongs, bandFor, recentActivity, activityFromSongs, timeAgo,
} from '@/lib/homeData';

// Sunday 25 October 2026, 09:00 local.
const NOW = new Date(2026, 9, 25, 9, 0).getTime();

const sl = (id, date, extra = {}) => ({ id, name: id, date, time: '10:00', items: [{ songId: 's1' }], ...extra });
const SETLISTS = [
  sl('past', '2026-10-18'),
  sl('nov1', '2026-11-01', { rehearsalDate: '2026-10-31', rehearsalTime: '18:00' }),
  sl('nov6', '2026-11-06', { items: [] }),
  sl('nov8', '2026-11-08'),
];
// nov8 lives on the server as a row UUID: schedules point at that.
const MAP = { nov8: 'row-nov8' };
const SCHEDULES = [
  { id: 'a', user_id: 'me', setlist_id: 'nov1', availability: 'available', role: 'Keys' },
  { id: 'b', user_id: 'me', setlist_id: 'row-nov8', availability: 'pending', role: 'Keys' },
  { id: 'c', user_id: 'me', setlist_id: 'past', availability: 'pending' },
  { id: 'd', user_id: 'other', setlist_id: 'nov1', availability: 'pending' },
];

describe('homeData', () => {
  it('formats local dates', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('lists only my unanswered asks that are still ahead, through the row map', () => {
    const asks = myAsks({ schedules: SCHEDULES, userId: 'me', setlists: SETLISTS, setlistMap: MAP, now: NOW });
    expect(asks.map(a => a.setlist.id)).toEqual(['nov8']);
  });

  it('lists the services I said yes to', () => {
    const mine = myServices({ schedules: SCHEDULES, userId: 'me', setlists: SETLISTS, setlistMap: MAP, now: NOW });
    expect(mine.map(a => a.setlist.id)).toEqual(['nov1']);
  });

  it('leads a member with the next service they play, a leader with the next one', () => {
    const member = nextUp({ setlists: SETLISTS, schedules: SCHEDULES, userId: 'other', setlistMap: MAP, now: NOW, inTeam: true });
    expect(member).toBeNull();
    const me = nextUp({ setlists: SETLISTS, schedules: SCHEDULES, userId: 'me', setlistMap: MAP, now: NOW, inTeam: true });
    expect(me.setlist.id).toBe('nov1');
    const leader = nextUp({ setlists: SETLISTS, schedules: SCHEDULES, userId: 'boss', setlistMap: MAP, now: NOW, inTeam: true, leader: true });
    expect(leader.setlist.id).toBe('nov1');
    expect(leader.schedule).toBeNull();
    const personal = nextUp({ setlists: SETLISTS, now: NOW });
    expect(personal.setlist.id).toBe('nov1');
  });

  it('counts days until a service', () => {
    expect(daysUntil(SETLISTS[1], NOW)).toBe(7);
    expect(daysUntil({ date: '2026-10-25' }, NOW)).toBe(0);
  });

  it('builds two weeks from the start of this week, with plays, asks and rehearsals', () => {
    const asks = myAsks({ schedules: SCHEDULES, userId: 'me', setlists: SETLISTS, setlistMap: MAP, now: NOW });
    const plays = myServices({ schedules: SCHEDULES, userId: 'me', setlists: SETLISTS, setlistMap: MAP, now: NOW });
    const days = twoWeeks({ now: NOW, setlists: SETLISTS, plays, asks });
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe('2026-10-25');
    expect(days[0].isToday).toBe(true);
    const byDate = Object.fromEntries(days.map(d => [d.date, d]));
    expect(byDate['2026-11-01'].play).toBe(true);
    expect(byDate['2026-10-31'].rehearsals.map(s => s.id)).toEqual(['nov1']);
    expect(days.at(-1).date).toBe('2026-11-07');
    // Monday weeks start the day after; the next fortnight follows on.
    expect(twoWeeks({ now: NOW, weekStart: 'monday' })[0].date).toBe('2026-10-19');
    expect(twoWeeks({ now: NOW, offset: 1 })[0].date).toBe('2026-11-08');
    expect(twoWeeks({ now: NOW, offset: 1, asks, setlists: SETLISTS })[0].asked).toBe(true);
  });

  it('counts who can play per service date', () => {
    const availability = [
      { date: '2026-11-01', status: 'available' },
      { date: '2026-11-01', status: 'maybe' },
      { date: '2026-11-01', status: 'unavailable' },
    ];
    const rows = whoCanPlay({ setlists: SETLISTS, availability, memberCount: 5, now: NOW });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ yes: 1, maybe: 1, no: 1, noAnswer: 2, total: 5 });
  });

  it('counts an accepted setlist as yes, over the day answer', () => {
    const availability = [{ user_id: 'me', date: '2026-11-01', status: 'unavailable' }];
    const rows = whoCanPlay({ setlists: SETLISTS, availability, schedules: SCHEDULES, setlistMap: MAP, memberCount: 5, now: NOW });
    // me accepted nov1; other is still pending, so not an answer.
    expect(rows[0]).toMatchObject({ yes: 1, no: 0, noAnswer: 4 });
  });

  it('collects what needs a leader: joins, no band, no songs', () => {
    const items = needsYou({
      joinRequests: [{ display_name: 'Ana M.' }, { email: 'tim@example.com' }],
      setlists: SETLISTS, schedules: SCHEDULES, setlistMap: MAP, now: NOW,
    });
    expect(items[0]).toEqual({ kind: 'join', count: 2, names: ['Ana M.', 'tim'] });
    expect(items.slice(1).map(i => `${i.kind}:${i.setlist.id}`)).toEqual(['noband:nov6', 'nosongs:nov6']);
  });

  it('finds the band of a setlist by its id or its row', () => {
    expect(bandFor(SETLISTS[3], SCHEDULES, MAP).map(r => r.id)).toEqual(['b']);
  });

  it('lists the latest songs by update time', () => {
    const songs = [{ id: 1, updatedAt: 5 }, { id: 2 }, { id: 3, updatedAt: 9 }];
    expect(latestSongs(songs).map(s => s.id)).toEqual([3, 1]);
  });

  it('collapses repeated activity and names you', () => {
    const rows = [
      { id: 1, action: 'song_edited', entity_id: 'r1', entity_name: 'Holy Forever', actor_id: 'ana', created_at: '2026-10-25T08:00:00' },
      { id: 2, action: 'availability_set', entity_id: 'x', actor_id: 'ana', created_at: '2026-10-25T07:30:00' },
      { id: 3, action: 'song_edited', entity_id: 'r1', entity_name: 'Holy Forever', actor_id: 'ana', created_at: '2026-10-25T07:00:00' },
      { id: 4, action: 'setlist_removed', entity_id: 'r2', entity_name: 'Youth', actor_id: 'me', created_at: '2026-10-24T07:00:00' },
      { id: 5, action: 'member_joined', entity_id: 'tim', actor_id: 'tim', created_at: '2026-10-23T07:00:00' },
    ];
    const items = recentActivity(rows, { nameFor: id => ({ ana: 'Ana M', tim: 'Tim P' })[id], userId: 'me' });
    expect(items.map(i => `${i.actor} ${i.verb} ${i.object ?? ''}`.trim())).toEqual([
      'Ana M edited Holy Forever', 'You deleted Youth', 'Tim P joined',
    ]);
    expect(items[1].removed).toBe(true);
    expect(activityFromSongs([{ id: 'a', title: 'A', updatedAt: 3 }])[0]).toMatchObject({ actor: 'You', verb: 'edited', object: 'A' });
    expect(timeAgo(NOW - 3 * 3600000, NOW)).toBe('3 h ago');
  });
});
