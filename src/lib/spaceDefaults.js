// Church-first defaults (docs/PLAN.md, "The product, in one paragraph"):
// anyone who belongs to a church lands in that church. Pure, so the rules are
// tested rather than eyeballed.

/**
 * The group to open into for someone in a church who has never picked one.
 * Returns null when nothing should change: a choice exists already, or there
 * is no group to pick. A church beats a band; otherwise the first membership.
 */
export function churchDefaultSpaceId({ current, teams }) {
  if (current) return null;
  const shared = (teams || []).filter(t => t && t.id);
  if (shared.length === 0) return null;
  return (shared.find(t => t.kind === 'church' || t.plan === 'church') || shared[0]).id;
}

/**
 * Which group to open when none is open: the chosen home group while the user
 * still belongs to it, else a church, else the first membership. Null when
 * the user is in no group (the setup screen takes over).
 */
export function openingSpaceId({ defaultSpaceId, teams }) {
  const list = (teams || []).filter(t => t && t.id);
  if (defaultSpaceId && list.some(t => t.id === defaultSpaceId)) return defaultSpaceId;
  return churchDefaultSpaceId({ current: null, teams: list });
}

/**
 * After being approved into `joinedTeamId`: it becomes home, unless home is
 * already another group the user still belongs to (the first church you join
 * becomes home; a second one doesn't silently replace it).
 */
export function defaultAfterJoin({ current, joinedTeamId, teamIds }) {
  if (!joinedTeamId) return current ?? null;
  const ids = new Set(teamIds || []);
  if (current && current !== joinedTeamId && ids.has(current)) return current;
  return joinedTeamId;
}
