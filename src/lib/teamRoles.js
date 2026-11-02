/**
 * The administrative roles — the one place they are defined.
 *
 * There are TWO axes in this app and they were tangled for a long time:
 *
 *   • **Administrative role** — one per person per workspace, ordered, decides
 *     what you may CHANGE. That is this file.
 *   • **Musical instrument** — a list, unordered, not a permission, may differ
 *     per service, decides what you SEE. That is `data/instruments.js`.
 *
 * Calling both of them "roles" is what produced four different instrument
 * vocabularies and a reader preset whose `leader` meant something else entirely
 * from this one's.
 *
 * ⚠ **The DB decides the same question and must agree.** RLS answers it in
 * `get_user_editable_teams()` (see `supabase/migrations/20260807_leader_can_write.sql`).
 * If the two ever disagree in the permissive direction, a write lands in local
 * state, LOOKS SAVED, and is silently reverted by the next pull — the worst
 * failure mode this app has. Change them together.
 *
 * `owner` is deliberately NOT a row here: it lives in `teams.owner_id`, not in
 * `team_members.role`, because it is about who pays rather than what they may
 * do. It implies every capability below.
 */

export const TEAM_ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    blurb: 'A leader who can also change roles and remove people.',
    canWriteLibrary: true,
    canPlanServices: true,
    canManageMembers: true,
    canApproveJoins: true,
  },
  {
    id: 'leader',
    label: 'Leader',
    blurb: 'Plans services, picks the band, lets people in.',
    // Read-only until 2026-08-07. The role that PLANS a service could not fix a
    // chord in it, which is what forced "ask an admin to write it for me".
    // Measured: 2 of the 20 real people hold it, both worship leaders in a
    // church running the app every week.
    canWriteLibrary: true,
    canPlanServices: true,
    canManageMembers: false,
    // Join link + "Asking to join" (20261019_join_links): leaders approve
    // newcomers too — they are the ones who know who turned up on Sunday.
    canApproveJoins: true,
  },
  {
    // ⚠ The STORED value is `editor` — renaming a label is free, renaming a
    // value in a column that RLS reads is not. It was labelled "Contributor"
    // for a while; the Team page redesign (2026-10-31) went back to "Editor",
    // the word the user uses for "a volunteer who edits but doesn't lead".
    id: 'editor',
    label: 'Editor',
    blurb: 'Edits songs and setlists. Can’t pick the band or let people in.',
    canWriteLibrary: true,
    canPlanServices: false,
    canManageMembers: false,
    canApproveJoins: false,
  },
  {
    id: 'member',
    label: 'Member',
    blurb: 'Sees everything, answers when asked to play.',
    canWriteLibrary: false,
    canPlanServices: false,
    canManageMembers: false,
    canApproveJoins: false,
  },
];

const BY_ID = new Map(TEAM_ROLES.map(r => [r.id, r]));

/** A role's definition. Unknown/absent roles fall back to the least power. */
export function roleDef(role) {
  return BY_ID.get(String(role || '').trim()) || BY_ID.get('member');
}

/** May this role change songs and setlists in a team library? */
export function canWriteLibrary(role) {
  return roleDef(role).canWriteLibrary;
}

/** May this role schedule people and run the band? */
export function canPlanServices(role) {
  return roleDef(role).canPlanServices;
}

/**
 * May this role run the join link and approve "Asking to join"? ⚠ The DB's
 * half is `get_user_join_manager_teams()` (owner + admin + leader); the owner
 * is handled by the caller, as everywhere in this file.
 */
export function canApproveJoins(role) {
  return !!roleDef(role).canApproveJoins;
}

/** May this role invite, remove and re-role people? */
export function canManageMembers(role) {
  return roleDef(role).canManageMembers;
}
