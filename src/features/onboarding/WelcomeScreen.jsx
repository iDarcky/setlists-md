import { WelcomeView } from '@/features/auth/AuthViews';

// The first screen of a first run: create an account or log in. "Try it solo"
// was dropped on 2026-10-25; someone arriving through a church's join link
// never sees this screen, the /join route takes them straight in.
export default function WelcomeScreen({ onSignIn, onCreateAccount }) {
  return <WelcomeView onCreateAccount={onCreateAccount} onLogIn={onSignIn} />;
}
