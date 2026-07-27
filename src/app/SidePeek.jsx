import React, { useEffect } from 'react';

/**
 * Notion-style right-side "peek" panel. Slides in over a dimmed/blurred
 * backdrop; clicking the backdrop or pressing Escape closes it. Visibility is
 * driven entirely by the `open` prop — callers decide which breakpoints get
 * the overlay (desktop + tablet portrait today; tablet landscape uses a pinned
 * pane instead).
 *
 * The peek has no chrome of its own — the rendered child owns its toolbar
 * (collapse/expand on the left, actions on the right). When `expanded`, the
 * panel fills the whole viewport. Reuses the global `dialog-open` scroll-lock
 * (see index.css).
 */
export default function SidePeek({ open, onClose, expanded = false, children, label = 'Preview' }) {
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
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={label}>
      {!expanded && (
        <div
          className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={onClose}
        />
      )}
      <div
        className={
          'absolute top-0 right-0 h-full bg-[var(--ds-background-100)] border-l border-[var(--ds-gray-300)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 ' +
          (expanded ? 'w-full' : 'w-[46%] min-w-[540px] max-w-[920px]')
        }
      >
        {children}
      </div>
    </div>
  );
}
