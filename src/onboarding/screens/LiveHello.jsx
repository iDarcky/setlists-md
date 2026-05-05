import { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { transposeChord, transposeKey, ALL_KEYS, semitonesBetween } from '../../music';
import ChordLine from '../ChordLine';

const BASE_KEY = 'G';
const BASE_LINES = [
  'A[G]mazing [G7]grace, how [C]sweet the [G]sound',
  'That saved a wretch like [D]me.',
  'I [G]once was [G7]lost, but [C]now I\'m [G]found',
  'Was blind, but [D7]now I [G]see.',
];

function transposeLine(line, semis) {
  return line.replace(/\[([^\]]+)\]/g, (_, c) => `[${transposeChord(c, semis)}]`);
}

export default function LiveHello({ onContinue, onSkip, onSignIn, onInteract }) {
  const [semis, setSemis] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [animateBadge, setAnimateBadge] = useState(0);
  const ringTimerRef = useRef(null);
  const [showRing, setShowRing] = useState(true);

  // Stop the attention ring once the user has tapped a key
  useEffect(() => {
    if (hasInteracted && ringTimerRef.current == null) {
      ringTimerRef.current = setTimeout(() => setShowRing(false), 600);
    }
    return () => clearTimeout(ringTimerRef.current);
  }, [hasInteracted]);

  const currentKey = transposeKey(BASE_KEY, semis);
  const lines = BASE_LINES.map(l => transposeLine(l, semis));

  const handleKeyTap = (k) => {
    const newSemis = semitonesBetween(BASE_KEY, k);
    if (newSemis !== ((semis % 12) + 12) % 12) {
      setSemis(newSemis);
      setAnimateBadge(n => n + 1);
      if (!hasInteracted) {
        setHasInteracted(true);
        onInteract?.();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ds-background-200)] flex flex-col items-center px-5 py-8 relative overflow-x-hidden sm-onboard-screen-in">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none w-[700px] h-[700px] rounded-full"
        style={{
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, var(--color-brand-soft) 0%, transparent 65%)',
        }}
      />

      {/* Skip */}
      {onSkip && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="absolute top-4 right-4 text-[var(--ds-gray-600)] z-10"
        >
          Skip
        </Button>
      )}

      <div className="relative z-10 w-full max-w-md flex flex-col items-center mt-6">
        {/* Logo mark */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-5 shadow-lg"
          style={{
            background: 'linear-gradient(135deg, var(--color-brand), #6b9e91)',
            boxShadow: '0 8px 24px var(--color-brand-border)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        {/* Headline */}
        <h1 className="text-heading-32 text-[var(--ds-gray-1000)] text-center m-0 leading-tight">
          A chord chart<br/>that responds to you.
        </h1>
        <p className="text-copy-14 text-[var(--ds-gray-600)] text-center mt-3 max-w-sm leading-relaxed">
          Tap a key. Watch every chord shift while the lyrics stay aligned.
        </p>

        {/* Live chord chart card */}
        <div
          className="mt-7 w-full rounded-2xl overflow-hidden border shadow-xl"
          style={{ background: 'var(--ds-background-100)', borderColor: 'var(--ds-gray-400)' }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--ds-gray-300)' }}>
            <div>
              <div className="text-copy-14 font-semibold text-[var(--ds-gray-1000)]">Amazing Grace</div>
              <div className="text-label-12 text-[var(--ds-gray-600)]">John Newton</div>
            </div>
            <div
              key={animateBadge}
              className="px-3 py-1.5 rounded-lg font-bold text-copy-14 sm-onboard-key-pulse"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
            >
              Key of {currentKey}
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)] mb-3">Verse 1</div>
            <div className="flex flex-col gap-3">
              {lines.map((line, i) => (
                <ChordLine key={i} line={line} animateKey={semis} />
              ))}
            </div>
          </div>
        </div>

        {/* Helper hint */}
        <div className="mt-4 flex items-center gap-2">
          {!hasInteracted && (
            <div
              aria-hidden="true"
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--color-brand)', animation: 'sm-onboard-key-pulse 1.6s ease-out infinite' }}
            />
          )}
          <span className="text-label-12 text-[var(--ds-gray-600)]">
            {hasInteracted ? 'Try another key — or pick yours.' : 'Try tapping a different key below.'}
          </span>
        </div>

        {/* Key picker */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-sm relative">
          {ALL_KEYS.map((k) => {
            const isActive = transposeKey(BASE_KEY, semis) === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyTap(k)}
                className={`relative px-3 py-2 rounded-lg text-label-13 font-semibold transition-all duration-150 cursor-pointer border ${
                  isActive ? 'sm-onboard-tile-bounce' : ''
                }`}
                style={{
                  minWidth: 44,
                  background: isActive ? 'var(--color-brand)' : 'var(--ds-background-100)',
                  borderColor: isActive ? 'var(--color-brand)' : 'var(--ds-gray-400)',
                  color: isActive ? 'white' : 'var(--ds-gray-900)',
                }}
              >
                {k}
                {/* Attention ring on default key until first interaction */}
                {showRing && !hasInteracted && k === BASE_KEY && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{
                      boxShadow: '0 0 0 0 var(--color-brand)',
                      animation: 'sm-onboard-key-pulse 1.4s ease-out infinite',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          className="mt-8 w-full max-w-xs"
        >
          I want this for my songs →
        </Button>

        {/* Sign-in tucked away */}
        {onSignIn && (
          <p className="mt-5 text-copy-13 text-[var(--ds-gray-600)] text-center">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="text-[var(--color-brand)] font-semibold bg-transparent border-none p-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
