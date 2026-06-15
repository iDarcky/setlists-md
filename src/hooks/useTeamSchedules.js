import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';

export function useTeamSchedules(teamId) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!teamId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('team_schedules')
        .select('*')
        .eq('team_id', teamId)
        .limit(5000); // safety cap — team_schedules has no date column to filter on

      if (fetchErr) throw fetchErr;
      setSchedules(data || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, user]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Keep the realtime callback fresh without re-subscribing each render.
  const fetchRef = useRef(fetchSchedules);
  fetchRef.current = fetchSchedules;

  // Subscribe to changes
  useEffect(() => {
    if (!teamId) return;

    const channelId = `team_schedules_${teamId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_schedules', filter: `team_id=eq.${teamId}` },
        () => {
          // Re-fetch everything on change to get user metadata joins correctly
          fetchRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const updateSchedule = async (id, updates) => {
    if (!id) return;
    try {
      const { error: updateErr } = await supabase
        .from('team_schedules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateErr) throw updateErr;
      // Optimistic update
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (err) {
      console.error('Error updating schedule:', err);
      throw err;
    }
  };

  const createSchedule = async (setlistId, userId, role = null, availability = 'pending') => {
    if (!teamId) throw new Error("Team context missing. Please try refreshing.");
    if (!setlistId) throw new Error("Setlist ID is missing.");
    if (!userId) throw new Error("User ID is missing.");

    try {
      const { data, error: insertErr } = await supabase
        .from('team_schedules')
        .insert({
          team_id: teamId,
          setlist_id: setlistId,
          user_id: userId,
          role,
          availability
        })
        .select('*')
        .single();
      
      if (insertErr) throw insertErr;
      
      setSchedules(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Error creating schedule:', err);
      throw err;
    }
  };

  const deleteSchedule = async (id) => {
    try {
      const { error: delErr } = await supabase
        .from('team_schedules')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting schedule:', err);
      throw err;
    }
  };

  return {
    schedules,
    loading,
    error,
    updateSchedule,
    createSchedule,
    deleteSchedule,
    refreshSchedules: fetchSchedules
  };
}
