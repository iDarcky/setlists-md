import { useAuth } from '../auth/useAuth';

// Plan hierarchy — higher rank = more access.
const PLAN_RANK = { free: 0, sync: 1, team: 2, church: 3 };

// Feature → minimum required plan.
// Every gated feature in the app should have an entry here. Adding a new
// gated feature? Add its key here and call `useEntitlement('feature-key')`
// in the component that renders it.
const FEATURE_GATES = {
  // Sync tier ($9 one-time)
  'cloud-sync':    'sync',
  'smart-import':  'sync',
  'chart-style':   'sync',   // advanced layout: themes, colours, custom fonts

  // Team tier ($12/mo)
  'team-create':   'team',
  'team-library':  'team',
  'team-collab':   'team',
  'team-roles':    'team',

  // Church tier ($24/mo)
  'multi-service': 'church',
};

/**
 * Check whether the current user's plan allows access to a given feature.
 *
 * @param {string} feature — key from FEATURE_GATES
 * @returns {{ allowed: boolean, requiredPlan: string, currentPlan: string }}
 */
export function useEntitlement(feature) {
  const { profile } = useAuth();
  const currentPlan = (profile?.plan || 'free').toLowerCase();
  const requiredPlan = FEATURE_GATES[feature] || 'free';
  const allowed = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
  return { allowed, requiredPlan, currentPlan };
}

/**
 * Non-hook version for use outside of React components (e.g. in callbacks
 * where you already have the profile object).
 */
export function checkEntitlement(plan, feature) {
  const currentPlan = (plan || 'free').toLowerCase();
  const requiredPlan = FEATURE_GATES[feature] || 'free';
  const allowed = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
  return { allowed, requiredPlan, currentPlan };
}

export { PLAN_RANK, FEATURE_GATES };
