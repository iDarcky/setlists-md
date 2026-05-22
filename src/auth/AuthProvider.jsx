import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { AuthContext } from './AuthContext';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
// OAuth providers land on a dedicated callback route so the PKCE exchange
// completes deterministically. Magic links/password-reset emails land on the
// app root instead — Supabase's detectSessionInUrl picks up the fragment and
// App.jsx strips it from the URL, so the user never sees `/auth/callback#?…`.
const REDIRECT_URL = ORIGIN ? `${ORIGIN}/auth/callback` : undefined;
const ROOT_REDIRECT_URL = ORIGIN ? `${ORIGIN}/` : undefined;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // If Supabase isn't configured in this build we're already "loaded" — there
  // is no session to recover.
  const [loading, setLoading] = useState(() => supabase != null);
  const profileLoadedFor = useRef(null);

  // Bootstrap: read any persisted session, then subscribe to changes.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load / refresh the user's profile row whenever their identity changes.
  // `preferences` is optional — if the column hasn't been migrated yet in a
  // given project, we gracefully drop back to the base select so sign-in
  // still works.
  useEffect(() => {
    if (!supabase) return;
    const uid = session?.user?.id ?? null;
    if (uid === profileLoadedFor.current) return;
    profileLoadedFor.current = uid;
    if (!uid) {
      queueMicrotask(() => setProfile(null));
      return;
    }
    (async () => {
      const withPrefs = await supabase
        .from('profiles')
        .select('id, email, display_name, plan, preferences, is_pro, subscription_tier')
        .eq('id', uid)
        .maybeSingle();
      if (!withPrefs.error) {
        setProfile(withPrefs.data ?? null);
        try {
          await supabase.rpc('claim_team_invites');
        } catch (err) {
          console.error('[auth] Failed to claim team invites:', err);
        }
        return;
      }
      const base = await supabase
        .from('profiles')
        .select('id, email, display_name, plan, is_pro, subscription_tier')
        .eq('id', uid)
        .maybeSingle();
      setProfile(base.data ?? null);

      // Try to claim any pending team invites for this email
      try {
        await supabase.rpc('claim_team_invites');
      } catch (err) {
        console.error('[auth] Failed to claim team invites:', err);
      }
    })();
  }, [session?.user?.id]);

  const value = useMemo(() => {
    const guard = () => {
      if (!supabase) throw new Error('Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    };
    return {
      user: session?.user ?? null,
      session,
      profile,
      loading,
      isConfigured: isSupabaseConfigured(),

      signInWithGoogle: () => {
        guard();
        return supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: REDIRECT_URL },
        });
      },
      signInWithApple: () => {
        guard();
        return supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: REDIRECT_URL },
        });
      },
      signInWithOtp: (email) => {
        guard();
        return supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: ROOT_REDIRECT_URL },
        });
      },
      signInWithPassword: (email, password) => {
        guard();
        return supabase.auth.signInWithPassword({ email, password });
      },
      signUpWithPassword: (email, password, displayName) => {
        guard();
        return supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: ROOT_REDIRECT_URL,
            data: displayName ? { name: displayName } : undefined,
          },
        });
      },
      resetPassword: (email) => {
        guard();
        return supabase.auth.resetPasswordForEmail(email, {
          redirectTo: ROOT_REDIRECT_URL,
        });
      },
      updatePassword: (newPassword) => {
        guard();
        return supabase.auth.updateUser({ password: newPassword });
      },
      resendVerification: (email) => {
        guard();
        return supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: ROOT_REDIRECT_URL },
        });
      },
      signOut: async () => {
        guard();
        const result = await supabase.auth.signOut();
        setProfile(null);
        return result;
      },
      updateProfile: async (updates) => {
        guard();
        const uid = session?.user?.id;
        if (!uid) throw new Error('No user signed in.');
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', uid)
          .select()
          .maybeSingle();
        if (error) throw error;
        setProfile(data ?? null);
        return data;
      },
      // Permanently delete the current user's account. Calls the
      // `delete-account` Supabase Edge Function which uses the service-role
      // key to remove the auth user and cascades to profiles/team_members
      // via foreign-key ON DELETE CASCADE. The caller is responsible for
      // wiping any device-local data (IndexedDB) and signing out.
      deleteAccount: async () => {
        guard();
        const uid = session?.user?.id;
        if (!uid) throw new Error('No user signed in.');
        const { data, error } = await supabase.functions.invoke('delete-account');
        if (error) {
          throw new Error(error.message || 'Account deletion failed.');
        }
        return data;
      },
    };
  }, [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
