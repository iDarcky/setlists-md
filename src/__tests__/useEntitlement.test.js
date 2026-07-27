import { describe, it, expect } from 'vitest';
import { checkEntitlement, PLAN_RANK, FEATURE_GATES } from '@/hooks/useEntitlement';

describe('checkEntitlement', () => {
  it('free plan can access ungated features', () => {
    const result = checkEntitlement('free', 'nonexistent-feature');
    expect(result.allowed).toBe(true);
    expect(result.requiredPlan).toBe('free');
  });

  it('free plan cannot access sync features', () => {
    const result = checkEntitlement('free', 'cloud-sync');
    expect(result.allowed).toBe(false);
    expect(result.requiredPlan).toBe('sync');
  });

  it('free plan cannot access team features', () => {
    const result = checkEntitlement('free', 'team-create');
    expect(result.allowed).toBe(false);
    expect(result.requiredPlan).toBe('team');
  });

  it('free plan cannot access church features', () => {
    const result = checkEntitlement('free', 'multi-service');
    expect(result.allowed).toBe(false);
    expect(result.requiredPlan).toBe('church');
  });

  it('sync plan can access sync features', () => {
    expect(checkEntitlement('sync', 'cloud-sync').allowed).toBe(true);
    expect(checkEntitlement('sync', 'smart-import').allowed).toBe(true);
  });

  it('sync plan cannot access team features', () => {
    expect(checkEntitlement('sync', 'team-create').allowed).toBe(false);
    expect(checkEntitlement('sync', 'team-library').allowed).toBe(false);
  });

  it('team plan can access team and all lower-tier features', () => {
    expect(checkEntitlement('team', 'cloud-sync').allowed).toBe(true);
    expect(checkEntitlement('team', 'smart-import').allowed).toBe(true);
    expect(checkEntitlement('team', 'team-create').allowed).toBe(true);
    expect(checkEntitlement('team', 'team-library').allowed).toBe(true);
    expect(checkEntitlement('team', 'team-collab').allowed).toBe(true);
    expect(checkEntitlement('team', 'team-roles').allowed).toBe(true);
  });

  it('team plan cannot access church features', () => {
    expect(checkEntitlement('team', 'multi-service').allowed).toBe(false);
  });

  it('church plan can access everything', () => {
    for (const feature of Object.keys(FEATURE_GATES)) {
      expect(checkEntitlement('church', feature).allowed).toBe(true);
    }
  });

  it('handles null/undefined plan as free', () => {
    expect(checkEntitlement(null, 'cloud-sync').allowed).toBe(false);
    expect(checkEntitlement(undefined, 'cloud-sync').allowed).toBe(false);
    expect(checkEntitlement(null, 'nonexistent').allowed).toBe(true);
  });

  it('is case-insensitive for plan names', () => {
    expect(checkEntitlement('Team', 'team-create').allowed).toBe(true);
    expect(checkEntitlement('CHURCH', 'multi-service').allowed).toBe(true);
    expect(checkEntitlement('Sync', 'cloud-sync').allowed).toBe(true);
  });

  it('returns correct currentPlan and requiredPlan', () => {
    const result = checkEntitlement('sync', 'team-create');
    expect(result.currentPlan).toBe('sync');
    expect(result.requiredPlan).toBe('team');
    expect(result.allowed).toBe(false);
  });
});

describe('PLAN_RANK', () => {
  it('has strictly increasing ranks', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.sync);
    expect(PLAN_RANK.sync).toBeLessThan(PLAN_RANK.team);
    expect(PLAN_RANK.team).toBeLessThan(PLAN_RANK.church);
  });
});

describe('FEATURE_GATES', () => {
  it('every gate maps to a valid plan', () => {
    for (const [, plan] of Object.entries(FEATURE_GATES)) {
      expect(PLAN_RANK).toHaveProperty(plan);
    }
  });
});
