import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';

// Server-authoritative team notifications (decline alerts today; extensible).
// Read/dismiss state persists in the DB, so it follows the user across devices.
//
// Degrades gracefully: if Supabase is absent or the table hasn't been migrated
// yet, every call is a no-op and `notifications` stays empty — the client falls
// back to its other (virtual) notification streams.
export function useTeamNotifications(teamId) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!teamId || !user || !supabase) return;
    try {
      // RLS already restricts rows to the signed-in recipient; the explicit
      // user_id filter states the intent and lines the query up with the
      // (user_id, dismissed_at, created_at) index.
      const { data, error } = await supabase
        .from('team_notifications')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      // Missing table / pre-migration → quietly stay empty.
      console.warn('[team-notifications] fetch skipped:', err.message);
      setNotifications([]);
    }
  }, [teamId, user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const fetchRef = useRef(fetchNotifications);
  fetchRef.current = fetchNotifications;

  useEffect(() => {
    if (!teamId || !supabase) return;
    const channel = supabase
      .channel(`team_notifications_${teamId}_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_notifications', filter: `team_id=eq.${teamId}` },
        () => { fetchRef.current(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  const markRead = useCallback(async (id) => {
    if (!supabase) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n));
    try {
      await supabase.from('team_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
    } catch (err) { console.warn('[team-notifications] markRead failed:', err.message); }
  }, []);

  const dismiss = useCallback(async (id) => {
    if (!supabase) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await supabase.from('team_notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    } catch (err) { console.warn('[team-notifications] dismiss failed:', err.message); fetchNotifications(); }
  }, [fetchNotifications]);

  const dismissAll = useCallback(async () => {
    if (!supabase) return;
    const ids = notifications.map(n => n.id);
    if (!ids.length) return;
    setNotifications([]);
    try {
      await supabase.from('team_notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids);
    } catch (err) { console.warn('[team-notifications] dismissAll failed:', err.message); fetchNotifications(); }
  }, [notifications, fetchNotifications]);

  return { notifications, markRead, dismiss, dismissAll, refresh: fetchNotifications };
}
