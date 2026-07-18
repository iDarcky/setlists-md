import React from 'react';
import { cn } from '../../lib/utils';

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

// iOS-style selection circle, overlaid at the left edge of a list card. Appears
// when selection mode is `active`, or on hover of the parent `.group` (desktop
// affordance). Absolute-positioned so it never reserves gutter space; the card
// slides its content right instead (see the `selectPad` helper below).
export function SelectCircle({ active, selected, onToggle, label = 'Select' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'absolute left-4 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-150',
        selected
          ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
          : 'border-[var(--modes-text-dim)] bg-transparent text-transparent',
        active ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100',
      )}
    >
      <Check />
    </button>
  );
}
