// Church-first defaults (docs/PLAN.md, "The product, in one paragraph"):
// anyone who belongs to a church lands in that church; Personal stays for the
// people who use it. Pure, so the rules are tested rather than eyeballed.

/**
 * The Space to open into for someone in a church who has never picked one.
 * Returns null when nothing should change: a choice exists already — including
 * an explicit 'personal' — or there is no shared Space to pick.
 * A church beats a band; otherwise the first membership.
 */
export function churchDefaultSpaceId({ current, teams }) {
  if (current) return null;
  const shared = (teams || []).filter(t => t && t.id && t.kind !== 'personal');
  if (shared.length === 0) return null;
  return (shared.find(t => t.kind === 'church' || t.plan === 'church') || shared[0]).id;
}

/**
 * After being approved into `joinedTeamId`: it becomes home, unless home is
 * already another Space the user still belongs to (the first church you join
 * becomes home; a second one doesn't silently replace it).
 */
export function defaultAfterJoin({ current, joinedTeamId, teamIds }) {
  if (!joinedTeamId) return current ?? null;
  const ids = new Set(teamIds || []);
  if (current && current !== 'personal' && current !== joinedTeamId && ids.has(current)) return current;
  return joinedTeamId;
}

/**
 * Does the personal library hold anything of the user's own? The three seeded
 * demo songs don't count; any setlist does.
 */
export function hasOwnPersonalContent(songs, setlists, demoIds = []) {
  const demos = new Set(demoIds);
  if ((setlists || []).length > 0) return true;
  return (songs || []).some(s => s && !demos.has(s.id));
}

/**
 * Hide "Personal" from the Space switcher? Only for someone who belongs to a
 * church, has nothing of their own there, and hasn't asked to see it. Anything
 * uncertain keeps it visible:
 *   - `showPersonalPref === true`  (Settings → "Show my own songs and setlists")
 *   - not in any shared Space
 *   - personal content exists, or isn't known yet (`null`)
 *   - the account has personal cloud sync (its songs may live on another device)
 *   - Personal is the open Space, or the chosen home Space
 */
export function shouldHidePersonal({
  showPersonalPref,
  inChurch,
  hasPersonalContent,
  personalCloud = false,
  activeIsPersonal = false,
  defaultIsPersonal = false,
}) {
  if (showPersonalPref === true) return false;
  if (!inChurch) return false;
  if (hasPersonalContent !== false) return false;
  if (personalCloud) return false;
  if (activeIsPersonal || defaultIsPersonal) return false;
  return true;
}
