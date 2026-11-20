import { describe, it, expect } from 'vitest';
import { PLANS, PLAN_ORDER, planKeyOf, planOf } from '@/lib/plans';
import { checkEntitlement } from '@/hooks/useEntitlement';

// Plans (2026-11-19, seats only since 2026-11-20): Free 5, Band 15 (€9.99),
// Church 40 (€19.99). Every plan gets every feature.
describe('plans', () => {
  it('has the three plans with their seats and prices', () => {
    expect(PLAN_ORDER).toEqual(['free', 'team', 'church']);
    expect(PLANS.free).toMatchObject({ label: 'Free', seats: 5, price: null });
    expect(PLANS.team).toMatchObject({ label: 'Band', seats: 15, price: '€9.99 a month' });
    expect(PLANS.church).toMatchObject({ label: 'Church', seats: 40, price: '€19.99 a month' });
  });
  it('reads anything unknown as Free', () => {
    expect(planKeyOf(null)).toBe('free');
    expect(planKeyOf('personal')).toBe('free');
    expect(planKeyOf('CHURCH')).toBe('church');
    expect(planOf('team').label).toBe('Band');
  });
  it('locks no feature on any plan', () => {
    for (const plan of PLAN_ORDER) {
      expect(checkEntitlement(plan, 'schedule').allowed).toBe(true);
      expect(checkEntitlement(plan, 'multi-service').allowed).toBe(true);
    }
  });
});
