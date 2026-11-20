import { useState } from 'react';
import { WelcomeView } from '@/features/intro/IntroAuthViews';
import { useProviderSignIn } from '@/features/intro/useProviderSignIn';
import WebSheet from '@/features/legal/WebSheet';

// The first screen of a first run (2026-11-20): Apple, Google or email, for
// new and returning people alike. Email goes to Log in when this device has
// logged in before, else to Create account; each links to the other.
function knownEmail() {
  try { return !!window.localStorage.getItem('setlists-md:last-email'); } catch { return false; }
}

export default function WelcomeScreen({ onSignIn, onCreateAccount }) {
  const providers = useProviderSignIn();
  const [legal, setLegal] = useState(null);
  return (
    <>
      <WelcomeView
        {...providers}
        onEmail={() => (knownEmail() ? onSignIn?.() : onCreateAccount?.())}
        onShowLegal={setLegal}
      />
      <WebSheet page={legal} onClose={() => setLegal(null)} />
    </>
  );
}
