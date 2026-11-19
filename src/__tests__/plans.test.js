import { describe, it, expect } from 'vitest';
import { PLANS, PLAN_ORDER, planKeyOf, planOf } from '@/lib/plans';
import { wordsFor, isChurchSpace } from '@/lib/spaceWords';
import { checkEntitlement } from '@/hooks/useEntitlement';
import { needsYou, setupSteps } from '@/lib/homeData';

// Plans decided 2026-11-19: Free 5, Band 15 (€9.99), Church 40 (€19.99) with
// the schedule and services.
describe('plans', () => {
  it('has the three plans with their seats', () => {
    expect(PLAN_ORDER).toEqual(['free', 'team', 'church']);
    expect(PLANS.free.seats).toBe(5);
    expect(PLANS.team).toMatchObject({ label: 'Band', seats: 15, price: '€9.99 a month' });
    expect(PLANS.church).toMatchObject({ label: 'Church', seats: 40, price: '€19.99 a month' });
  });
  it('reads anything unknown as Free', () => {
    expect(planKeyOf(null)).toBe('free');
    expect(planKeyOf('personal')).toBe('free');
    expect(planKeyOf('CHURCH')).toBe('church');
    expect(planOf('team').label).toBe('Band');
  });
});

describe('the schedule is Church-only', () => {
  it('opens on Church, closes on Free and Band', () => {
    expect(checkEntitlement('church', 'schedule').allowed).toBe(true);
    expect(checkEntitlement('team', 'schedule').allowed).toBe(false);
    expect(checkEntitlement('free', 'schedule').allowed).toBe(false);
  });
  it('does not nag about a missing band without a schedule', () => {
    const now = Date.parse('2026-11-20T10:00:00Z');
    const sl = { id: 'a', date: '2026-11-22', time: '10:00', items: [{ songId: 's1' }] };
    expect(needsYou({ setlists: [sl], now }).map(i => i.kind)).toEqual(['noband']);
    expect(needsYou({ setlists: [sl], now, schedule: false })).toEqual([]);
  });
  it('leaves the "answer your first ask" step out without a schedule', () => {
    const ids = (o) => setupSteps(o).map(s => s.id);
    expect(ids({ push: { supported: true } })).toContain('answer');
    expect(ids({ push: { supported: true }, schedule: false })).toEqual(['parts']);
  });
});

describe('church or band words', () => {
  it('uses church words only for a church', () => {
    expect(isChurchSpace({ kind: 'church' })).toBe(true);
    expect(wordsFor({ kind: 'church' })).toMatchObject({ space: 'church', event: 'service', leader: 'worship leader' });
  });
  it('uses plain band words for a band, or no group at all', () => {
    for (const team of [{ kind: 'team' }, { kind: null }, null, undefined]) {
      const w = wordsFor(team);
      expect(w).toMatchObject({ space: 'band', event: 'event', leader: 'leader', day: 'date' });
      expect(JSON.stringify(w)).not.toMatch(/church|service|worship|sunday/i);
    }
  });
});
