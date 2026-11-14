import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/auth/supabase';
import { readTeamRows, writeTeamRows } from './teamRowsCache';

const NO_ROWS = [];

// Recent team activity (last ~90 days, capped). Rows are written server-side by
// the log_team_activity trigger; this hook just reads + listens for new ones.
export function useTeamActivity(teamId, { limit = 100 } = {}) {
  // Seeded from the last visit, so a tab switch paints the feed at once
  // instead of an empty list (see teamRowsCache.js). Checking `state.teamId` keeps another
  // workspace's rows from showing after a switch.
  const [state, setState] = useState(() => ({ teamId, rows: readTeamRows('activity', teamId) || NO_ROWS }));
  const activity = useMemo(
    () => (state.teamId === teamId ? state.rows : (readTeamRows('activity', teamId) || NO_ROWS)),
    [state, teamId],
  );
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
      setState({ teamId, rows });
    } catch (err) {
      console.error('Error fetching team activity:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId, limit]);

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

  return { activity, loading, refresh: fetchActivity };
}
