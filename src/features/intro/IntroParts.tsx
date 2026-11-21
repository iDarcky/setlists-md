// Small pieces the first-run screens share (mockup "first-run v9",
// 2026-11-20). Plain views: values in, events out.
import type { ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { JOIN_PARTS, toggleJoinPart } from '@/lib/joinLink';
import { Button, LogoMark, TextLink } from './ui';

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /></svg>
);
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.6 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5l3.6-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.4 2.2 15 1 12 1 7.7 1 4 3.4 2.2 7l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
);

/** The logo on one line: the mark and the wordmark. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={36} />
      <span className="text-[22px] font-semibold tracking-[-0.5px]">
        setlists<span className="font-mono text-muted-foreground">.md</span>
      </span>
    </div>
  );
}

const HEADLINE: Array<Array<[string, string]>> = [
  [['G', 'Sun'], ['D/F#', 'day,']],
  [['Em', 'sor'], ['C', 'ted.']],
];

/** "Sunday, sorted." on two lines, with chords over the words like a chart. */
export function ChordHeadline() {
  return (
    <h1 aria-label="Sunday, sorted." className="m-0 flex flex-col items-center gap-2 text-[56px] font-semibold leading-none tracking-[-2px]">
      {HEADLINE.map((line, i) => (
        <span key={i} aria-hidden="true" className="flex">
          {line.map(([chord, word]) => (
            <span key={word} className="inline-flex flex-col items-start whitespace-pre">
              <span className="mb-1.5 font-mono text-[15px] font-semibold tracking-normal text-[var(--chord)]">{chord}</span>
              {word}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export interface ProviderProps {
  onApple: () => void;
  onGoogle: () => void;
  onCreateAccount: () => void;
  onLogIn: () => void;
  busy?: 'apple' | 'google' | null;
}

/**
 * Which providers are switched on: VITE_ENABLE_APPLE_SIGNIN / VITE_ENABLE_GOOGLE_SIGNIN
 * = 'true', set once that provider is set up in Supabase Auth. With none on,
 * email is the one main button. Read per call so tests can stub the env.
 */
function signInProviders(): { apple: boolean; google: boolean } {
  const env = import.meta.env;
  return { apple: env.VITE_ENABLE_APPLE_SIGNIN === 'true', google: env.VITE_ENABLE_GOOGLE_SIGNIN === 'true' };
}

/**
 * The way in. Email only: Create account (ink) and Log in (outline), one tap
 * from the first screen. With Apple / Google on, they lead and email goes quiet.
 */
export function ProviderButtons({ onApple, onGoogle, onCreateAccount, onLogIn, busy }: ProviderProps) {
  const { apple, google } = signInProviders();
  if (!apple && !google) {
    return (
      <>
        <Button onClick={onCreateAccount}>Create account</Button>
        <Button variant="outline" onClick={onLogIn}>Log in</Button>
      </>
    );
  }
  return (
    <>
      {apple && <Button onClick={onApple} loading={busy === 'apple'} disabled={!!busy}><AppleIcon /> Continue with Apple</Button>}
      {google && <Button variant="outline" onClick={onGoogle} loading={busy === 'google'} disabled={!!busy}><GoogleIcon /> Continue with Google</Button>}
      <Button variant="ghost" className="hover:bg-transparent" onClick={onCreateAccount} disabled={!!busy}><Mail size={18} strokeWidth={1.8} aria-hidden="true" /> Sign up with email</Button>
      <TextLink question="Have an account?" answer="Log in" onClick={onLogIn} />
    </>
  );
}

/** The terms line, under the button that creates the account. */
export function Legal({ onShowLegal, verb = 'continuing' }: { onShowLegal?: (page: 'terms' | 'privacy') => void; verb?: string }) {
  return (
    <p className="m-0 text-center text-caption text-muted-foreground">
      By {verb} you agree to our{' '}
      <Button variant="link" className="text-muted-foreground underline" onClick={() => onShowLegal?.('terms')}>Terms</Button>
      {' '}and{' '}
      <Button variant="link" className="text-muted-foreground underline" onClick={() => onShowLegal?.('privacy')}>Privacy Policy</Button>.
    </p>
  );
}

/** The main button right under the fields, so the keyboard never hides it. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/** An icon on a raised square, over a heading. */
export function IconSquare({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-raised text-foreground">
      {children}
    </span>
  );
}

/** Bars across the top: how far through setting up you are. */
export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Setting up"
      aria-valuemin={1}
      aria-valuemax={of}
      aria-valuenow={step}
      className="absolute inset-x-6 flex gap-1.5"
      style={{ top: 'calc(6px + env(safe-area-inset-top))' }}
    >
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-foreground' : 'bg-border'}`} />
      ))}
    </div>
  );
}

/** Instruments as wrapping pills; picked = ink fill, no tick, so nothing moves when you tap (2026-11-20). */
export function PartPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div role="group" aria-label="What do you play?" className="flex flex-wrap gap-2">
      {JOIN_PARTS.map((p: { id: string; label: string }) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleJoinPart(value, p.id))}
            className={`inline-flex h-11 cursor-pointer items-center rounded-full border px-4 font-sans text-body font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-raised'}`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export interface Message { kind: 'info' | 'success' | 'error'; text: string; action?: ReactNode }
