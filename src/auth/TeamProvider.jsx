import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';
import { TeamContext } from './TeamContext';

/**
 * Provides team state to the component tree. Only fetches from Supabase when
 * the user is signed in and has a team/church plan. For free/sync users, the
 * context value is a no-op stub so consumers can safely call any method.
 */
export function TeamProvider({ children }) {
  const { user, profile } = useAuth();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadedForUserRef = useRef(null);

  const plan = (profile?.plan || 'free').toLowerCase();
  const hasTeamPlan = plan === 'team' || plan === 'church';

  // Load the user's team when their identity changes.
  useEffect(() => {
    if (!supabase || !user?.id) {
      setTeam(null);
      setMembers([]);
      setInvites([]);
      loadedForUserRef.current = null;
      return;
    }
    if (loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;

    (async () => {
      setLoading(true);
      try {
        // Find the user's team membership(s). For MVP, we take the first team.
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (!membership) {
          setTeam(null);
          setMembers([]);
          setInvites([]);
          return;
        }

        // Load the team details.
        const { data: teamRow } = await supabase
          .from('teams')
          .select('*')
          .eq('id', membership.team_id)
          .maybeSingle();

        if (teamRow) setTeam(teamRow);

        // Load all members. The instruments column is optional — if the
        // 20260502_team_planning migration hasn't been applied yet, fall back
        // to the base select so sign-in continues to work.
        let memberRows = null;
        {
          const { data, error } = await supabase
            .from('team_members')
            .select('id, user_id, role, joined_at, instruments')
            .eq('team_id', membership.team_id);
          if (error) {
            const fallback = await supabase
              .from('team_members')
              .select('id, user_id, role, joined_at')
              .eq('team_id', membership.team_id);
            memberRows = fallback.data;
          } else {
            memberRows = data;
          }
        }

        let membersWithProfiles = memberRows || [];

        if (membersWithProfiles.length > 0) {
          // Use security-definer RPC to reliably fetch member profiles.
          // This bypasses profiles RLS so team members can see each other's
          // names and emails (the email falls back to auth.users).
          const { data: profiles } = await supabase
            .rpc('get_team_member_profiles', { p_team_id: membership.team_id });

          if (profiles && profiles.length > 0) {
            const profileMap = profiles.reduce((acc, p) => ({ ...acc, [p.user_id]: p }), {});
            membersWithProfiles = membersWithProfiles.map(m => ({
              ...m,
              profile: profileMap[m.user_id] || null
            }));
          } else {
            // Fallback: try direct profiles query (works for own profile at least)
            const userIds = membersWithProfiles.map(m => m.user_id);
            const { data: fallbackProfiles } = await supabase
              .from('profiles')
              .select('id, display_name, email')
              .in('id', userIds);

            if (fallbackProfiles) {
              const profileMap = fallbackProfiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
              membersWithProfiles = membersWithProfiles.map(m => ({
                ...m,
                profile: profileMap[m.user_id] || null
              }));
            }
          }
        }

        setMembers(membersWithProfiles);

        // Load pending invites for the team (only admins/owners can see these due to RLS).
        const { data: inviteRows } = await supabase
          .from('team_invites')
          .select('id, email, role, created_at')
          .eq('team_id', membership.team_id);
        
        setInvites(inviteRows || []);
      } catch (err) {
        console.error('[team] Failed to load team:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Reset on sign-out.
  useEffect(() => {
    if (!user?.id) loadedForUserRef.current = null;
  }, [user?.id]);

  const value = useMemo(() => {
    const guard = () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      if (!user?.id) throw new Error('No user signed in.');
    };

    const isAdmin = team
      ? members.some(m => m.user_id === user?.id && m.role === 'admin')
      : false;

    return {
      team,
      members,
      invites,
      loading,
      isAdmin,
      hasTeamPlan,

      /**
       * Create a new team. The caller becomes the owner + admin member.
       * @param {{ name: string, location?: string }} opts
       */
      createTeam: async ({ name, location }) => {
        guard();
        const maxSeats = plan === 'church' ? 30 : 10;
        const { data: newTeam, error: teamErr } = await supabase
          .from('teams')
          .insert({
            name,
            location: location || null,
            owner_id: user.id,
            plan,
            max_seats: maxSeats,
          })
          .select()
          .single();

        if (teamErr) throw teamErr;

        // Add the creator as admin (if not already added by a trigger).
        const { data: memberRow, error: memberErr } = await supabase
          .from('team_members')
          .insert({
            team_id: newTeam.id,
            user_id: user.id,
            role: 'admin',
          })
          .select('id')
          .maybeSingle();

        // If it failed due to unique violation (e.g. trigger already added them),
        // we can ignore it and just fetch the row.
        if (memberErr && memberErr.code !== '23505') throw memberErr;
        
        let finalMemberId = memberRow?.id;
        if (!finalMemberId) {
          const { data: existing } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', newTeam.id)
            .eq('user_id', user.id)
            .single();
          finalMemberId = existing?.id;
        }

        setTeam(newTeam);
        setMembers([{ id: finalMemberId, user_id: user.id, role: 'admin', joined_at: new Date().toISOString() }]);
        return newTeam;
      },

      /**
       * Invite a user to the team by their email.
       * Calls the secure RPC which handles both existing and new users.
       * @param {string} email
       */
      inviteMember: async (email) => {
        guard();
        if (!team) throw new Error('No team exists.');
        if (members.length >= (team.max_seats || 10)) {
          throw new Error(`This team is at its ${team.max_seats}-seat limit. Upgrade your plan to add more members.`);
        }

        const { data, error } = await supabase.rpc('invite_user_to_team', {
          p_team_id: team.id,
          p_email: email.toLowerCase(),
          p_role: 'member'
        });

        if (error) {
          throw new Error(error.message || 'Failed to send invite.');
        }

        if (data.status === 'added') {
          // They were an existing user and were instantly added.
          // Fetch their profile to add to local state.
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', data.user_id)
            .maybeSingle();

          const newMember = {
            id: data.member_id,
            team_id: team.id,
            user_id: data.user_id,
            role: 'member',
            joined_at: new Date().toISOString(),
            profile: profile || null
          };
          setMembers(prev => [...prev, newMember]);
          return { status: 'added', member: newMember };
        } else {
          // They don't have an account yet. Added to team_invites.
          const newInvite = {
            id: 'temp-' + Date.now(), // Real ID is in DB, we'll refresh soon or just use this for UI
            email: data.email,
            role: 'member',
            created_at: new Date().toISOString()
          };
          setInvites(prev => [...prev, newInvite]);
          return { status: 'invited', email: data.email };
        }
      },

      /**
       * Cancel a pending invite
       */
      cancelInvite: async (inviteId) => {
        guard();
        if (!team) throw new Error('No team exists.');
        
        // Skip temp IDs from optimistic updates if they haven't synced yet
        if (!String(inviteId).startsWith('temp-')) {
          const { error } = await supabase
            .from('team_invites')
            .delete()
            .eq('id', inviteId)
            .eq('team_id', team.id);
          if (error) throw error;
        }
        
        setInvites(prev => prev.filter(i => i.id !== inviteId));
      },

      /**
       * Remove a member from the team.
       * @param {string} memberId — the team_members.id to remove
       */
      removeMember: async (memberId) => {
        guard();
        if (!team) throw new Error('No team exists.');

        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId)
          .eq('team_id', team.id);

        if (error) throw error;
        setMembers(prev => prev.filter(m => m.id !== memberId));
      },

      /**
       * Leave the current team (as a non-owner member).
       */
      leaveTeam: async () => {
        guard();
        if (!team) throw new Error('No team exists.');
        if (team.owner_id === user.id) {
          throw new Error('The team owner cannot leave. Transfer ownership or delete the team instead.');
        }

        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', team.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setTeam(null);
        setMembers([]);
        loadedForUserRef.current = null;
      },

      /**
       * Update team details (name, location). Owner only.
       */
      updateTeam: async (updates) => {
        guard();
        if (!team) throw new Error('No team exists.');
        const { data, error } = await supabase
          .from('teams')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', team.id)
          .select()
          .single();
        if (error) throw error;
        setTeam(data);
        return data;
      },

      /**
       * Update the current user's instruments on this team.
       * @param {string[]} instruments
       */
      updateMyInstruments: async (instruments) => {
        guard();
        if (!team) throw new Error('No team exists.');
        const clean = Array.isArray(instruments)
          ? Array.from(new Set(instruments.map(s => String(s).trim()).filter(Boolean)))
          : [];
        const { error } = await supabase
          .from('team_members')
          .update({ instruments: clean })
          .eq('team_id', team.id)
          .eq('user_id', user.id);
        if (error) throw error;
        setMembers(prev => prev.map(m =>
          m.user_id === user.id ? { ...m, instruments: clean } : m
        ));
        return clean;
      },

      /**
       * Delete the team entirely. Owner only.
       */
      deleteTeam: async () => {
        guard();
        if (!team) throw new Error('No team exists.');
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        if (error) throw error;
        setTeam(null);
        setMembers([]);
        loadedForUserRef.current = null;
      },
    };
  }, [team, members, invites, loading, user?.id, plan, hasTeamPlan]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
