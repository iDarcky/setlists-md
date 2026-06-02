import React, { useEffect } from 'react';

/**
 * Notion-style right-side "peek" panel. Slides in over a dimmed/blurred
 * backdrop; clicking the backdrop or pressing Escape closes it. Desktop only
 * (lg+) — below that, callers navigate to the full view instead.
 *
 * Reuses the global `dialog-open` scroll-lock class (see index.css) so the
 * list behind the peek doesn't drag on iPad.
 */
export default function SidePeek({ open, onClose, children, label = 'Preview' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('dialog-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('dialog-open');
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] hidden lg:block" role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div
        className="absolute top-0 right-0 h-full w-[46%] min-w-[540px] max-w-[920px] bg-[var(--ds-background-100)] border-l border-[var(--ds-gray-300)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
