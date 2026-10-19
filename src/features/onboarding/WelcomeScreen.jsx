import './animations.css';
import { Button } from '@/ui/Button';
import BrandWordmark from '@/ui/BrandWordmark';

// The first screen of a first run (decided in the 2026-10-13 flow review): one
// question — do you have an account, want one, or just want to try it — in
// place of the old four-step quiz. Someone arriving through a church's join
// link never sees this; the /join route takes them straight in.
export default function WelcomeScreen({ onSignIn, onCreateAccount, onTrySolo }) {
  return (
    <div
      data-theme-variant="modes"
      className="min-h-full flex flex-col items-center justify-center bg-[var(--ds-background-200)] px-4 sm-onboard-screen-in"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        <img
          src="/setlists-md-mark.svg"
          alt=""
          width="64"
          height="64"
          className="mb-3 rounded-2xl"
          style={{ boxShadow: '0 8px 24px var(--color-brand-border)' }}
        />
        <BrandWordmark height={22} className="mb-6 text-[var(--ds-gray-1000)]" />

        <h1 className="text-heading-32 text-[var(--ds-gray-1000)] text-center m-0 leading-tight">
          Your band's songs,<br />ready for Sunday.
        </h1>
        <p className="text-copy-14 text-[var(--ds-gray-600)] text-center mt-3 mb-8 leading-relaxed">
          Chord charts, setlists and who's playing, in one place.
        </p>

        <div className="w-full flex flex-col gap-3">
          <Button variant="brand" size="lg" className="w-full" onClick={onCreateAccount}>
            Create account
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={onSignIn}>
            Log in
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={onTrySolo}>
            Try it solo, no account
          </Button>
        </div>

        <p className="text-copy-13 text-[var(--ds-gray-600)] text-center mt-8 leading-relaxed">
          Got a link from your church? Open that link to join.
        </p>
      </div>
    </div>
  );
}
