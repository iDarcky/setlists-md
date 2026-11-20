import { useState } from 'react';
import { WelcomeView } from '@/features/intro/IntroAuthViews';
import { useProviderSignIn } from '@/features/intro/useProviderSignIn';
import WebSheet from '@/features/legal/WebSheet';

// The first screen of a first run (2026-11-20): Create account or Log in,
// one tap each (Apple / Google lead once they are switched on).

export default function WelcomeScreen({ onSignIn, onCreateAccount }) {
  const providers = useProviderSignIn();
  const [legal, setLegal] = useState(null);
  return (
    <>
      <WelcomeView
        {...providers}
        onCreateAccount={() => onCreateAccount?.()}
        onLogIn={() => onSignIn?.()}
        onShowLegal={setLegal}
      />
      <WebSheet page={legal} onClose={() => setLegal(null)} />
    </>
  );
}
