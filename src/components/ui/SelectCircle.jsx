import React from 'react';
import { cn } from '../../lib/utils';

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

// iOS-style selection circle, overlaid at the left edge of a list card. Appears
// when selection mode is `active`. Absolute-positioned so it never reserves
// gutter space; the card slides its content right instead (see `selectPad`).
//
// `min-h-0` is load-bearing. The global phone rule
// (`@media (max-width: 639px) { button { min-height: 44px } }`) stretched this
// 22px circle to 22×44 — a grey capsule down the left edge of every row on
// mobile. Never drop it, and be wary of the same rule on any small round button.
export function SelectCircle({ active, selected, onToggle, label = 'Select' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'absolute left-4 top-1/2 -translate-y-1/2 z-10 w-[22px] h-[22px] min-h-0 shrink-0 rounded-full',
        'flex items-center justify-center cursor-pointer',
        'transition-[opacity,transform,background-color,border-color] duration-200 ease-out',
        selected
          ? 'bg-[var(--color-brand)] border-2 border-[var(--color-brand)] text-white'
          // Unselected: a soft hairline ring rather than a heavy 2px outline —
          // it should read as an empty checkbox, not a drawn shape.
          : 'border border-[var(--ds-gray-500)] bg-black/10 text-transparent',
        active ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none',
      )}
      style={selected ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--color-brand) 45%, transparent)' } : undefined}
    >
      <Check />
    </button>
  );
}
