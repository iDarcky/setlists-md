// How the Team page groups and names people. Pure.

/** The three groups people are shown in. An admin is a leader who can also change roles. */
export const ROLE_GROUPS = [
  { id: 'leader', label: 'Leaders', roles: ['admin', 'leader'] },
  { id: 'editor', label: 'Editors', roles: ['editor'] },
  { id: 'member', label: 'Members', roles: ['member'] },
];

/** The group a stored role falls in; anything unknown is a member. */
export const groupOf = (role) => (ROLE_GROUPS.find(g => g.roles.includes(role || 'member')) || ROLE_GROUPS[2]).id;

export const memberName = (m) => m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Someone';
