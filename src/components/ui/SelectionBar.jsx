import React from 'react';
import { cn } from '../../lib/utils';
import { GLASS } from '../../lib/glass';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

/**
 * Floating multi-select action bar (Songs + Setlists libraries), on the same
 * liquid-glass material as BottomNav.
 *
 * The actions live on ONE non-wrapping row that scrolls horizontally when they
 * overflow. The previous version wrapped and used `rounded-full`, so on a phone
 * the bar grew tall and the pill radius (half the height) turned it into a black
 * circle floating over the list. A fixed radius + no wrap makes that impossible.
 */
export function SelectionBar({ count, onClear, barRef, liftAboveNav = false, children }) {
  return (
    <div
      ref={barRef}
      className="fixed left-1/2 -translate-x-1/2 z-[160] max-w-[calc(100vw-1.5rem)] rounded-[24px] border border-white/10 overflow-hidden"
      style={{
        ...GLASS,
        bottom: liftAboveNav ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : '24px',
      }}
    >
      <div className="flex items-center gap-1.5 pl-4 pr-2 py-2 overflow-x-auto no-scrollbar">
        <span className="text-label-14 font-semibold text-[var(--ds-gray-1000)] whitespace-nowrap shrink-0">
          {count} selected
        </span>
        <span className="w-px h-5 bg-white/15 shrink-0" />
        {children}
        <button
          onClick={onClear}
          aria-label="Clear selection"
          className={cn(
            'w-9 h-9 min-h-0 shrink-0 rounded-full flex items-center justify-center cursor-pointer',
            'border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-white/10 transition-colors',
          )}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
