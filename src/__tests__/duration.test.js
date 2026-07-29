import { describe, it, expect } from 'vitest';
import { durationToSeconds, formatTotalDuration, formatClock, formatElapsed } from '@/lib/duration';

describe('durationToSeconds', () => {
  it('returns 0 for null / undefined / empty', () => {
    expect(durationToSeconds(null)).toBe(0);
    expect(durationToSeconds(undefined)).toBe(0);
    expect(durationToSeconds('')).toBe(0);
    expect(durationToSeconds('   ')).toBe(0);
  });

  it('treats a bare integer string as minutes', () => {
    expect(durationToSeconds('3')).toBe(180);
    expect(durationToSeconds('1')).toBe(60);
    expect(durationToSeconds('0')).toBe(0);
  });

  it('treats a bare decimal string as fractional minutes', () => {
    expect(durationToSeconds('3.5')).toBe(210);
    expect(durationToSeconds('0.5')).toBe(30);
  });

  it('treats a bare number value as minutes', () => {
    expect(durationToSeconds(4)).toBe(240);
    expect(durationToSeconds(1.5)).toBe(90);
  });

  it('parses m:ss clock format', () => {
    expect(durationToSeconds('3:30')).toBe(210);
    expect(durationToSeconds('0:45')).toBe(45);
    expect(durationToSeconds('10:00')).toBe(600);
    expect(durationToSeconds('0:00')).toBe(0);
  });

  it('parses h:mm:ss clock format', () => {
    expect(durationToSeconds('1:05:30')).toBe(3930);
    expect(durationToSeconds('0:01:00')).toBe(60);
    expect(durationToSeconds('2:00:00')).toBe(7200);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(durationToSeconds('abc')).toBe(0);
    expect(durationToSeconds('--')).toBe(0);
  });
});

describe('formatTotalDuration', () => {
  it('returns "0 min" for zero or falsy input', () => {
    expect(formatTotalDuration(0)).toBe('0 min');
    expect(formatTotalDuration(null)).toBe('0 min');
    expect(formatTotalDuration(undefined)).toBe('0 min');
  });

  it('formats sub-hour totals as "<N> min"', () => {
    expect(formatTotalDuration(60)).toBe('1 min');
    expect(formatTotalDuration(2700)).toBe('45 min');
    expect(formatTotalDuration(3540)).toBe('59 min');
  });

  it('formats exactly one hour as "1h"', () => {
    expect(formatTotalDuration(3600)).toBe('1h');
  });

  it('formats hours with leftover minutes as "<N>h <M>m"', () => {
    expect(formatTotalDuration(3900)).toBe('1h 5m');
    expect(formatTotalDuration(7260)).toBe('2h 1m');
  });

  it('omits the minute part when minutes are zero', () => {
    expect(formatTotalDuration(7200)).toBe('2h');
  });
});

describe('formatClock', () => {
  it('reads as transport time', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(225)).toBe('3:45');
    expect(formatClock(3750)).toBe('62:30'); // minutes keep counting past an hour
  });

  it('never shows a negative or a NaN on a scrubber', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(NaN)).toBe('0:00');
    expect(formatClock(undefined)).toBe('0:00');
  });
});

describe('formatElapsed', () => {
  it('keeps seconds while they still matter', () => {
    expect(formatElapsed(8_000)).toBe('8s');
    expect(formatElapsed(125_000)).toBe('2m 05s');
    expect(formatElapsed(2_530_000)).toBe('42m 10s');
  });

  it('drops seconds once there is an hour on the clock', () => {
    expect(formatElapsed(3_900_000)).toBe('1h 5m');
    expect(formatElapsed(3_600_000)).toBe('1h 0m');
  });

  it('floors at zero rather than showing a negative session', () => {
    expect(formatElapsed(-1000)).toBe('0s');
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(undefined)).toBe('0s');
  });
});
