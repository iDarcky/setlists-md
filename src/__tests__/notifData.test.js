import { describe, it, expect } from 'vitest';
import { buildNotifs, timeLabel } from '@/lib/notifData';

const NOW = new Date('2026-11-04T12:00:00').getTime();
const H = 3600000;

describe('buildNotifs', () => {
  const setlists = [{ id: 'sl1', name: 'Sunday Morning', date: '2026-11-08' }];
  const matches = (sl, id) => sl.id === id;

  it('puts asks and join requests under Needs you, with words not ids', () => {
    const out = buildNotifs({
      feed: [{ id: 'schedule-a', type: 'schedule_request', scheduleId: 'a', setlistId: 'sl1' }],
      schedules: [{ id: 'a', role: 'acoustic-guitar' }],
      joinRequests: [{ id: 'r1', display_name: 'Ana Pop', parts: ['drums'] }],
      setlists, matchesSetlistId: matches, now: NOW,
    });
    expect(out.needs.map(n => n.kind)).toEqual(['ask', 'join']);
    expect(out.needs[0].title).toBe('Can you play Sun 8 Nov?');
    expect(out.needs[0].sub).toBe('Sunday Morning · Acoustic Guitar');
    expect(out.needs[1].avatar.initials).toBe('AP');
    expect(out.unread).toBe(2);
  });

  it('groups the rest by day and drops anything older than 30 days', () => {
    const out = buildNotifs({
      feed: [
        { id: 'a', type: 'schedule_decline', title: 'x', createdAt: new Date(NOW - H).toISOString() },
        { id: 'b', type: 'song_added', title: 'y', createdAt: new Date(NOW - 3 * 24 * H).toISOString(), read: true },
        { id: 'c', type: 'song_added', title: 'z', createdAt: new Date(NOW - 40 * 24 * H).toISOString() },
      ],
      now: NOW,
    });
    expect(out.groups.map(g => g.label)).toEqual(['Today', 'This week']);
    expect(out.groups[0].items[0].tone).toBe('no');
    expect(out.unread).toBe(1);
  });
});

describe('timeLabel', () => {
  it('reads short', () => {
    expect(timeLabel(NOW - 30000, NOW)).toBe('now');
    expect(timeLabel(NOW - 5 * 60000, NOW)).toBe('5m');
    expect(timeLabel(NOW - 3 * H, NOW)).toBe('3h');
  });
});
