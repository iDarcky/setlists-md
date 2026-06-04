import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTeam } from '../auth/useTeam';

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
  const { activeLibrary } = useWorkspace();
  const { team } = useTeam();
  const { profile } = useAuth();
  
  const isPersonal = activeLibrary === 'personal';
  
  // 1. Determine current rank based on context
  // Team/church workspaces gate on the team's own plan. The schema and
  // TeamProvider expose `team.plan` (team|church) — not `billing_plan`, which
  // never existed and silently resolved every team feature to `free`.
  const currentPlan = isPersonal
    ? (profile?.subscription_tier || 'free').toLowerCase()
    : (team?.plan || 'free').toLowerCase();
    
  const requiredPlan = FEATURE_GATES[feature] || 'free';
  let allowed = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);

  // 2. Per-workspace billing: a team/church workspace carries its own Stripe
  // subscription. If that subscription has lapsed the whole workspace drops to
  // free-tier access — paid features gate off until billing is restored.
  // Defaults to 'active' when the column is absent (pre-migration projects) so
  // existing teams keep working.
  const subscriptionStatus = isPersonal
    ? null
    : (team?.subscription_status || 'active').toLowerCase();
  if (!isPersonal && team && requiredPlan !== 'free') {
    const billingOk = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
    if (!billingOk) allowed = false;
  }

  // 3. Special carve-outs for 'Pro' one-time purchases in Personal mode
  if (isPersonal && profile?.is_pro) {
    if (feature === 'chart-style' || feature === 'cloud-sync' || feature === 'smart-import') {
      allowed = true;
    }
  }

  return { allowed, requiredPlan, currentPlan, subscriptionStatus };
}

/**
 * Non-hook version for use outside of React components (e.g. in callbacks
 * where you already have the profile object).
 * We pass isPro to allow one-time purchase overrides.
 */
export function checkEntitlement(plan, feature, isPro = false) {
  const currentPlan = (plan || 'free').toLowerCase();
  const requiredPlan = FEATURE_GATES[feature] || 'free';
  let allowed = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
  
  if (isPro) {
    if (feature === 'chart-style' || feature === 'cloud-sync' || feature === 'smart-import') {
      allowed = true;
    }
  }

  return { allowed, requiredPlan, currentPlan };
}

export { PLAN_RANK, FEATURE_GATES };
