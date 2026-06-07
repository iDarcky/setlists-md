import { useAuth } from '../auth/useAuth';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTeam } from '../auth/useTeam';

// Plan hierarchy — higher rank = more access.
//
// Single-user tiers: free → sync. The one-time **Pro** purchase is not a rank
// here; it's an overlay flag (`profile.is_pro`) that unlocks the same
// single-user paid features as Sync but via Bring-Your-Own-Cloud (see the
// carve-out below). Workspace tiers: **Band** (internal key `team`, 10 seats)
// and **Church** (`church`, 30 seats) gate on the workspace's own plan.
const PLAN_RANK = { free: 0, sync: 1, team: 2, church: 3 };

// Feature → minimum required plan.
// Every gated feature in the app should have an entry here. Adding a new
// gated feature? Add its key here and call `useEntitlement('feature-key')`
// in the component that renders it.
const FEATURE_GATES = {
  // Single-user paid features — covered by Sync ($5/mo) or the one-time
  // Pro purchase ($25, BYOC). The is_pro carve-out below unlocks these.
  'cloud-sync':    'sync',
  'smart-import':  'sync',
  'chart-style':   'sync',   // advanced layout: themes, colours, custom fonts

  // Band tier (internal key `team`, $15/mo, up to 10 seats)
  'team-create':   'team',
  'team-library':  'team',
  'team-collab':   'team',
  'team-roles':    'team',

  // Church tier ($25/mo, up to 30 seats)
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
