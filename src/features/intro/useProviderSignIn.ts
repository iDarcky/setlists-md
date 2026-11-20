// "Continue with Apple / Google": leaves for the provider and comes back on
// /auth/callback (AuthCallback). A join link's code waits in localStorage
// (lib/joinLink savePendingJoin) so the flow picks up after the trip.
import { useState } from 'react';
import { useAuth as useAuthJs } from '@/auth/useAuth';
import { friendlyAuthError as friendlyJs } from '@/features/auth/friendlyAuthError';

type OAuthResult = Promise<{ error?: { message?: string } | null } | undefined>;
const useAuth = useAuthJs as unknown as () => { signInWithApple: () => OAuthResult; signInWithGoogle: () => OAuthResult };
const friendlyAuthError = friendlyJs as unknown as (err: unknown) => string;

export function useProviderSignIn() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (which: 'apple' | 'google') => async () => {
    setBusy(which);
    setError(null);
    try {
      const res = await (which === 'apple' ? signInWithApple() : signInWithGoogle());
      if (res?.error) throw res.error;
      // Success leaves the page; if the browser stays (popup blocked, back
      // button) let the buttons work again.
      setTimeout(() => setBusy(null), 8000);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(null);
    }
  };

  return { busy, error, onApple: go('apple'), onGoogle: go('google') };
}
