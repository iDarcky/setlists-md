// Who gets a team when its owner deletes their account. Mirrors
// supabase/functions/delete-account: the earliest-joined leader (admin) who
// isn't the owner, else the earliest-joined member. Null when nobody else is
// in the team (then the team is deleted with the account).

const joined = (m) => (m?.joined_at ? Date.parse(m.joined_at) || 0 : 0);

export function pickSuccessor(members, ownerId) {
  const others = (members || []).filter(m => m && m.user_id && m.user_id !== ownerId);
  if (!others.length) return null;
  const byJoin = [...others].sort((a, b) => joined(a) - joined(b));
  return byJoin.find(m => m.role === 'admin') || byJoin[0];
}

/** A member's name as the app shows it elsewhere. */
export function memberName(m) {
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'another member';
}

/** The owner types the team's name; anyone else types DELETE. */
export function deleteConfirmed(typed, teamName) {
  const t = String(typed || '').trim().toLowerCase();
  if (teamName) return t === String(teamName).trim().toLowerCase();
  return t === 'delete';
}
