import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';

const BugIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
    <path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
    <path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" />
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" /><path d="M19 17v4" />
    <path d="M3 5h4" /><path d="M17 19h4" />
  </svg>
);

const MessageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
  </svg>
);

// Question mark inside a circle — the feedback/help entry-point glyph.
const HelpCircleIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const FEEDBACK_TYPES = [
  { key: 'bug', label: 'Bug', ghLabel: 'bug', Icon: BugIcon },
  { key: 'feature', label: 'Feature', ghLabel: 'enhancement', Icon: SparklesIcon },
  { key: 'general', label: 'General', ghLabel: 'feedback', Icon: MessageIcon },
];

export default function FeedbackButton({ variant = 'floating' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const modalRef = useRef(null);

  // Clear transient submit state each time the modal opens.
  useEffect(() => {
    if (open) { setError(null); setSent(false); }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const handleSubmit = async () => {
    if (!description.trim() || busy) return;
    if (!supabase) {
      setError('Feedback is temporarily unavailable. Please try again later.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: insertErr } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id ?? null,
          type,
          description: description.trim(),
          user_agent: navigator.userAgent,
        });
      if (insertErr) throw insertErr;
      setSent(true);
      setDescription('');
      setType('bug');
      // Auto-close shortly after the thank-you confirmation.
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 1400);
    } catch (err) {
      setError(err.message || 'Could not send feedback. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Trigger — header icon, mobile-drawer row, or a floating bubble. */}
      {variant === 'inline' ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-copy-14 font-semibold text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] transition-colors cursor-pointer"
          aria-label="Send feedback"
        >
          <MessageIcon />
          Send feedback
        </button>
      ) : variant === 'drawer' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--drawer-surface)] hover:bg-[var(--drawer-surface-hover)] border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all duration-150 text-left"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Send feedback"
        >
          <span className="text-[var(--drawer-text-muted)]"><HelpCircleIcon size={20} /></span>
          <span className="flex-1 text-copy-15 text-[var(--drawer-text)] font-medium">Send feedback</span>
        </button>
      ) : variant === 'header' ? (
        <button
          onClick={() => setOpen(true)}
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
          aria-label="Send feedback"
          title="Send feedback"
        >
          <HelpCircleIcon size={20} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[90] w-11 h-11 rounded-full bg-[var(--ds-gray-200)] border border-[var(--ds-gray-400)] shadow-lg flex items-center justify-center cursor-pointer hover:bg-[var(--ds-gray-300)] hover:border-[var(--ds-gray-600)] transition-all duration-200 active:scale-95 text-[var(--ds-gray-900)] sm:left-[90px] xl:left-[290px] left-4"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Send feedback"
        >
          <HelpCircleIcon size={22} />
        </button>
      )}

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-2xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl flex flex-col overflow-hidden"
            style={{
              animation: 'feedbackSlideUp 0.2s ease-out',
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ds-gray-200)]">
              <h2 className="text-heading-18 text-[var(--ds-gray-1000)] m-0 font-semibold">Send Feedback</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Type selector */}
            <div className="px-5 pt-4 pb-2">
              <label className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-2 block">
                Type
              </label>
              <div className="flex p-1 bg-[var(--ds-gray-200)] rounded-lg">
                {FEEDBACK_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={`flex-1 py-2 px-3 rounded-md text-label-13 font-medium border-none cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5 ${
                      type === t.key
                        ? 'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] shadow-sm'
                        : 'bg-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-900)]'
                    }`}
                  >
                    <t.Icon />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="px-5 pt-3 pb-4">
              <label className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-2 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'Describe the bug \u2014 what happened vs what you expected\u2026'
                    : type === 'feature'
                    ? "Describe the feature you\u2019d like to see\u2026"
                    : "Tell us what\u2019s on your mind\u2026"
                }
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-copy-14 text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-600)] outline-none focus:border-[var(--ds-gray-600)] transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--ds-gray-200)] bg-[var(--ds-background-200)]">
              <span className="text-copy-13 min-w-0 truncate" role="status" aria-live="polite">
                {sent
                  ? <span className="text-[var(--ds-teal-900)] font-medium">Thanks — feedback sent!</span>
                  : error
                  ? <span className="text-[var(--ds-red-900)]">{error}</span>
                  : null}
              </span>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                  {sent ? 'Close' : 'Cancel'}
                </Button>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleSubmit}
                  loading={busy}
                  disabled={!description.trim() || busy || sent}
                  className={!description.trim() || sent ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes feedbackSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
