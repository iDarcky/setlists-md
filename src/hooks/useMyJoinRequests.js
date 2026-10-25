import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { listMyJoinRequests } from '@/features/join/joinApi';

// The signed-in user's own join requests, kept live: realtime on their own
// `team_join_requests` rows (RLS lets a requester read only those), plus a slow
// poll as a backstop for a dropped socket — a teenager staring at "Waiting"
// should never need to refresh.
const POLL_MS = 20_000;

export function useMyJoinRequests(userId, { enabled = true } = {}) {
  const [requests, setRequests] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const active = enabled && !!userId && !!supabase;

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const rows = await listMyJoinRequests();
      setRequests(Array.isArray(rows) ? rows : []);
    } catch {
      // Pre-migration project or offline: stay with what we have.
    } finally {
      setLoaded(true);
    }
  }, [active]);

  const refreshRef = useRef(refresh);
  // Poll only while something is still pending — nothing else can change.
  const hasPendingRef = useRef(false);
  useEffect(() => {
    refreshRef.current = refresh;
    hasPendingRef.current = requests.some(r => r.status === 'pending');
  });

  useEffect(() => {
    if (!active) return undefined;
    refreshRef.current();
    const channel = supabase
      .channel(`my_join_requests_${userId}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_join_requests', filter: `user_id=eq.${userId}` },
        () => { refreshRef.current(); }
      )
      .subscribe();
    const timer = setInterval(() => { if (hasPendingRef.current) refreshRef.current(); }, POLL_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [active, userId]);

  return { requests: active ? requests : [], loaded: active ? loaded : true, refresh };
}
