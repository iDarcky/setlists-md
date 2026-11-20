import { describe, it, expect } from 'vitest';
import { checkEntitlement, PLAN_RANK, FEATURE_GATES } from '@/hooks/useEntitlement';

// The plan lives on the group. A person has no plan of their own, so nothing
// here takes a profile.
describe('checkEntitlement', () => {
  it('opens every feature that has no gate, on any plan', () => {
    for (const plan of ['free', 'team', 'church', null, undefined, 'nonsense']) {
      const result = checkEntitlement(plan, 'nonexistent-feature');
      expect(result.allowed).toBe(true);
      expect(result.requiredPlan).toBe('free');
    }
  });

  it('no longer sells chart style, chord shapes or import', () => {
    // These were the old Pro and Sync locks ("Fonts are part of Pro").
    for (const feature of ['chart-style', 'chord-diagrams', 'smart-import']) {
      expect(FEATURE_GATES).not.toHaveProperty(feature);
      expect(checkEntitlement('free', feature).allowed).toBe(true);
      expect(checkEntitlement(null, feature).allowed).toBe(true);
    }
  });

  it('gives every plan every feature: plans differ by seats only', () => {
    for (const plan of ['free', 'team', 'church', null]) {
      for (const feature of ['multi-service', 'schedule']) {
        expect(checkEntitlement(plan, feature).allowed).toBe(true);
      }
    }
  });

  it('is case-insensitive for plan names', () => {
    expect(checkEntitlement('CHURCH', 'multi-service').allowed).toBe(true);
    expect(checkEntitlement('Team', 'multi-service').currentPlan).toBe('team');
  });

});

describe('PLAN_RANK', () => {
  it('has strictly increasing ranks', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.team);
    expect(PLAN_RANK.team).toBeLessThan(PLAN_RANK.church);
  });

  it('has no per-person tiers left', () => {
    expect(PLAN_RANK).not.toHaveProperty('sync');
    expect(PLAN_RANK).not.toHaveProperty('pro');
  });
});

describe('FEATURE_GATES', () => {
  it('every gate maps to a valid plan', () => {
    for (const [, plan] of Object.entries(FEATURE_GATES)) {
      expect(PLAN_RANK).toHaveProperty(plan);
    }
  });
});
