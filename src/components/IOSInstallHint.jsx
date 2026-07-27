import { Button } from '@/ui/Button';

const ShareIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V3" />
    <path d="m8 7 4-4 4 4" />
    <rect x="4" y="14" width="16" height="7" rx="2" />
  </svg>
);

const PlusIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const STEPS = [
  { icon: ShareIcon, body: 'Tap the Share button in Safari (the square with an arrow).' },
  { icon: PlusIcon, body: 'Choose "Add to Home Screen".' },
  { icon: null, body: 'Hit "Add" — the app installs and works offline from then on.' },
];

export default function IOSInstallHint({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5 py-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 sm-onboard-screen-in shadow-2xl"
        style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--color-brand-soft)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 leading-tight">
          Install to your Home Screen
        </h2>
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-5 leading-relaxed">
          On iPad and iPhone, setlists.md installs through Safari's share menu. You'll get an app icon, full-screen mode, and offline charts.
        </p>

        <ol className="flex flex-col gap-3 m-0 p-0 list-none">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-label-12 font-bold mt-0.5"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
              >
                {step.icon || (i + 1)}
              </div>
              <div className="text-copy-14 text-[var(--ds-gray-900)] leading-relaxed">{step.body}</div>
            </li>
          ))}
        </ol>

        <Button variant="brand" size="lg" onClick={onClose} className="mt-6 w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}
