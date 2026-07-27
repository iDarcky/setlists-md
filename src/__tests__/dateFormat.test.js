import { describe, it, expect } from 'vitest';
import {
  formatClockTime,
  nextSundayDateStr,
  weekdayLabels,
  firstDayOffset,
} from '@/lib/dateFormat';

describe('formatClockTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatClockTime('')).toBe('');
    expect(formatClockTime(null)).toBe('');
    expect(formatClockTime(undefined)).toBe('');
  });

  it('formats morning time in 12h (contains AM)', () => {
    const result = formatClockTime('08:00', '12h');
    expect(result).toMatch(/8/);
    expect(result.toUpperCase()).toContain('AM');
  });

  it('formats afternoon time in 12h (contains PM)', () => {
    const result = formatClockTime('20:00', '12h');
    expect(result).toMatch(/8/);
    expect(result.toUpperCase()).toContain('PM');
  });

  it('formats time in 24h — no AM/PM, zero-padded hour', () => {
    const morning = formatClockTime('08:00', '24h');
    expect(morning).toBe('08:00');
    const evening = formatClockTime('20:00', '24h');
    expect(evening).toBe('20:00');
  });

  it('defaults to 12h format when no format argument given', () => {
    const result = formatClockTime('09:30');
    expect(result.toUpperCase()).toContain('AM');
  });
});

describe('nextSundayDateStr', () => {
  // Helper — build a Date at midnight in local time for a given YYYY-MM-DD.
  function localDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  it('returns the following Sunday when called on a Monday', () => {
    // 2026-06-08 is a Monday; next Sunday is 2026-06-14
    const result = nextSundayDateStr(localDate('2026-06-08'));
    expect(result).toBe('2026-06-14');
  });

  it('returns the following Sunday when called on a Saturday', () => {
    // 2026-06-13 is a Saturday; next Sunday is 2026-06-14
    const result = nextSundayDateStr(localDate('2026-06-13'));
    expect(result).toBe('2026-06-14');
  });

  it('returns the NEXT Sunday (7 days later) when called on a Sunday — never today', () => {
    // 2026-06-07 is a Sunday; should return 2026-06-14, not 2026-06-07
    const result = nextSundayDateStr(localDate('2026-06-07'));
    expect(result).toBe('2026-06-14');
  });

  it('returns a YYYY-MM-DD string', () => {
    const result = nextSundayDateStr(localDate('2026-01-01'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles month and year boundaries', () => {
    // 2026-12-28 is a Monday (day 1); 6 days ahead → 2027-01-03 (Sunday)
    const result = nextSundayDateStr(localDate('2026-12-28'));
    expect(result).toBe('2027-01-03');
  });
});

describe('weekdayLabels', () => {
  it('starts with Sunday by default', () => {
    const labels = weekdayLabels();
    expect(labels[0]).toBe('Sun');
    expect(labels[6]).toBe('Sat');
    expect(labels).toHaveLength(7);
  });

  it('starts with Sunday when explicitly requested', () => {
    const labels = weekdayLabels('sunday');
    expect(labels[0]).toBe('Sun');
  });

  it('starts with Monday when requested', () => {
    const labels = weekdayLabels('monday');
    expect(labels[0]).toBe('Mon');
    expect(labels[6]).toBe('Sun');
    expect(labels).toHaveLength(7);
  });

  it('contains the same 7 days regardless of first-day setting', () => {
    const sun = new Set(weekdayLabels('sunday'));
    const mon = new Set(weekdayLabels('monday'));
    expect(sun).toEqual(mon);
  });
});

describe('firstDayOffset', () => {
  it('returns 0 for sunday (default)', () => {
    expect(firstDayOffset()).toBe(0);
    expect(firstDayOffset('sunday')).toBe(0);
  });

  it('returns 1 for monday', () => {
    expect(firstDayOffset('monday')).toBe(1);
  });
});
