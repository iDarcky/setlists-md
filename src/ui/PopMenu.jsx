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
        // Auto-flip upward when there is more room above than below.
        //
        // ⚠ The flip used to be `spaceBelow < 280`, a fixed guess at how tall a
        // menu is, and a menu taller than that guess still ran off the bottom
        // whenever the space below merely EXCEEDED it. Measured on the owner's
        // 1418px-tall window: "+ Add section" sat with 353px below it, so the
        // menu opened downward — and eleven section types are ~473px, so the
        // last three were cut off the screen with no way to reach them (owner,
        // 2026-08-10: *"it gets out of the bounds of the screen"*, on both the
        // reader's menu and the song editor's, which is the same component).
        //
        // A guess cannot be right for a list whose length it does not know, so
        // the menu is CAPPED to the room it actually has instead. It scrolls
        // inside that cap, which is a menu you can always finish reading —
        // rather than one that fits until somebody adds a section type.
        const GAP = 8;
        const spaceBelow = window.innerHeight - r.bottom - GAP;
        const spaceAbove = r.top - GAP;
        const openUp = up || spaceAbove > spaceBelow;
        setCoords({
          left: align === 'right' ? null : r.left,
          right: align === 'right' ? window.innerWidth - r.right : null,
          top: openUp ? null : r.bottom + 4,
          bottom: openUp ? window.innerHeight - r.top + 4 : null,
          maxHeight: Math.max(120, openUp ? spaceAbove : spaceBelow),
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
            maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : undefined,
          }}
          className={`z-[80] min-w-[168px] overflow-y-auto rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1 ${menuClassName}`}
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
