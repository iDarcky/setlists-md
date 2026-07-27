import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { VIEW_MODES } from './viewModes';

// One generic "view" icon for the trigger — the menu is text-only, so we no
// longer carry a per-mode icon (§6: single generic icon + text-only menu).
const ViewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

// A single icon button that opens a compact popover to switch the chart display
// mode (Chords / Chords only / Lyrics / Tabs / Song map). The popover is
// portalled so it never clips inside a sticky/blurred header.
export default function ViewModePicker({ value, onChange, hasTabs = true, size = 'sm' }) {
  const modes = VIEW_MODES.filter(m => m.id !== 'tabs' || hasTabs);
  const current = modes.find(m => m.id === value) || modes[0];
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = useCallback(() => {
    setOpen((was) => {
      if (was) return false;
      const el = triggerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right });
      }
      return true;
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const inside = (t) => triggerRef.current?.contains(t) || menuRef.current?.contains(t);
    const onPointer = (e) => { if (!inside(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
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

  const btnSize = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';

  return (
    <div ref={triggerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-label={`View: ${current.label}`}
        title={`View: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center justify-center ${btnSize} rounded-lg cursor-pointer border-none bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors`}
      >
        <ViewIcon />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-[80] min-w-[160px] rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1"
        >
          {modes.map(({ id, label }) => {
            const active = id === value;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { onChange(id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-copy-13 cursor-pointer bg-transparent border-none transition-colors ${
                  active ? 'text-[var(--color-brand)] font-semibold' : 'text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-alpha-100)]'
                }`}
              >
                <span className="flex-1">{label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
