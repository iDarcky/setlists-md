import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/auth/supabase';
import { useAuth } from '@/auth/useAuth';
import { useTeam } from '@/auth/useTeam';
import { clearAll } from '@/storage';
import { LAST_EMAIL_KEY } from '@/lib/lastEmail';
import { DeleteAccountView } from '@/features/intro/IntroAuthViews';
import { pickSuccessor, memberName } from '@/lib/deleteAccount';

// "Delete your account?" (E3, 2026-11-20), over everything. The warning says
// what the delete-account function will do to the team this person owns,
// naming who gets it (22 Nov 2026).
export default function DeleteAccountScreen({ onCancel, onSignOut }) {
  const { user, deleteAccount } = useAuth();
  const { team, teams, members } = useTeam();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ownedTeam = (teams || []).find(t => t.owner_id === user?.id) || null;
  // The open team's roster is here already; another owned team is read once.
  const local = ownedTeam && team?.id === ownedTeam.id && members.length > 0 ? members : null;
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (!ownedTeam || local || !supabase) return undefined;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase.from('team_members')
        .select('user_id, role, joined_at').eq('team_id', ownedTeam.id);
      let profiles = [];
      try {
        const { data } = await supabase.rpc('get_team_member_profiles', { p_team_id: ownedTeam.id });
        profiles = data || [];
      } catch { /* names fall back to "Another leader" */ }
      const byId = Object.fromEntries(profiles.map(p => [p.user_id, p]));
      if (!cancelled && rows) setFetched(rows.map(r => ({ ...r, profile: byId[r.user_id] || null })));
    })();
    return () => { cancelled = true; };
  }, [ownedTeam, local]);

  const roster = local || fetched;
  const next = roster ? pickSuccessor(roster, user?.id) : null;
  const owned = ownedTeam
    ? { name: ownedTeam.name, alone: roster ? !next : null, successor: next ? memberName(next) : null }
    : null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      // A different person signing in on this device must not inherit this
      // account's songs and setlists.
      try { await clearAll(); } catch { /* best-effort */ }
      try { localStorage.removeItem(LAST_EMAIL_KEY); } catch { /* ignore */ }
      try { await onSignOut?.(); } catch { /* the session is already gone */ }
    } catch (err) {
      setError(err?.message || 'Couldn’t delete your account. Write to legal@setlists.md and we’ll do it.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-modal">
      <DeleteAccountView
        embedded
        owned={owned}
        teamName={team?.name}
        confirm={confirm}
        onConfirmChange={setConfirm}
        onDelete={remove}
        onCancel={onCancel}
        busy={busy}
        error={error}
      />
    </div>,
    document.body,
  );
}
