import { useEffect, useRef, useState } from 'react';

// The app's mobile bottom sheet. Extracted from the account panel so every
// sheet shares one set of mechanics — the same gradient surface, corner radius,
// entrance curve, drag-to-dismiss threshold and safe-area padding — instead of
// each screen re-deriving them and drifting apart.
//
// Drag handlers live on the grabber/header only: the body scrolls, and a
// drag-anywhere handler fights that scroll.

const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function SheetGroup({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-[var(--drawer-surface)] border border-[var(--drawer-border)] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function SheetGroupLabel({ children }) {
  return (
    <div className="text-label-11 uppercase tracking-[0.13em] text-[var(--drawer-text-dim)] mb-2 ml-1.5">
      {children}
    </div>
  );
}

// A row inside a SheetGroup. `first` drops the hairline above it.
export function SheetRow({ children, onClick, first = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3.5 py-3 bg-transparent cursor-pointer text-left transition-colors border-none ${
        disabled ? 'opacity-50' : 'active:bg-[var(--drawer-surface-hover)]'
      } ${first ? '' : 'border-t border-[var(--drawer-border)]'}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  );
}

export const SheetChevron = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--drawer-text-dim)] shrink-0">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title      Sheet header title.
 * @param {React.ReactNode} [props.headerExtra]  Rendered under the title row, inside the sticky header.
 * @param {React.ReactNode} props.children
 */
export default function MobileSheet({ open, onClose, title, headerExtra, children, ...rest }) {
  const panelRef = useRef(null);
  const startYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Callers mount the sheet already open, so the first paint has to happen at
  // translateY(100%) for the entrance to animate at all.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const shown = open && entered;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    // Only downward drags close the sheet; upward is a no-op, not a stretch.
    setDragY(Math.max(0, e.touches[0].clientY - startYRef.current));
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const past = dragY > (panelRef.current?.offsetHeight || 480) * 0.25;
    setDragY(0);
    if (past) onClose();
  };
  const dragBind = { onTouchStart, onTouchMove, onTouchEnd };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[200] transition-opacity duration-300 ${
          shown ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-panel fixed left-0 right-0 bottom-0 z-[210] w-full max-h-[88vh] flex flex-col overflow-y-auto overscroll-contain rounded-t-[22px]"
        style={{
          transform: `translateY(${shown ? (dragging ? `${dragY}px` : '0px') : '100%'})`,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
        }}
        {...rest}
      >
        <div className="px-4 flex flex-col min-h-0">
          <div
            {...dragBind}
            className="-mx-4 px-4 pt-2.5 pb-3 sticky top-0 z-10 backdrop-blur-md"
          >
            <div className="w-9 h-1 rounded-full bg-[var(--drawer-text-dim)] opacity-50 mx-auto mb-3" aria-hidden="true" />
            <div className="flex items-center justify-between px-1">
              <h2 className="text-heading-16 font-semibold text-[var(--drawer-text)] m-0">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 min-h-0 rounded-full flex items-center justify-center bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)] cursor-pointer border-none active:scale-95 transition-transform"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <CloseIcon />
              </button>
            </div>
            {headerExtra}
          </div>
          {children}
        </div>
      </aside>
    </>
  );
}
