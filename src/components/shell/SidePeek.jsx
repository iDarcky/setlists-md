import React, { useEffect } from 'react';

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
const ExpandIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);
const CollapseIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v3a2 2 0 0 1-2 2H4" /><path d="M20 9h-3a2 2 0 0 1-2-2V4" />
    <path d="M4 15h3a2 2 0 0 1 2 2v3" /><path d="M15 20v-3a2 2 0 0 1 2-2h3" />
  </svg>
);

/**
 * Notion-style right-side "peek" panel. Slides in over a dimmed/blurred
 * backdrop; clicking the backdrop or pressing Escape closes it. Desktop only
 * (lg+) — below that, callers navigate to the full view instead.
 *
 * Has its own header strip (expand / close) so the peek always has explicit
 * controls regardless of what it renders. When `expanded`, it fills the
 * whole viewport. Reuses the global `dialog-open` scroll-lock (see index.css).
 */
export default function SidePeek({ open, onClose, onExpand, expanded = false, children, label = 'Preview' }) {
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

  const btn =
    'inline-flex items-center justify-center w-8 h-8 rounded-md border-none bg-transparent ' +
    'text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] ' +
    'transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]';

  return (
    <div className="fixed inset-0 z-[120] hidden lg:block" role="dialog" aria-modal="true" aria-label={label}>
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
        {/* Peek header */}
        <div className="flex items-center justify-between gap-2 px-3 h-11 shrink-0 border-b border-[var(--ds-gray-200)]">
          <div className="flex items-center gap-1">
            {onExpand && (
              <button onClick={onExpand} className={btn} aria-label={expanded ? 'Exit full screen' : 'Expand to full screen'} title={expanded ? 'Exit full screen' : 'Expand'}>
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </button>
            )}
          </div>
          <button onClick={onClose} className={btn} aria-label="Close preview" title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
