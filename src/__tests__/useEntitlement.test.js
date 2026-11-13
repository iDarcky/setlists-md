import { describe, it, expect } from 'vitest';
import { checkEntitlement, personalCloudAllowed, PLAN_RANK, FEATURE_GATES } from '@/hooks/useEntitlement';

// The plan lives on the group. A person has no plan of their own, so nothing
// here takes a profile except the leftover Personal cloud check.
describe('checkEntitlement', () => {
  it('opens every feature that has no gate, on any plan', () => {
    for (const plan of ['free', 'personal', 'team', 'church', null, undefined, 'nonsense']) {
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

  it('keeps services for Church groups only', () => {
    expect(checkEntitlement('church', 'multi-service').allowed).toBe(true);
    expect(checkEntitlement('team', 'multi-service').allowed).toBe(false);
    expect(checkEntitlement('free', 'multi-service').allowed).toBe(false);
    expect(checkEntitlement('personal', 'multi-service').allowed).toBe(false);
    expect(checkEntitlement(null, 'multi-service').allowed).toBe(false);
    expect(checkEntitlement('team', 'multi-service').requiredPlan).toBe('church');
  });

  it('is case-insensitive for plan names', () => {
    expect(checkEntitlement('CHURCH', 'multi-service').allowed).toBe(true);
    expect(checkEntitlement('Team', 'multi-service').currentPlan).toBe('team');
  });

  it('has no Pro override', () => {
    // A third argument used to unlock features for `profiles.is_pro`.
    expect(checkEntitlement('team', 'multi-service', true).allowed).toBe(false);
  });
});

describe('personalCloudAllowed', () => {
  it('keeps Personal cloud only for accounts that already had it', () => {
    expect(personalCloudAllowed({ subscription_tier: 'church' })).toBe(true);
    expect(personalCloudAllowed({ subscription_tier: 'Team' })).toBe(true);
    expect(personalCloudAllowed({ subscription_tier: 'sync' })).toBe(true);
  });

  it('is closed to everyone else, and ignores is_pro', () => {
    expect(personalCloudAllowed({ subscription_tier: 'free' })).toBe(false);
    expect(personalCloudAllowed({ subscription_tier: 'free', is_pro: true })).toBe(false);
    expect(personalCloudAllowed({})).toBe(false);
    expect(personalCloudAllowed(null)).toBe(false);
  });
});

describe('PLAN_RANK', () => {
  it('has strictly increasing ranks', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.team);
    expect(PLAN_RANK.team).toBeLessThan(PLAN_RANK.church);
  });

  it('has no personal tiers left', () => {
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
