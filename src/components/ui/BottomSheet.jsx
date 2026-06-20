import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Reusable bottom-sheet modal with drag-to-dismiss and a backdrop tap to
// close. Lives outside ChartView so the Layout sheet can be reused by
// PracticeView / PerformanceView without duplicating the gesture and
// keyboard handling.

export default function BottomSheet({ open, onClose, title, children }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

  // When the sheet reopens, reset any leftover drag offset from the previous
  // close — otherwise dragging it down past the threshold leaves dragY > 120
  // baked into state and the next open renders translated halfway down the
  // screen.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDragY(0);
      setDragging(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    const dy = e.touches[0].clientY - startYRef.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragY > 120) {
      onClose?.();
    } else {
      setDragY(0);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-150"
    >
      <div
        className="absolute inset-0 bg-black/20"
        onClick={() => onClose?.()}
      />
      <div
        className="relative w-full sm:max-w-[640px] bg-[var(--ds-background-100)] border-t border-x border-[var(--ds-gray-400)] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-200 flex flex-col"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="pt-2 pb-3 px-5 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="flex justify-center pb-2">
            <span className="block w-10 h-1 rounded-full bg-[var(--ds-gray-400)]" aria-hidden="true" />
          </div>
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">{title}</h2>
        </div>
        <div className="px-5 pb-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SheetField({ label, children, className }) {
  return (
    <div className={`flex flex-col gap-1.5${className ? ` ${className}` : ''}`}>
      <span className="text-label-12 font-semibold text-[var(--text-2)]">{label}</span>
      {children}
    </div>
  );
}
