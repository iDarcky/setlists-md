// Thin wrappers over the join-link RPCs (supabase/migrations/20261019_join_links.sql).
// Every call throws a plain Error with a readable message; callers decide how
// to show it.
import { supabase } from '@/auth/supabase';

async function rpc(name, args) {
  if (!supabase) throw new Error('Sign-in is not available in this build.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    // Before the migration is applied PostgREST answers "Could not find the
    // function …" — say something a leader can act on instead.
    if (/could not find the function|does not exist/i.test(error.message || '')) {
      throw new Error('Join links are not set up on the server yet.');
    }
    throw new Error(error.message || 'Something went wrong.');
  }
  return data;
}

/** Safe before sign-in. → { status: 'ok'|'disabled'|'invalid', team_name, … } */
export const peekJoinLink = (code) => rpc('peek_join_link', { p_code: code });

/** → { status: 'pending'|'member'|'declined'|'disabled'|'invalid', request_id?, team_id? } */
export const requestToJoin = (code, displayName, parts) =>
  rpc('request_to_join', { p_code: code, p_display_name: displayName || null, p_parts: parts || [] });

export const listMyJoinRequests = () => rpc('list_my_join_requests', {});

export const getTeamJoinLink = (teamId) => rpc('get_team_join_link', { p_team_id: teamId });
export const resetTeamJoinLink = (teamId) => rpc('reset_team_join_link', { p_team_id: teamId });
export const setTeamJoinLinkEnabled = (teamId, enabled) =>
  rpc('set_team_join_link_enabled', { p_team_id: teamId, p_enabled: !!enabled });

export const listTeamJoinRequests = (teamId) =>
  rpc('list_team_join_requests', { p_team_id: teamId, p_status: 'pending' });
export const approveJoinRequest = (id) => rpc('approve_join_request', { p_request_id: id });
export const declineJoinRequest = (id) => rpc('decline_join_request', { p_request_id: id });
export const approveAllJoinRequests = (teamId) => rpc('approve_all_join_requests', { p_team_id: teamId });
