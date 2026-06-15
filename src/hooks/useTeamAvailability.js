import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';

// Convert a Date or YYYY-MM-DD string to YYYY-MM-DD using LOCAL components.
// `Date#toISOString()` shifts to UTC, which silently writes to the previous
// day for users in any positive timezone — see the UTC-shift bug fixed
// in 50e71a2's follow-up.
function toDateStr(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useTeamAvailability(teamId) {
  const { user } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAvailability = useCallback(async () => {
    if (!teamId || !user || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      // Bound the query: only fetch from a week back forward. Everything that
      // reads availability (dashboard calendar −2d, My-Schedule, the Scheduling
      // grid which starts at this week's Sunday, the schedule page's future
      // weeks) lives in this window, so older rows are dead weight re-fetched on
      // every realtime echo. Keep the cutoff ≤ this week's Sunday.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const { data, error: fetchErr } = await supabase
        .from('team_availability')
        .select('*')
        .eq('team_id', teamId)
        .gte('date', toDateStr(cutoff))
        .limit(5000);
      if (fetchErr) throw fetchErr;
      setAvailability(data || []);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, user]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Keep the realtime callback fresh without re-subscribing on every render.
  const fetchRef = useRef(fetchAvailability);
  fetchRef.current = fetchAvailability;

  useEffect(() => {
    if (!teamId || !supabase) return;
    // Unique topic per subscription instance — supabase-js reuses a channel for
    // a repeated topic, and adding postgres_changes to an already-subscribed
    // channel throws. A random suffix avoids that collision (e.g. when this
    // hook mounts in two places, or the effect re-runs before cleanup lands).
    const channel = supabase.channel(`team_availability_${teamId}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_availability', filter: `team_id=eq.${teamId}` },
        () => { fetchRef.current(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  const setStatus = useCallback(async (date, status) => {
    if (!teamId || !user) throw new Error('Not signed in to a team.');
    const dateStr = toDateStr(date);
    if (!dateStr) throw new Error('Invalid date.');
    const row = {
      team_id: teamId,
      user_id: user.id,
      date: dateStr,
      status,
      updated_at: new Date().toISOString(),
    };
    // Optimistic update
    setAvailability(prev => {
      const idx = prev.findIndex(a => a.user_id === user.id && a.date === dateStr);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status };
        return next;
      }
      return [...prev, { id: 'tmp-' + dateStr, ...row }];
    });
    const { data, error: upsertErr } = await supabase
      .from('team_availability')
      .upsert(row, { onConflict: 'team_id,user_id,date' })
      .select('*')
      .single();
    if (upsertErr) {
      console.error('Error setting availability:', upsertErr);
      fetchAvailability();
      throw upsertErr;
    }
    setAvailability(prev => {
      const idx = prev.findIndex(a => a.user_id === user.id && a.date === dateStr);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = data;
        return next;
      }
      return [...prev, data];
    });
    return data;
  }, [teamId, user, fetchAvailability]);

  const clearStatus = useCallback(async (date) => {
    if (!teamId || !user) return;
    const dateStr = toDateStr(date);
    if (!dateStr) return;
    setAvailability(prev => prev.filter(a => !(a.user_id === user.id && a.date === dateStr)));
    const { error: delErr } = await supabase
      .from('team_availability')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('date', dateStr);
    if (delErr) {
      console.error('Error clearing availability:', delErr);
      fetchAvailability();
      throw delErr;
    }
  }, [teamId, user, fetchAvailability]);

  const getStatus = useCallback((userId, date) => {
    const dateStr = toDateStr(date);
    return availability.find(a => a.user_id === userId && a.date === dateStr)?.status || null;
  }, [availability]);

  return {
    availability,
    loading,
    error,
    setStatus,
    clearStatus,
    getStatus,
    refresh: fetchAvailability,
  };
}
