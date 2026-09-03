import { describe, it, expect } from 'vitest';
import { setlistStartMs, setlistEndMs, isSetlistUpcoming, SETLIST_GRACE_MS } from '@/lib/setlistTime';

const at = (date, time) => new Date(`${date}T${time}:00`).getTime();
const date = '2026-06-29';

describe('setlistTime', () => {
  it('start = date + time', () => {
    expect(setlistStartMs({ date, time: '10:00' })).toBe(at(date, '10:00'));
  });

  it('end falls back to start + grace when no endTime', () => {
    expect(setlistEndMs({ date, time: '10:00' })).toBe(at(date, '10:00') + SETLIST_GRACE_MS);
  });

  it('end uses endTime when it is after the start', () => {
    expect(setlistEndMs({ date, time: '10:00', endTime: '12:00' })).toBe(at(date, '12:00'));
  });

  it('ignores an endTime that is not after the start', () => {
    expect(setlistEndMs({ date, time: '10:00', endTime: '09:00' })).toBe(at(date, '10:00') + SETLIST_GRACE_MS);
  });

  it('stays upcoming through its slot when an end time is set', () => {
    const now = at(date, '11:00'); // mid-service
    expect(isSetlistUpcoming({ date, time: '10:00', endTime: '12:00' }, now)).toBe(true);
    // without an end time, 11:00 is past the 1h grace after a 10:00 start
    expect(isSetlistUpcoming({ date, time: '10:00' }, now)).toBe(false);
  });

  it('becomes past once the end time passes', () => {
    expect(isSetlistUpcoming({ date, time: '10:00', endTime: '12:00' }, at(date, '12:30'))).toBe(false);
  });

  it('a future set is upcoming', () => {
    expect(isSetlistUpcoming({ date, time: '10:00' }, at(date, '08:00'))).toBe(true);
  });
});
