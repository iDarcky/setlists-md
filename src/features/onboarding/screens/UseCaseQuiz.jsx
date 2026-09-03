import { Button } from '@/ui/Button';

const OPTIONS = [
  {
    id: 'sunday',
    title: 'Sunday services',
    subtitle: 'I lead or play in weekly worship',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V8l7-5 7 5v13" />
        <path d="M9 21V12h6v9" /><path d="M12 4v4" />
      </svg>
    ),
  },
  {
    id: 'band',
    title: 'Band rehearsals',
    subtitle: 'I jam or play with a group',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M14 21v-1a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1" />
      </svg>
    ),
  },
  {
    id: 'solo',
    title: 'Solo practice',
    subtitle: 'I play and learn songs by myself',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    id: 'gigs',
    title: 'Worship nights & gigs',
    subtitle: 'Larger events, occasional shows',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2" />
      </svg>
    ),
  },
];

export default function UseCaseQuiz({ value, onChange, onContinue, onBack, onSkip }) {
  return (
    <div className="min-h-screen bg-[var(--ds-background-200)] flex flex-col items-center px-5 py-8 relative sm-onboard-screen-in">
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

      <div className="w-full max-w-md flex flex-col items-center mt-8 flex-1">
        <div className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-widest mb-3">Step 2 of 3</div>

        <h1 className="text-heading-28 text-[var(--ds-gray-1000)] text-center m-0 leading-tight">
          How do you use chord charts?
        </h1>
        <p className="text-copy-14 text-[var(--ds-gray-600)] text-center mt-2 max-w-xs">
          Pick the closest match.
        </p>

        <div className="mt-8 flex flex-col gap-3 w-full">
          {OPTIONS.map(opt => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange(opt.id)}
                className={`relative flex items-center gap-4 px-4 py-4 rounded-xl text-left cursor-pointer border transition-all duration-150 ${
                  active ? 'sm-onboard-tile-bounce' : ''
                }`}
                style={{
                  background: active ? 'var(--color-brand-soft)' : 'var(--ds-background-100)',
                  borderColor: active ? 'var(--color-brand)' : 'var(--ds-gray-400)',
                  color: active ? 'var(--color-brand)' : 'var(--ds-gray-1000)',
                  boxShadow: active ? '0 0 0 1px var(--color-brand)' : 'none',
                }}
              >
                <div className="shrink-0">{opt.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-copy-14 font-semibold">{opt.title}</div>
                  <div className="text-label-12 mt-0.5" style={{ color: active ? 'var(--color-brand)' : 'var(--ds-gray-600)' }}>
                    {opt.subtitle}
                  </div>
                </div>
                {active && (
                  <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline className="sm-onboard-check-draw" points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-md flex items-center gap-3 mt-6 mb-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>Back</Button>
        )}
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          disabled={!value}
          className="flex-1"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
