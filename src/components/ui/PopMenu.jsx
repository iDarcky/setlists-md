import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Portaled dropdown. Lives here rather than inside the chart canvas because the
// paste review needs the same menu, and a menu that renders `absolute` inside a
// scroll container gets clipped — this one is fixed-positioned into <body> and
// flips upward when there isn't room below.

function PopMenu({ trigger, align = 'right', up = false, menuClassName = '', children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Measure the trigger and open. Coords are computed at toggle time (not in an
  // effect) so the fixed-positioned portal lands without a cascading render.
  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (wasOpen) return false;
      const el = triggerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        // Auto-flip upward when there isn't room below (near the bottom of the
        // screen the menu would otherwise spill off / get clipped — the exact
        // problem with "+ Add section" and the type picker on a phone).
        const spaceBelow = window.innerHeight - r.bottom;
        const openUp = up || (spaceBelow < 280 && r.top > spaceBelow);
        setCoords({
          left: align === 'right' ? null : r.left,
          right: align === 'right' ? window.innerWidth - r.right : null,
          top: openUp ? null : r.bottom + 4,
          bottom: openUp ? window.innerHeight - r.top + 4 : null,
        });
      }
      return true;
    });
  }, [align, up]);

  useEffect(() => {
    if (!open) return;
    const inside = (t) => triggerRef.current?.contains(t) || menuRef.current?.contains(t);
    const onPointer = (e) => { if (!inside(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // Close when an ancestor scrolls (the menu is fixed, so it would detach).
    // Ignore scrolling inside the menu's own overflow.
    const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative inline-block">
      <span onClick={toggle}>{trigger}</span>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            left: coords.left != null ? coords.left : undefined,
            right: coords.right != null ? coords.right : undefined,
            top: coords.top != null ? coords.top : undefined,
            bottom: coords.bottom != null ? coords.bottom : undefined,
          }}
          className={`z-[80] min-w-[180px] max-h-[60vh] overflow-y-auto rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1 ${menuClassName}`}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default PopMenu;

function MenuItem({ onClick, children, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left px-3 py-2.5 text-copy-13 cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)] ${danger ? 'text-[var(--ds-red-700)] font-semibold' : 'text-[var(--ds-gray-1000)]'}`}>
      {children}
    </button>
  );
}

export { MenuItem };
