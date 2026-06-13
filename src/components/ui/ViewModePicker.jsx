import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Icons for each chart display mode.
const ChordsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 18V5l12-2v13" />
  </svg>
);
const LyricsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="14" y2="17" />
  </svg>
);
const TabsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" /><circle cx="8" cy="10" r="1.4" fill="currentColor" /><circle cx="15" cy="14" r="1.4" fill="currentColor" />
  </svg>
);
const MapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="4" width="7" height="6" rx="1" /><rect x="3" y="14" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" />
  </svg>
);

const ALL_MODES = [
  { id: 'chords', label: 'Chords', Icon: ChordsIcon },
  { id: 'lyrics', label: 'Lyrics', Icon: LyricsIcon },
  { id: 'tabs', label: 'Tabs', Icon: TabsIcon },
  { id: 'songmap', label: 'Song map', Icon: MapIcon },
];

// A single icon button that opens a compact popover to switch the chart display
// mode (Chords / Lyrics / Tabs / Song map) — replaces the old multi-button row.
// The popover is portalled so it never clips inside a sticky/blurred header.
export default function ViewModePicker({ value, onChange, hasTabs = true, size = 'sm' }) {
  const modes = ALL_MODES.filter(m => m.id !== 'tabs' || hasTabs);
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
  const CurrentIcon = current.Icon;

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
        <CurrentIcon />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="z-[80] min-w-[160px] rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1"
        >
          {modes.map(({ id, label, Icon }) => {
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
                <Icon />
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
