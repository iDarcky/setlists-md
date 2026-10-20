import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { useAuth } from '@/auth/useAuth';

// A Space's services and who plays in each (20261020_team_services.sql).
// Every member reads both; owner/admin/leader write (RLS decides — a member's
// write just errors). Live via realtime on both tables, filtered by team_id.
//
// Before the migration is applied the selects fail with "relation does not
// exist": `ready` stays false and every list is empty, so callers can hide the
// feature instead of showing an error.
export function useTeamServices(teamId) {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [serviceMembers, setServiceMembers] = useState([]);
  // The team the lists above were loaded for. Switching Space shows nothing
  // until the new Space's rows arrive, never the old Space's.
  const [loadedFor, setLoadedFor] = useState(null);
  const active = !!teamId && !!user && !!supabase;

  const refresh = useCallback(async () => {
    if (!active) return;
    const [s, m] = await Promise.all([
      supabase.from('team_services').select('*').eq('team_id', teamId).order('position').order('created_at'),
      supabase.from('team_service_members').select('service_id, user_id, team_id').eq('team_id', teamId),
    ]);
    if (s.error || m.error) {
      if (s.error) console.warn('[services] load failed:', s.error.message);
      setLoadedFor(null);
      return;
    }
    setServices(s.data || []);
    setServiceMembers(m.data || []);
    setLoadedFor(teamId);
  }, [active, teamId]);

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  useEffect(() => {
    if (!active) return undefined;
    refreshRef.current();
    const channel = supabase
      .channel(`team_services_${teamId}_${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_services', filter: `team_id=eq.${teamId}` },
        () => { refreshRef.current(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_service_members', filter: `team_id=eq.${teamId}` },
        () => { refreshRef.current(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [active, teamId]);

  const createService = useCallback(async (fields) => {
    const row = { position: services.length, ...fields, team_id: teamId, created_by: user?.id };
    const { data, error } = await supabase.from('team_services').insert(row).select('*').single();
    if (error) throw new Error(error.message);
    setServices(prev => [...prev, data]);
    return data;
  }, [services.length, teamId, user?.id]);

  const updateService = useCallback(async (id, patch) => {
    setServices(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('team_services').update(patch).eq('id', id);
    if (error) {
      refreshRef.current();
      throw new Error(error.message);
    }
  }, []);

  const deleteService = useCallback(async (id) => {
    setServices(prev => prev.filter(s => s.id !== id));
    setServiceMembers(prev => prev.filter(m => m.service_id !== id));
    const { error } = await supabase.from('team_services').delete().eq('id', id);
    if (error) {
      refreshRef.current();
      throw new Error(error.message);
    }
  }, []);

  const addPeople = useCallback(async (serviceId, userIds) => {
    const fresh = userIds.filter(uid => !serviceMembers.some(m => m.service_id === serviceId && m.user_id === uid));
    if (fresh.length === 0) return;
    setServiceMembers(prev => [...prev, ...fresh.map(uid => ({ service_id: serviceId, user_id: uid, team_id: teamId }))]);
    const { error } = await supabase.from('team_service_members')
      .upsert(fresh.map(uid => ({ service_id: serviceId, user_id: uid, team_id: teamId, added_by: user?.id })),
        { onConflict: 'service_id,user_id', ignoreDuplicates: true });
    if (error) {
      refreshRef.current();
      throw new Error(error.message);
    }
  }, [serviceMembers, teamId, user?.id]);

  const removePerson = useCallback(async (serviceId, userId) => {
    setServiceMembers(prev => prev.filter(m => !(m.service_id === serviceId && m.user_id === userId)));
    const { error } = await supabase.from('team_service_members').delete()
      .eq('service_id', serviceId).eq('user_id', userId);
    if (error) {
      refreshRef.current();
      throw new Error(error.message);
    }
  }, []);

  /**
   * Put one person on exactly these services (adds and removes). Used right
   * after approving a newcomer, when the auto_add trigger may already have put
   * them on some.
   */
  const setPersonServices = useCallback(async (userId, serviceIds) => {
    const want = new Set(serviceIds);
    const { data, error } = await supabase.from('team_service_members')
      .select('service_id').eq('team_id', teamId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    const have = new Set((data || []).map(r => r.service_id));
    const add = [...want].filter(id => !have.has(id));
    const drop = [...have].filter(id => !want.has(id));
    if (add.length) {
      const res = await supabase.from('team_service_members')
        .upsert(add.map(id => ({ service_id: id, user_id: userId, team_id: teamId, added_by: user?.id })),
          { onConflict: 'service_id,user_id', ignoreDuplicates: true });
      if (res.error) throw new Error(res.error.message);
    }
    if (drop.length) {
      const res = await supabase.from('team_service_members').delete()
        .eq('user_id', userId).in('service_id', drop);
      if (res.error) throw new Error(res.error.message);
    }
    await refreshRef.current();
  }, [teamId, user?.id]);

  const ready = active && loadedFor === teamId;
  return {
    services: ready ? services : [],
    serviceMembers: ready ? serviceMembers : [],
    ready,
    refresh,
    createService,
    updateService,
    deleteService,
    addPeople,
    removePerson,
    setPersonServices,
  };
}
