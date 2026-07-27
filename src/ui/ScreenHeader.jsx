import React from 'react';
import { cn } from '@/lib/utils';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/**
 * ScreenHeader — unified sticky header for secondary views.
 *
 * Props:
 *  - onBack:   required back handler; renders a 48-square back button
 *  - title:    required title string or node
 *  - subtitle: optional small copy shown below the title
 *  - actions:  optional right-aligned node (buttons, selects, etc.)
 *  - className: extra classes for the outer <header>
 *  - sticky:   default true; set false for in-flow (e.g. HelpPage)
 */
export default function ScreenHeader({
  onBack,
  title,
  subtitle,
  actions,
  className,
  sticky = true,
}) {
  return (
    <header
      className={cn(
        'z-10',
        sticky && 'sticky top-0 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border,var(--ds-gray-200))]',
        className,
      )}
      style={sticky ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : undefined}
    >
      <div className="flex items-center gap-3 px-3 sm:px-4 h-14">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-12 h-12 -ml-1 rounded-xl flex items-center justify-center text-[var(--text-1)] hover:bg-[var(--modes-surface,var(--ds-gray-alpha-100))] active:scale-95 transition-all cursor-pointer border-none bg-transparent"
          >
            <BackIcon />
          </button>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h1 className="text-heading-18 text-[var(--text-1)] m-0 leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-label-12 text-[var(--text-2)] m-0 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
