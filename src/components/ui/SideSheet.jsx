import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * SideSheet — right-anchored slide-over panel for secondary controls
 * (e.g. the editor's "Song Details"). Tablet/desktop-first: slides in from
 * the right on >=sm, and falls back to a full-width sheet on phones.
 *
 * Mirrors Dialog.jsx for the portal + scroll-lock plumbing (the `dialog-open`
 * class on <html> also freezes the app's real scroll container, <main>, so the
 * background doesn't drift on iPad/iOS Safari).
 */
export default function SideSheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('dialog-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove('dialog-open');
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex justify-end animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />
      <div
        className="relative h-full w-full sm:max-w-[440px] bg-[var(--ds-background-100)] border-l border-[var(--ds-gray-400)] shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-14 shrink-0 border-b border-[var(--ds-gray-200)]">
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0 truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] border-none bg-transparent cursor-pointer shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4">
          {children}
        </div>
        {footer && (
          <div
            className="shrink-0 border-t border-[var(--ds-gray-200)] px-5 py-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
