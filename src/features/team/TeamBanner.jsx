import React from 'react';
import { cn } from '@/lib/utils';

/**
 * A strip bar shown at the top of the screen when viewing a team workspace.
 * Minimalist, high-contrast aesthetic that matches the app's metadata style.
 */
export default function TeamBanner({ teamName, onChangeWorkspace, className }) {
  if (!teamName) return null;

  return (
    <div 
      className={cn(
        "w-full px-4 py-1.5 flex items-center justify-center animate-in fade-in slide-in-from-top duration-300",
        className
      )}
      style={{
        zIndex: 100,
        backgroundColor: 'var(--color-brand-soft)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: 'var(--color-brand-text)',
        borderBottom: '1px solid var(--color-brand-border)',
      }}
    >
      <div className="flex items-center gap-3 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 truncate">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.1em] opacity-70 whitespace-nowrap font-bold">
            Viewing
          </span>
          <span className="text-label-12 sm:text-label-13 font-bold truncate">
            {teamName}
          </span>
        </div>
        
        {/* Subtle vertical divider */}
        <div className="w-px h-3 bg-current opacity-20 shrink-0" />

        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChangeWorkspace?.();
          }}
          className="bg-transparent hover:opacity-60 active:scale-95 px-1 py-0.5 rounded-md text-label-11 transition-all border-none cursor-pointer text-current font-bold underline underline-offset-4 decoration-2 decoration-current/30 hover:decoration-current"
        >
          Change
        </button>
      </div>
    </div>
  );
}
