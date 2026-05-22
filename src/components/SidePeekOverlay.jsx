import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

export default function SidePeekOverlay({
  open,
  onClose,
  onOpenFull,
  children,
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity animate-[fadeIn_200ms_ease-out]" 
        onClick={onClose}
      />
      
      {/* Slide-in Panel */}
      <div 
        ref={overlayRef}
        className="relative w-full max-w-2xl h-full bg-[var(--ds-background-100)] shadow-2xl flex flex-col animate-[slideInRight_250ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--ds-gray-200)] shrink-0 bg-[var(--ds-background-100)]">
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-transparent border-none text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-800)] hover:bg-[var(--ds-gray-200)] transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
