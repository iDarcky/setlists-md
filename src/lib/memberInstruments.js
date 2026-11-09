/**
 * Saving what someone plays (`team_members.instruments`).
 *
 * ⚠ Why this goes through a function, not a plain update: the only UPDATE
 * policy on `team_members` lets the church OWNER change rows. A member's own
 * "Drums" matched 0 rows, Supabase returned no error, and nothing was saved —
 * for months, for everyone but the owner. `set_member_instruments`
 * (20261104_member_instruments.sql) writes only this column, for yourself or,
 * as the owner or a leader, for anyone.
 *
 * Until that SQL is run, the old direct update is the fallback, and it now
 * FAILS LOUDLY when no row changed instead of pretending it saved.
 */

/** Trimmed, no blanks, no repeats, order kept. */
export function cleanParts(list) {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map(s => String(s ?? '').trim()).filter(Boolean)));
}

/** True when the error means "that function is not in the database yet". */
export function isMissingFunction(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function|function .* does not exist/i.test(error.message || '');
}

export const NOT_SAVED = 'That didn’t save. Ask your church owner to run the latest update.';

/**
 * @param {object} supabase
 * @param {{ memberId: string, instruments: string[] }} opts
 * @returns {Promise<string[]>} what was saved
 */
export async function saveMemberInstruments(supabase, { memberId, instruments }) {
  const clean = cleanParts(instruments);
  const { data, error } = await supabase.rpc('set_member_instruments', {
    p_member_id: memberId,
    p_instruments: clean,
  });
  if (!error) return Array.isArray(data) ? data : clean;
  if (!isMissingFunction(error)) throw error;

  const res = await supabase
    .from('team_members')
    .update({ instruments: clean })
    .eq('id', memberId)
    .select('id');
  if (res.error) throw res.error;
  if (!res.data?.length) throw new Error(NOT_SAVED);
  return clean;
}

/** May this role set someone else's parts? Owner, admin or leader. */
export function canSetOthersParts({ role, isOwner }) {
  return !!isOwner || role === 'admin' || role === 'leader';
}

/** Members who have said nothing about what they play. */
export function membersWithoutParts(members = []) {
  return members.filter(m => cleanParts(m?.instruments).length === 0);
}

/**
 * Change someone's role / remove them. Same story as the parts: the
 * UPDATE/DELETE policies are owner-only, so an admin's tap matched 0 rows and
 * silently did nothing. `set_member_role` / `remove_member`
 * (20261104_member_admin_actions.sql) do it for the owner and admins. Until
 * that SQL runs, the old direct write is the fallback and fails loudly.
 */
export async function saveMemberRole(supabase, { memberId, role }) {
  const { error } = await supabase.rpc('set_member_role', { p_member_id: memberId, p_role: role });
  if (!error) return role;
  if (!isMissingFunction(error)) throw error;
  const res = await supabase.from('team_members').update({ role }).eq('id', memberId).select('id');
  if (res.error) throw res.error;
  if (!res.data?.length) throw new Error(NOT_SAVED);
  return role;
}

export async function deleteMember(supabase, { memberId }) {
  const { error } = await supabase.rpc('remove_member', { p_member_id: memberId });
  if (!error) return;
  if (!isMissingFunction(error)) throw error;
  const res = await supabase.from('team_members').delete().eq('id', memberId).select('id');
  if (res.error) throw res.error;
  if (!res.data?.length) throw new Error(NOT_SAVED);
}
