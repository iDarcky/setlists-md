// Which mode a setlist opens in, from the clock.
//
// ⚠ The `service` fixture below records a SAME-DAY rehearsal, and that is the
// less common shape. The owner's own band does not: *"a rehearsal is not
// recorded for the Sunday morning, is recorded for a Friday afternoon"* — their
// 09:00–09:45 warm-up exists only in people's heads, so for them the 30-minute
// lead-in is the entire rule and `noRehearsal` is the realistic fixture.
//
// Both are tested because both are real: a church that records a call time
// gets the clause, and everyone else gets the lead-in.
import { describe, it, expect } from 'vitest';
import { resolveOpeningMode } from '@/lib/openingMode';

const on = (t) => new Date(`2026-08-16T${t}:00`).getTime();

// Service 10:00–11:30, rehearsal 09:00 the same morning.
const service = {
  date: '2026-08-16', time: '10:00', endTime: '11:30',
  rehearsalDate: '2026-08-16', rehearsalTime: '09:00',
};
// The same service with no rehearsal recorded.
const noRehearsal = { date: '2026-08-16', time: '10:00', endTime: '11:30' };

describe('opening mode, from the clock', () => {
  it('is practice on any other day', () => {
    expect(resolveOpeningMode(service, new Date('2026-08-12T20:00:00').getTime())).toBe('practice');
    expect(resolveOpeningMode(service, new Date('2026-08-17T10:00:00').getTime())).toBe('practice');
  });

  it('is live during the service', () => {
    expect(resolveOpeningMode(service, on('10:00'))).toBe('live');
    expect(resolveOpeningMode(service, on('10:20'))).toBe('live');
    expect(resolveOpeningMode(service, on('11:30'))).toBe('live');
  });

  it('is practice after the service ends', () => {
    expect(resolveOpeningMode(service, on('11:31'))).toBe('practice');
    expect(resolveOpeningMode(service, on('14:00'))).toBe('practice');
  });

  // ⚠ THE CASE THE RULE EXISTS FOR.
  it('stays in practice through a rehearsal that runs into the live window', () => {
    // 09:30 is inside the naive 30-minute lead-in AND inside the rehearsal.
    // The rehearsal is a fact the leader entered; the lead-in is a guess.
    expect(resolveOpeningMode(service, on('09:00'))).toBe('practice');
    expect(resolveOpeningMode(service, on('09:30'))).toBe('practice');
    expect(resolveOpeningMode(service, on('09:45'))).toBe('practice');
    expect(resolveOpeningMode(service, on('09:59'))).toBe('practice');
  });

  it('uses the 30-minute lead-in when no rehearsal is recorded', () => {
    expect(resolveOpeningMode(noRehearsal, on('09:29'))).toBe('practice');
    expect(resolveOpeningMode(noRehearsal, on('09:30'))).toBe('live');
    expect(resolveOpeningMode(noRehearsal, on('09:59'))).toBe('live');
  });

  it('ignores a rehearsal recorded for a DIFFERENT day', () => {
    // A Thursday rehearsal for a Sunday service must not hold Sunday back.
    const thursday = { ...noRehearsal, rehearsalDate: '2026-08-13', rehearsalTime: '19:00' };
    expect(resolveOpeningMode(thursday, on('09:30'))).toBe('live');
  });

  it('runs three hours when no end time is set', () => {
    const open = { date: '2026-08-16', time: '10:00' };
    expect(resolveOpeningMode(open, on('12:59'))).toBe('live');
    expect(resolveOpeningMode(open, on('13:01'))).toBe('practice');
  });

  it('is practice for anything with no schedule at all', () => {
    // Campfire is the real one: an ephemeral one-item setlist with no date.
    expect(resolveOpeningMode({ _campfire: true, items: [] }, on('10:00'))).toBe('practice');
    expect(resolveOpeningMode({ date: '2026-08-16' }, on('10:00'))).toBe('practice');
    expect(resolveOpeningMode(null, on('10:00'))).toBe('practice');
    expect(resolveOpeningMode(undefined, on('10:00'))).toBe('practice');
  });

  it('survives times it cannot read', () => {
    // A malformed endTime BEFORE the start would make the window empty and live
    // unreachable — silently, on the day it matters.
    expect(resolveOpeningMode({ ...noRehearsal, endTime: '08:00' }, on('10:30'))).toBe('live');
    expect(resolveOpeningMode({ date: 'nonsense', time: '10:00' }, on('10:00'))).toBe('practice');
    expect(resolveOpeningMode({ date: '2026-08-16', time: '25:99' }, on('10:00'))).toBe('practice');
  });
});
