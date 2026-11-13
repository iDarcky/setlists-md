import { useWorkspace } from '@/contexts/workspace';
import { useTeam } from '@/auth/useTeam';

// The plan lives on the GROUP (`teams.plan`), never on a person. A member is
// never checked for a plan of their own: no Pro, no personal tier. Seats are
// the main limit and the database enforces them (`teams.max_seats`); the only
// feature that depends on the group's plan is services, which is Church-only.
//
// Plan keys on a group: `team` (Band, 10 seats) and `church` (Church, 30
// seats). Anything else, Personal included, ranks as `free`.
const PLAN_RANK = { free: 0, team: 1, church: 2 };

// Feature → minimum group plan. A feature with no entry here is open to
// everyone, everywhere. Chart style, fonts, colours, themes and chord shapes
// used to be listed (the old Pro and Sync tiers) and are free now.
const FEATURE_GATES = {
  'multi-service': 'church',
};

function rank(plan) {
  return PLAN_RANK[(plan || 'free').toLowerCase()] ?? 0;
}

/**
 * Pure check: does a group on `plan` get `feature`?
 * @param {string|null|undefined} plan — the group's plan (`teams.plan`)
 * @param {string} feature — key from FEATURE_GATES; unknown keys are open
 * @returns {{ allowed: boolean, requiredPlan: string, currentPlan: string }}
 */
export function checkEntitlement(plan, feature) {
  const currentPlan = (plan || 'free').toLowerCase();
  const requiredPlan = FEATURE_GATES[feature] || 'free';
  return { allowed: rank(currentPlan) >= rank(requiredPlan), requiredPlan, currentPlan };
}

/**
 * Does the open group's plan include a feature?
 *
 * @param {string} feature — key from FEATURE_GATES
 * @returns {{ allowed: boolean, requiredPlan: string, currentPlan: string, subscriptionStatus: string|null }}
 */
export function useEntitlement(feature) {
  const { activeLibrary } = useWorkspace();
  const { team } = useTeam();

  const isPersonal = activeLibrary === 'personal';
  const group = isPersonal ? null : team;
  const result = checkEntitlement(group?.plan, feature);

  // A group whose subscription lapsed loses its plan's extras until billing is
  // restored. Absent status (older rows) counts as active.
  const subscriptionStatus = group ? (group.subscription_status || 'active').toLowerCase() : null;
  if (group && result.requiredPlan !== 'free') {
    const billingOk = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
    if (!billingOk) result.allowed = false;
  }

  return { ...result, subscriptionStatus };
}

/**
 * Personal's cloud copy, for the few accounts that already had one. Personal
 * is being removed, so this is not opened to anyone new; it reads the legacy
 * `profiles.subscription_tier` and goes away with Personal.
 */
export function personalCloudAllowed(profile) {
  const tier = (profile?.subscription_tier || 'free').toLowerCase();
  return tier === 'sync' || tier === 'team' || tier === 'church';
}

export { PLAN_RANK, FEATURE_GATES };
