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
          (expanded ? 'w-full' : '')
        }
        // Never wider than 46% of the viewport, so the left 54% is ALWAYS
        // backdrop — the row you clicked to open this is in that strip, which
        // means the pointer is already outside the panel and one click
        // dismisses without moving the mouse (owner, 2026-07-31).
        //
        // The old rule was `w-[46%] min-w-[540px]`, and the floor was the bug:
        // on a 1000px window 540px is 54% of the screen, so the panel reached
        // back under the pointer on exactly the narrow desktops where the
        // dismiss target was already smallest. `min()` keeps the readable
        // width where there's room and yields where there isn't.
        style={expanded ? undefined : { width: 'min(46vw, 920px)' }}
      >
        {children}
      </div>
    </div>
  );
}
