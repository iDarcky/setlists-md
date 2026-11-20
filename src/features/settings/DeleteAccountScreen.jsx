import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/auth/supabase';
import { useAuth } from '@/auth/useAuth';
import { useTeam } from '@/auth/useTeam';
import { clearAll } from '@/storage';
import { LAST_EMAIL_KEY } from '@/lib/lastEmail';
import { DeleteAccountView } from '@/features/intro/IntroAuthViews';

// "Delete your account?" (E3, 2026-11-20), over everything. The warning says
// what the delete-account function will do to the team this person owns.
export default function DeleteAccountScreen({ onCancel, onSignOut }) {
  const { user, deleteAccount } = useAuth();
  const { team, teams, members } = useTeam();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ownedTeam = (teams || []).find(t => t.owner_id === user?.id) || null;
  // Known at once for the open team; otherwise counted on the server.
  const known = ownedTeam && team?.id === ownedTeam.id && members.length > 0 ? members.length : null;
  const [count, setCount] = useState(known);

  useEffect(() => {
    if (!ownedTeam || known != null || !supabase) return undefined;
    let cancelled = false;
    supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', ownedTeam.id)
      .then(({ count: n }) => { if (!cancelled && typeof n === 'number') setCount(n); });
    return () => { cancelled = true; };
  }, [ownedTeam, known]);

  const people = known ?? count;
  const owned = ownedTeam && people != null ? { name: ownedTeam.name, alone: people <= 1 } : null;

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
