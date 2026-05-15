import { useState } from 'react';
import { Button } from '../ui/Button';

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.39 5.96L20.5 10l-5.58 2.72L12 19l-2.92-6.28L3.5 10l6.11-2.04L12 2z" />
  </svg>
);

function tokens(tone) {
  const t = tone === 'drawer' ? '--drawer' : '--modes';
  return {
    surface: `var(${t}-surface)`,
    surfaceStrong: tone === 'drawer' ? `var(${t}-surface)` : `var(${t}-surface-strong)`,
    border: `var(${t}-border)`,
    text: `var(${t}-text)`,
    textMuted: `var(${t}-text-muted)`,
    textDim: `var(${t}-text-dim)`,
  };
}

const STAGE_PHRASES = [
  'Ready for soundcheck, {name}.',
  'The stage is yours, {name}.',
  'Time to plug in.',
  'Set the tempo, {name}.',
  'Cue the lights.',
  'Count it in: 1, 2, 3, 4…',
  'Library synced and ready.',
  'Ready for the downbeat.',
  "Let's make some noise, {name}.",
  'Welcome to the cockpit.',
];

export function StageGreeting({ displayName, tone = 'modes' }) {
  const v = tokens(tone);
  const [template] = useState(
    () => STAGE_PHRASES[Math.floor(Math.random() * STAGE_PHRASES.length)]
  );
  const phrase = template.replaceAll('{name}', displayName);

  return (
    <h1
      className="text-[34px] leading-[40px] font-serif m-0 tracking-tight"
      style={{ color: v.text }}
    >
      {phrase}
    </h1>
  );
}

export function AccountSummary({ isSignedIn, displayEmail, onSignOut, tone = 'modes' }) {
  if (!isSignedIn) return null;
  const v = tokens(tone);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div
          className="text-label-11 uppercase tracking-[0.15em]"
          style={{ color: v.textDim }}
        >
          Your Account
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="text-label-11 uppercase tracking-[0.15em] bg-transparent border-none p-0 cursor-pointer transition-colors"
            style={{ color: v.textMuted }}
            onMouseEnter={e => (e.currentTarget.style.color = v.text)}
            onMouseLeave={e => (e.currentTarget.style.color = v.textMuted)}
          >
            Sign out
          </button>
        )}
      </div>
      <div className="text-copy-16 truncate" style={{ color: v.text }}>
        {displayEmail}
      </div>
    </div>
  );
}

export function PlanLabel({ plan, tone = 'modes' }) {
  const v = tokens(tone);
  return (
    <div>
      <div
        className="text-label-11 uppercase tracking-[0.15em] mb-1.5"
        style={{ color: v.textDim }}
      >
        Your Plan
      </div>
      <div className="text-copy-16" style={{ color: v.text }}>
        {plan} Plan
      </div>
    </div>
  );
}

export function UpgradePill({ onUpgrade }) {
  return (
    <button
      onClick={onUpgrade}
      className="upgrade-pill w-full h-12 rounded-xl flex items-center justify-center gap-2 cursor-pointer border-none relative overflow-hidden"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="text-fuchsia-700"><SparkleIcon /></span>
      <span className="text-copy-15 font-semibold bg-gradient-to-r from-amber-700 via-fuchsia-700 to-cyan-700 bg-clip-text text-transparent">
        Upgrade to Pro
      </span>
      <span className="text-fuchsia-700"><SparkleIcon /></span>
    </button>
  );
}

export function SignInButton({ onSignIn }) {
  return (
    <Button variant="brand" size="lg" className="w-full" onClick={onSignIn}>
      Sign in
    </Button>
  );
}

export function CreateAccountButton({ onCreateAccount }) {
  return (
    <Button variant="secondary" size="md" className="w-full" onClick={onCreateAccount}>
      Create account
    </Button>
  );
}

