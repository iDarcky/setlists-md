import { Button } from './ui/Button';

export default function FounderNote({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5 py-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 sm-onboard-screen-in shadow-2xl relative"
        style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: 'transparent', color: 'var(--ds-gray-500)', border: 'none' }}
          aria-label="Close note"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="text-label-11 font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--color-brand)' }}>
          A note from the team
        </div>

        <div className="text-copy-15 text-[var(--ds-gray-1000)] leading-relaxed">
          <p className="m-0 mb-4">Hey &mdash; glad you're here.</p>
          <p className="m-0 mb-4">
            I built setlists.md because I was tired of squinting at PDF chord charts on stage and rewriting them by hand every time we played in a different key. You shouldn't have to fight your tools when you're just trying to play.
          </p>
          <p className="m-0 mb-4">
            Every chart you make stays on your device. Sync is optional, and your data is always yours &mdash; plain Markdown files you can open in any text editor, forever.
          </p>
          <p className="m-0 mb-4">
            If something ever feels off, drop us a line. We read every message.
          </p>
        </div>

        <div className="mt-6">
          <div className="text-heading-20 italic font-serif" style={{ color: 'var(--color-brand)' }}>
            &mdash; Daniel
          </div>
          <div className="text-label-12 uppercase tracking-widest mt-1" style={{ color: 'var(--ds-gray-600)' }}>
            setlists.md team
          </div>
        </div>

        <Button variant="brand" size="md" onClick={onClose} className="mt-7 w-full">
          Thanks, Daniel
        </Button>
      </div>
    </div>
  );
}
