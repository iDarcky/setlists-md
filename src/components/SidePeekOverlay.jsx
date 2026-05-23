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
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
