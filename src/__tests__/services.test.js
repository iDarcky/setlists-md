import { describe, it, expect } from 'vitest';
import { serviceDates, myServiceDates, repeatLabel, whenLabel, setlistFor, serviceColor, dateState } from '@/lib/services';

// Tuesday 20 October 2026.
const FROM = new Date(2026, 9, 20);

describe('serviceDates', () => {
  it('lists every Sunday from the next one', () => {
    expect(serviceDates({ weekday: 0 }, { from: FROM, weeks: 3 })).toEqual(['2026-10-25', '2026-11-01', '2026-11-08']);
  });

  it('includes today when today is the day', () => {
    expect(serviceDates({ weekday: 2 }, { from: FROM, weeks: 1 })).toEqual(['2026-10-20']);
  });

  it('keeps only the nth weekday of the month', () => {
    // 1st Wednesdays inside 12 weeks from 20 Oct: 4 Nov, 2 Dec, 6 Jan.
    expect(serviceDates({ weekday: 3, nth: 1 }, { from: FROM, weeks: 12 })).toEqual(['2026-11-04', '2026-12-02', '2027-01-06']);
  });

  it('skips a month without a fifth weekday', () => {
    // Fridays: October 2026 has a 5th (30 Oct), November does not.
    expect(serviceDates({ weekday: 5, nth: 5 }, { from: FROM, weeks: 6 })).toEqual(['2026-10-30']);
  });
});

describe('myServiceDates', () => {
  const services = [
    { id: 'morning', name: 'Sunday Morning', weekday: 0, start_time: '10:00:00', ask_weeks: 2 },
    { id: 'youth', name: 'Youth Night', weekday: 5, start_time: '19:00:00', ask_weeks: 2 },
    { id: 'evening', name: 'Sunday Evening', weekday: 0, start_time: '18:00:00', ask_weeks: 2 },
  ];
  const members = [
    { service_id: 'morning', user_id: 'ana' },
    { service_id: 'youth', user_id: 'ana' },
    { service_id: 'evening', user_id: 'tom' },
  ];

  it('only returns the services the person is on, in date order', () => {
    const got = myServiceDates('ana', services, members, { from: FROM }).map(x => `${x.date} ${x.service.id}`);
    expect(got).toEqual(['2026-10-23 youth', '2026-10-25 morning', '2026-10-30 youth', '2026-11-01 morning']);
  });

  it('is empty for someone on no service', () => {
    expect(myServiceDates('nobody', services, members, { from: FROM })).toEqual([]);
  });
});

describe('labels', () => {
  it('reads like a person would say it', () => {
    expect(repeatLabel({ weekday: 0 })).toBe('Every Sunday');
    expect(repeatLabel({ weekday: 3, nth: 1 })).toBe('Every 1st Wednesday');
    expect(whenLabel({ weekday: 5, start_time: '19:00:00' })).toBe('Every Friday · 19:00');
  });

  it('falls back to the first colour for an unknown id', () => {
    expect(serviceColor('nope')).toBe(serviceColor('teal'));
  });
});

describe('setlistFor', () => {
  it('matches the setlist by date and service name, ignoring case', () => {
    const setlists = [
      { id: 'a', date: '2026-10-25', service: 'sunday morning ' },
      { id: 'b', date: '2026-10-25', service: 'Sunday Evening' },
    ];
    expect(setlistFor({ name: 'Sunday Morning' }, '2026-10-25', setlists)?.id).toBe('a');
    expect(setlistFor({ name: 'Youth Night' }, '2026-10-25', setlists)).toBe(null);
  });
});

describe('dateState', () => {
  const service = { id: 'morning', name: 'Sunday Morning' };
  const setlists = [{ id: 'local-1', date: '2026-10-25', service: 'Sunday Morning' }];
  const setlistMap = { 'local-1': 'row-1' };
  const base = { date: '2026-10-25', service, setlists, setlistMap, userId: 'ana' };

  it('is open when no setlist exists for the date yet', () => {
    expect(dateState({ ...base, date: '2026-11-01', schedules: [] }).kind).toBe('open');
  });

  it('bridges the local setlist id to the row uuid before matching a schedule', () => {
    const schedules = [{ user_id: 'ana', setlist_id: 'row-1', availability: 'pending' }];
    expect(dateState({ ...base, schedules }).kind).toBe('asked');
    // The local id alone never matches (team_schedules holds the row uuid).
    expect(dateState({ ...base, schedules: [{ user_id: 'ana', setlist_id: 'local-1', availability: 'pending' }] }).kind).toBe('open');
  });

  it('reads available as playing and unavailable as declined', () => {
    expect(dateState({ ...base, schedules: [{ user_id: 'ana', setlist_id: 'row-1', availability: 'available' }] }).kind).toBe('playing');
    expect(dateState({ ...base, schedules: [{ user_id: 'ana', setlist_id: 'row-1', availability: 'unavailable' }] }).kind).toBe('declined');
  });
});
