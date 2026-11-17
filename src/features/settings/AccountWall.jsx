import { Button } from '@/ui/Button';

const KIND_LABELS = {
  song: 'song',
  setlist: 'setlist',
};

export default function AccountWall({ kind = 'song', savedItemTitle, onSaveLocal, onSignIn, onSkip }) {
  const label = KIND_LABELS[kind] || 'item';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
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
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </div>

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-1 leading-tight">
          Your {label} is saved
        </h2>
        {savedItemTitle && (
          <div className="text-copy-14 font-semibold mb-3" style={{ color: 'var(--color-brand)' }}>
            "{savedItemTitle}"
          </div>
        )}
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-6 leading-relaxed">
          Want it on every device? Sign in to sync &mdash; your library follows you to phone, iPad, and laptop with end-to-end encryption. Or keep things local; you can always sync later.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="brand" size="lg" onClick={onSaveLocal} className="w-full">
            Keep it local
          </Button>
          <Button variant="secondary" size="lg" onClick={onSignIn} className="w-full">
            Sign in to sync
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip} className="w-full text-[var(--ds-gray-600)]">
            Ask me later
          </Button>
        </div>
      </div>
    </div>
  );
}
