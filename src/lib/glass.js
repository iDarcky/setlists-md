// iOS 26 "Liquid Glass": translucent fill, heavy blur+saturate, a specular top
// highlight and hairline edge, plus a soft drop shadow. Shared by every floating
// surface (BottomNav, the multi-select bar) so they read as the same material.
export const GLASS = {
  background: 'color-mix(in srgb, var(--ds-background-200) 55%, transparent)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 12px 34px rgba(0,0,0,0.38)',
};

// Actions inside a glass bar. `min-h-0` is load-bearing: the global phone rule
// (`@media (max-width: 639px) { button { min-height: 44px } }`) would otherwise
// stretch every pill and blow the bar's height up.
export const selectionActionClass =
  'h-9 min-h-0 px-3.5 rounded-full text-label-14 font-medium whitespace-nowrap cursor-pointer border-none bg-transparent ' +
  'text-[var(--ds-gray-1000)] hover:bg-white/10 active:bg-white/15 transition-colors';

export const selectionDangerClass =
  'h-9 min-h-0 px-3.5 rounded-full text-label-14 font-medium whitespace-nowrap cursor-pointer border-none bg-transparent ' +
  'text-[var(--ds-red-700)] hover:bg-[var(--ds-red-100)] transition-colors';
