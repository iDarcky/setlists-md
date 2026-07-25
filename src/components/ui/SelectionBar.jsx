import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { GLASS } from '../../lib/glass';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
  </svg>
);

/**
 * Floating multi-select action bar (Songs + Setlists), on the same liquid-glass
 * material as BottomNav.
 *
 * Overflow follows the iOS toolbar rule: a small fixed set of primary actions
 * stays visible and everything else collapses into a "•••" menu. The bar never
 * wraps and never scrolls sideways — earlier versions did both, and wrapping
 * with `rounded-full` turned the bar into a black circle over the list.
 */
export function SelectionBar({ count, onClear, barRef, liftAboveNav = false, more = [], children }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const items = (more || []).filter(Boolean);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [moreOpen]);

  return (
    <div
      ref={barRef}
      className="fixed left-1/2 -translate-x-1/2 z-[160] max-w-[calc(100vw-1.5rem)] rounded-[24px] border border-white/10 overflow-hidden"
      style={{
        ...GLASS,
        bottom: liftAboveNav ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : '24px',
      }}
    >
      <div className="flex items-center gap-1 pl-3.5 pr-1.5 py-2">
        <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] whitespace-nowrap shrink-0">
          {count} selected
        </span>
        <span className="w-px h-5 bg-white/15 shrink-0" />
        {children}

        {items.length > 0 && (
          <div ref={moreRef} className="relative shrink-0">
            <button
              onClick={() => setMoreOpen(o => !o)}
              aria-label="More actions"
              aria-expanded={moreOpen}
              className="w-9 h-9 min-h-0 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-[var(--ds-gray-1000)] hover:bg-white/10 transition-colors"
            >
              <MoreIcon />
            </button>
            {moreOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-[210px] rounded-2xl border border-white/10 overflow-hidden py-1"
                style={GLASS}
                role="menu"
              >
                {items.map(it => (
                  <button
                    key={it.label}
                    role="menuitem"
                    onClick={() => { setMoreOpen(false); it.onClick?.(); }}
                    className={cn(
                      'w-full text-left px-4 py-3 min-h-0 bg-transparent border-none cursor-pointer text-copy-15 transition-colors hover:bg-white/10',
                      it.danger ? 'text-[var(--ds-red-700)]' : 'text-[var(--ds-gray-1000)]',
                    )}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="w-9 h-9 min-h-0 shrink-0 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-white/10 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
