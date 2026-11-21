import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/auth/supabase';
import { readTeamRows, writeTeamRows } from './teamRowsCache';
import { cachedActivity, cacheActivity } from '@/lib/launchCache';

const NO_ROWS = [];

// Recent team activity (last ~90 days, capped). Rows are written server-side by
// the log_team_activity trigger; this hook just reads + listens for new ones.
export function useTeamActivity(teamId, { limit = 100, userId = null } = {}) {
  // Seeded from the last visit, so a tab switch paints the feed at once
  // instead of an empty list (see teamRowsCache.js). With a `userId`, a cold
  // launch seeds from what this device saved last time (launchCache).
  // Checking `state.teamId` keeps another workspace's rows from showing
  // after a switch. `ready`: rows are in (from a cache or the server), so a
  // screen can draw the feed whole instead of empty-then-filled.
  const seed = useCallback(
    (id) => readTeamRows('activity', id) || (userId ? cachedActivity(userId, id) : null),
    [userId],
  );
  const [state, setState] = useState(() => {
    const rows = seed(teamId);
    return { teamId, rows: rows || NO_ROWS, ready: !!rows };
  });
  const current = useMemo(() => {
    if (state.teamId === teamId) return state;
    const rows = seed(teamId);
    return { teamId, rows: rows || NO_ROWS, ready: !!rows };
  }, [state, teamId, seed]);
  const activity = current.rows;
  const [loading, setLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!teamId || !supabase) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('team_activity')
        .select('*')
        .eq('team_id', teamId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = data || [];
      writeTeamRows('activity', teamId, rows);
      if (userId) cacheActivity(userId, teamId, rows);
      setState({ teamId, rows, ready: true });
    } catch (err) {
      console.error('Error fetching team activity:', err);
      // Offline or failing: draw what we have rather than wait forever.
      setState(prev => (prev.teamId === teamId ? { ...prev, ready: true } : { teamId, rows: seed(teamId) || NO_ROWS, ready: true }));
    } finally {
      setLoading(false);
    }
  }, [teamId, limit, userId, seed]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Live updates — unique channel topic per instance (see the realtime crash fix).
  const fetchRef = useRef(fetchActivity);
  fetchRef.current = fetchActivity;
  useEffect(() => {
    if (!teamId || !supabase) return;
    const channel = supabase
      .channel(`team_activity_${teamId}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_activity', filter: `team_id=eq.${teamId}` },
        () => { fetchRef.current(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  return { activity, loading, ready: !teamId || !supabase || current.ready, refresh: fetchActivity };
}
