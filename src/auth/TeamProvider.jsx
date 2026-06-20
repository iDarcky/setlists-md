import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';
import { TeamContext } from './TeamContext';
import { BILLING_ENABLED, MAX_OWNED_WORKSPACES } from '../billing/checkout';

/**
 * Provides team state to the component tree. Only fetches from Supabase when
 * the user is signed in and has a team/church plan. For free/sync users, the
 * context value is a no-op stub so consumers can safely call any method.
 *
 * Multi-team: a user can belong to multiple bands/churches. We load every
 * membership into `teams[]` and expose an `activeTeamId` (defaulting to the
 * first). `team`/`members`/`invites`/`isAdmin` are all derived from the
 * active team, so existing single-team consumers keep working unchanged.
 */
export function TeamProvider({ children }) {
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadedForUserRef = useRef(null);

  // The user's personal tier drives whether they may create/own workspaces.
  // (The legacy `profiles.plan` column was dropped in 20260522_plans_migration;
  // `subscription_tier` is the canonical field.)
  const plan = (profile?.subscription_tier || 'free').toLowerCase();
  const hasTeamPlan = plan === 'team' || plan === 'church';

  const team = useMemo(
    () => teams.find(t => t.id === activeTeamId) || null,
    [teams, activeTeamId]
  );

  const setActiveTeam = useCallback((teamId) => {
    setActiveTeamId(prev => (prev === teamId ? prev : teamId));
  }, []);

  // Load every team the user belongs to when their identity changes.
  useEffect(() => {
    if (!supabase || !user?.id) {
      setTeams([]);
      setActiveTeamId(null);
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
        // All of the user's team memberships (no longer capped at one).
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id, role')
          .eq('user_id', user.id);

        if (!memberships || memberships.length === 0) {
          setTeams([]);
          setActiveTeamId(null);
          return;
        }

        const teamIds = memberships.map(m => m.team_id);
        const { data: teamRows } = await supabase
          .from('teams')
          .select('*')
          .in('id', teamIds);

        const ordered = teamRows || [];
        setTeams(ordered);
        // Keep the current active team if it's still valid, else pick the first.
        setActiveTeamId(prev =>
          prev && ordered.some(t => t.id === prev) ? prev : (ordered[0]?.id || null)
        );
      } catch (err) {
        console.error('[team] Failed to load teams:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Load members + invites for the active team whenever it changes.
  useEffect(() => {
    if (!supabase || !user?.id || !activeTeamId) {
      setMembers([]);
      setInvites([]);
      return;
    }
    let ignore = false;

    (async () => {
      try {
        // Load all members. The instruments column is optional — if the
        // 20260502_team_planning migration hasn't been applied yet, fall back
        // to the base select so sign-in continues to work.
        let memberRows = null;
        {
          const { data, error } = await supabase
            .from('team_members')
            .select('id, user_id, role, joined_at, instruments')
            .eq('team_id', activeTeamId);
          if (error) {
            const fallback = await supabase
              .from('team_members')
              .select('id, user_id, role, joined_at')
              .eq('team_id', activeTeamId);
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
            .rpc('get_team_member_profiles', { p_team_id: activeTeamId });

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
              .select('id, display_name, email, avatar_url')
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

        if (ignore) return;
        setMembers(membersWithProfiles);

        // Load pending invites for the team (only admins/owners can see these due to RLS).
        const { data: inviteRows } = await supabase
          .from('team_invites')
          .select('id, email, role, created_at')
          .eq('team_id', activeTeamId);

        if (ignore) return;
        setInvites(inviteRows || []);
      } catch (err) {
        if (!ignore) console.error('[team] Failed to load team roster:', err);
      }
    })();

    return () => { ignore = true; };
  }, [activeTeamId, user?.id]);

  // Reset on sign-out.
  useEffect(() => {
    if (!user?.id) loadedForUserRef.current = null;
  }, [user?.id]);

  const value = useMemo(() => {
    const guard = () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      if (!user?.id) throw new Error('No user signed in.');
    };

    // How many Spaces this account owns, and whether that's hit the cap.
    const ownedWorkspaceCount = teams.filter(t => t.owner_id === user?.id).length;
    const atWorkspaceLimit = ownedWorkspaceCount >= MAX_OWNED_WORKSPACES;

    const isAdmin = team
      ? members.some(m => m.user_id === user?.id && m.role === 'admin')
      : false;

    const isEditor = team
      ? members.some(m => m.user_id === user?.id && m.role === 'editor')
      : false;

    const isMember = team
      ? members.some(m => m.user_id === user?.id && m.role === 'member')
      : false;

    const isLeader = team
      ? members.some(m => m.user_id === user?.id && m.role === 'leader')
      : false;

    // Who may run the schedule/roster: admins (full power) and leaders (worship
    // leaders — manage availability + assignments, but not billing/team config).
    const canManageRoster = isAdmin || isLeader;

    return {
      teams,
      activeTeamId,
      setActiveTeam,
      team,
      members,
      invites,
      loading,
      isAdmin,
      isEditor,
      isMember,
      isLeader,
      canManageRoster,
      hasTeamPlan,
      ownedWorkspaceCount,
      atWorkspaceLimit,
      maxOwnedWorkspaces: MAX_OWNED_WORKSPACES,

      /**
       * Create a new team. The caller becomes the owner + admin member, and
       * the new team becomes the active one.
       * @param {{ name: string, location?: string }} opts
       */
      createTeam: async ({ name, location, plan: planArg }) => {
        guard();
        // Cap how many Spaces one account can own (see MAX_OWNED_WORKSPACES).
        if (ownedWorkspaceCount >= MAX_OWNED_WORKSPACES) {
          throw new Error(`You can create up to ${MAX_OWNED_WORKSPACES} workspaces. Contact support if you need more.`);
        }
        // Each workspace is its own billing unit. The `teams.plan` check
        // constraint only allows 'team' | 'church' — never 'free'/'sync' — so
        // we resolve a valid tier: an explicit choice wins, else fall back to
        // the owner's personal tier when it's already team/church, else 'team'.
        // Once Stripe checkout is wired the tier comes from the selected price;
        // subscription_status defaults to 'active' (see 20260604 migration).
        const teamPlan = (planArg === 'church' || planArg === 'team')
          ? planArg
          : (plan === 'church' ? 'church' : 'team');
        const maxSeats = teamPlan === 'church' ? 30 : 10;
        // When Stripe billing is live, a new workspace starts UNPAID — its paid
        // features gate off (via useEntitlement) until the webhook confirms
        // payment and flips it to active. This is what stops a user from
        // spinning up free working workspaces by abandoning checkout. When
        // billing is dormant we rely on the DB default ('active') so workspaces
        // are usable without any Stripe wiring.
        const { data: newTeam, error: teamErr } = await supabase
          .from('teams')
          .insert({
            name,
            location: location || null,
            owner_id: user.id,
            plan: teamPlan,
            max_seats: maxSeats,
            ...(BILLING_ENABLED ? { subscription_status: 'unpaid' } : {}),
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

        setTeams(prev => [...prev.filter(t => t.id !== newTeam.id), newTeam]);
        setActiveTeamId(newTeam.id);
        setMembers([{ id: finalMemberId, user_id: user.id, role: 'admin', joined_at: new Date().toISOString() }]);
        setInvites([]);
        return newTeam;
      },

      /**
       * Invite a user to the team by their email.
       * Calls the secure RPC which handles both existing and new users.
       * @param {string} email
       * @param {string} role (admin, editor, member)
       */
      inviteMember: async (email, role = 'member') => {
        guard();
        if (!team) throw new Error('No team exists.');
        if (members.length >= (team.max_seats || 10)) {
          throw new Error(`This team is at its ${team.max_seats}-seat limit. Upgrade your plan to add more members.`);
        }

        const { data, error } = await supabase.rpc('invite_user_to_team', {
          p_team_id: team.id,
          p_email: email.toLowerCase(),
          p_role: role
        });

        if (error) {
          throw new Error(error.message || 'Failed to send invite.');
        }

        if (data.status === 'added') {
          // They were an existing user and were instantly added.
          // Fetch their profile to add to local state.
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_url')
            .eq('id', data.user_id)
            .maybeSingle();

          const newMember = {
            id: data.member_id,
            team_id: team.id,
            user_id: data.user_id,
            role: role,
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
            role: role,
            created_at: new Date().toISOString()
          };
          setInvites(prev => [...prev, newInvite]);
          return { status: 'invited', email: data.email };
        }
      },

      /**
       * Update a member's role
       */
      updateMemberRole: async (memberId, role) => {
        guard();
        if (!team) throw new Error('No team exists.');

        const { error } = await supabase
          .from('team_members')
          .update({ role })
          .eq('id', memberId)
          .eq('team_id', team.id);

        if (error) throw error;
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
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
       * Leave the current team (as a non-owner member). Drops it from the
       * teams list and falls back to another team (or none).
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
        const leftId = team.id;
        setTeams(prev => {
          const next = prev.filter(t => t.id !== leftId);
          setActiveTeamId(next[0]?.id || null);
          return next;
        });
        setMembers([]);
        setInvites([]);
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
        setTeams(prev => prev.map(t => t.id === data.id ? data : t));
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
       * Delete the team entirely. Owner only. Drops it from the teams list
       * and falls back to another team (or none).
       */
      deleteTeam: async () => {
        guard();
        if (!team) throw new Error('No team exists.');
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        if (error) throw error;
        const deletedId = team.id;
        setTeams(prev => {
          const next = prev.filter(t => t.id !== deletedId);
          setActiveTeamId(next[0]?.id || null);
          return next;
        });
        setMembers([]);
        setInvites([]);
      },
    };
  }, [teams, activeTeamId, team, members, invites, loading, user?.id, plan, hasTeamPlan, setActiveTeam]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
