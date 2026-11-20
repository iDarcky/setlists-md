import { useWorkspace } from '@/contexts/workspace';
import { useTeam } from '@/auth/useTeam';

// The plan lives on the GROUP (`teams.plan`), never on a person. A member is
// never checked for a plan of their own: no Pro, no tier on the account. Seats are
// the only limit and the database enforces them (`teams.max_seats`).
//
// Plan keys on a group: `free` (5 seats), `team` (Band, 15 seats) and
// `church` (Church, 40 seats); see lib/plans. Since 2026-11-20 the plans
// differ by seats only: every plan gets every feature. Anything else ranks
// as `free`.
const PLAN_RANK = { free: 0, team: 1, church: 2 };

// Feature → minimum group plan. A feature with no entry here is open to
// everyone, everywhere. Chart style, fonts, colours, themes and chord shapes
// used to be listed (the old Pro and Sync tiers) and are free now; services
// (`multi-service`) were Church-only until 2026-11-20.
const FEATURE_GATES = {};

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

  const group = activeLibrary ? team : null;
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

export { PLAN_RANK, FEATURE_GATES };
