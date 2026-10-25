import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/auth/supabase';
import {
  listTeamJoinRequests,
  approveJoinRequest,
  declineJoinRequest,
  approveAllJoinRequests,
} from '@/features/join/joinApi';

// Pending "Asking to join" requests for one team, for the people who may
// approve them (owner / admin / leader). Live via realtime on
// `team_join_requests` filtered by team_id — the table is in the publication
// with replica identity full (20261019_join_links) so the filter matches
// UPDATEs as well as INSERTs.
//
// `onMembersChanged` fires after an approval so the roster can reload.
export function useTeamJoinRequests(teamId, { enabled = true, onMembersChanged } = {}) {
  const [requests, setRequests] = useState([]);
  const active = enabled && !!teamId && !!supabase;

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const rows = await listTeamJoinRequests(teamId);
      setRequests(Array.isArray(rows) ? rows : []);
    } catch {
      // Pre-migration project, offline, or the role just changed: stay empty.
      setRequests([]);
    }
  }, [active, teamId]);

  const refreshRef = useRef(refresh);
  const membersChangedRef = useRef(onMembersChanged);
  useEffect(() => {
    refreshRef.current = refresh;
    membersChangedRef.current = onMembersChanged;
  });

  useEffect(() => {
    if (!active) return undefined;
    refreshRef.current();
    const channel = supabase
      .channel(`team_join_requests_${teamId}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_join_requests', filter: `team_id=eq.${teamId}` },
        () => { refreshRef.current(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active, teamId]);

  const approve = useCallback(async (id) => {
    const res = await approveJoinRequest(id);
    setRequests(prev => prev.filter(r => r.id !== id));
    membersChangedRef.current?.();
    return res;
  }, []);

  const decline = useCallback(async (id) => {
    const res = await declineJoinRequest(id);
    setRequests(prev => prev.filter(r => r.id !== id));
    return res;
  }, []);

  const approveAll = useCallback(async () => {
    if (!teamId) return null;
    const res = await approveAllJoinRequests(teamId);
    await refreshRef.current();
    membersChangedRef.current?.();
    return res;
  }, [teamId]);

  return { requests: active ? requests : [], refresh, approve, decline, approveAll };
}
