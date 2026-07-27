import { Button } from '@/ui/Button';

export default function WakeLockExplainer({ onContinue }) {
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
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 leading-tight">
          Stage mode keeps your screen on
        </h2>
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-6 leading-relaxed">
          We use the browser's Wake Lock API so your iPad, phone, or laptop won't lock mid-set. No system permission popup &mdash; it just works in the background.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="brand" size="lg" onClick={onContinue} className="w-full">
            Got it &mdash; let's go
          </Button>
        </div>
      </div>
    </div>
  );
}
