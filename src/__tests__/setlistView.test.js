import { describe, it, expect } from 'vitest';
import { buildOrder, addClock, totalLabel, daysAway, daysLabel } from '@/lib/setlistView';

const songs = [
  { id: 'a', title: 'Way Maker', defaultArrangementId: 'x', arrangements: [{ id: 'x', key: 'E', tempo: 68, time: '4/4', duration: '5:00', sections: [] }] },
  { id: 'b', title: 'Living Hope', arrangements: [{ id: 'y', key: 'D', tempo: 72, sections: [] }] },
];

describe('setlistView', () => {
  it('numbers only songs and gives each row its clock time', () => {
    const setlist = { time: '10:00', items: [
      { type: 'break', label: 'Welcome', duration: 2 },
      { songId: 'a', leadBy: 'u1', note: 'Start soft' },
      { songId: 'b', transpose: 2 },
      { songId: 'gone', songTitle: 'Old song' },
    ] };
    const o = buildOrder(setlist, songs, (u) => (u === 'u1' ? 'Joe' : ''));
    expect(o.songCount).toBe(3);
    expect(o.rows.map(r => r.n ?? '-')).toEqual(['-', 1, 2, 3]);
    expect(o.rows.map(r => r.startsAt)).toEqual(['10:00', '10:02', '10:07', '10:11']);
    expect(o.rows[1]).toMatchObject({ title: 'Way Maker', key: 'E', tempo: 68, leads: 'Joe', note: 'Start soft' });
    expect(o.rows[2].key).toBe('E');
    expect(o.rows[3]).toMatchObject({ missing: true, title: 'Old song' });
    expect(o.estimated).toBe(true);
    expect(totalLabel(o.totalSeconds, o.estimated)).toBe('about 15 min');
  });

  it('adds clock time and labels days', () => {
    expect(addClock('23:50', 900)).toBe('00:05');
    expect(addClock('', 60)).toBe(null);
    const now = new Date(2026, 9, 26, 9).getTime();
    expect(daysLabel(daysAway('2026-11-01', now))).toBe('in 6 days');
    expect(daysLabel(daysAway('2026-10-26', now))).toBe('today');
  });
});
