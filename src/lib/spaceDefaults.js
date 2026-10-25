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
 * Opening into the home Space, once per sign-in. Returns `{ done, switchTo }`:
 * `done` says the decision is final for this sign-in; until then the caller
 * asks again as `teams` and `activeLibrary` change. The memberships load after
 * the first render, so a home Space missing from `teams` means "not loaded
 * yet", never "gone" — deciding on that first empty list is what opened every
 * church member into Personal.
 */
export function homeSpaceStep({ target, activeLibrary, teams }) {
  if (!target) return { done: false, switchTo: null };
  if (target === 'personal' || activeLibrary !== 'personal') return { done: true, switchTo: null };
  if ((teams || []).some(t => t && t.id === target)) return { done: true, switchTo: target };
  return { done: false, switchTo: null };
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
 * TEMPORARY (2026-10-25, owner's call): anyone in a church or band does not
 * get Personal at all, whatever it holds, while we decide what Personal is
 * for. Nothing is deleted: its songs stay on this device (and on the server
 * with cloud sync) and come back when this is switched off. People in no
 * shared Space still have it, because it is the only library they have.
 */
export const PERSONAL_BLOCKED_IN_CHURCH = true;

/**
 * Hide "Personal" from the Space switcher? Only for someone who belongs to a
 * church, has nothing of their own there, and hasn't asked to see it. Anything
 * uncertain keeps it visible (unless `blocked`, which hides it for every
 * church member — see PERSONAL_BLOCKED_IN_CHURCH):
 *   - `showPersonalPref === true`  (Settings → "Show my own songs and setlists")
 *   - not in any shared Space
 *   - personal content exists, or isn't known yet (`null`)
 *   - the account has personal cloud sync (its songs may live on another device)
 *   - Personal is the open Space, or the chosen home Space
 */
export function shouldHidePersonal({
  blocked = false,
  showPersonalPref,
  inChurch,
  hasPersonalContent,
  personalCloud = false,
  activeIsPersonal = false,
  defaultIsPersonal = false,
}) {
  if (!inChurch) return false;
  if (blocked) return true;
  if (showPersonalPref === true) return false;
  if (hasPersonalContent !== false) return false;
  if (personalCloud) return false;
  if (activeIsPersonal || defaultIsPersonal) return false;
  return true;
}
