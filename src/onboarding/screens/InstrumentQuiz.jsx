import { Button } from '@/ui/Button';

const OPTIONS = [
  {
    id: 'guitar',
    label: 'Guitar',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4l4 4-7 7-4-4 7-7z" />
        <path d="M9 11l-5 5a2.83 2.83 0 1 0 4 4l5-5" />
        <path d="M14 6l4 4" />
      </svg>
    ),
  },
  {
    id: 'piano',
    label: 'Piano / Keys',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="1.5" />
        <line x1="9" y1="6" x2="9" y2="13" /><line x1="15" y1="6" x2="15" y2="13" />
        <line x1="12" y1="13" x2="12" y2="18" />
      </svg>
    ),
  },
  {
    id: 'vocals',
    label: 'Vocals',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
    ),
  },
  {
    id: 'bass',
    label: 'Bass',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="17" r="3" /><circle cx="17" cy="13" r="2" />
        <path d="M12 17V5l7-2v8" />
      </svg>
    ),
  },
  {
    id: 'drums',
    label: 'Drums',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="8" rx="9" ry="3" />
        <path d="M3 8v6c0 1.66 4 3 9 3s9-1.34 9-3V8" />
        <path d="M7 11l-3 9M17 11l3 9" />
      </svg>
    ),
  },
  {
    id: 'other',
    label: 'Other',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

export default function InstrumentQuiz({ value, onChange, onContinue, onBack, onSkip }) {
  const selected = value || [];
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

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
        {/* Step counter */}
        <div className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-widest mb-3">Step 1 of 3</div>

        <h1 className="text-heading-28 text-[var(--ds-gray-1000)] text-center m-0 leading-tight">
          What do you play?
        </h1>
        <p className="text-copy-14 text-[var(--ds-gray-600)] text-center mt-2 max-w-xs">
          Pick all that apply — we'll tune the app for you.
        </p>

        {/* Tile grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 w-full">
          {OPTIONS.map(opt => {
            const active = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className={`relative flex items-center gap-3 px-4 py-4 rounded-xl text-left cursor-pointer border transition-all duration-150 ${
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
                <div className="text-copy-14 font-semibold">{opt.label}</div>
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
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

      {/* Sticky footer */}
      <div className="w-full max-w-md flex items-center gap-3 mt-6 mb-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>Back</Button>
        )}
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          disabled={selected.length === 0}
          className="flex-1"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
