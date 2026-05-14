import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DashboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const SetlistsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SongsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const tabs = [
  { id: 'home', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'setlists', label: 'Setlists', Icon: SetlistsIcon },
  { id: 'library', label: 'Songs', Icon: SongsIcon },
];

const INDICATOR_SIZE = 36;
const RIPPLE_SIZE = 64;

export default function BottomNav({ activeView, onNavigate }) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const iconRefs = useRef({});
  const [pill, setPill] = useState(null); // { x, y }
  const [mounted, setMounted] = useState(false);
  const [ripples, setRipples] = useState([]); // [{ id, tileId }]
  const nextRippleId = useRef(0);

  const activeId = tabs.some(t => t.id === activeView) ? activeView : 'home';

  const measurePill = () => {
    const grid = gridRef.current;
    const iconEl = iconRefs.current[activeId];
    if (!grid || !iconEl) return;
    const cRect = grid.getBoundingClientRect();
    const iRect = iconEl.getBoundingClientRect();
    const centerX = iRect.left - cRect.left + iRect.width / 2;
    const centerY = iRect.top - cRect.top + iRect.height / 2;
    setPill({ x: centerX - INDICATOR_SIZE / 2, y: centerY - INDICATOR_SIZE / 2 });
  };

  useLayoutEffect(() => {
    measurePill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useLayoutEffect(() => {
    window.addEventListener('resize', measurePill);
    return () => window.removeEventListener('resize', measurePill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleTileClick = (id) => {
    const rid = nextRippleId.current++;
    setRipples(rs => [...rs, { id: rid, tileId: id }]);
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== rid)), 600);
    onNavigate(id);
  };

  return (
    <>
      {/* Fade above the nav so scrolling content doesn't hard-cut at the edge */}
      <div
        aria-hidden="true"
        className="fixed left-0 right-0 z-[99] h-10 pointer-events-none sm:hidden"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
          background: 'linear-gradient(to top, var(--ds-background-100) 0%, transparent 100%)',
        }}
      />
      <nav
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 z-[100] sm:hidden"
        style={{
          background: 'var(--ds-background-100)',
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingTop: '10px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        }}
      >
        <div ref={gridRef} className="relative grid grid-cols-3 gap-2">
          {/* Circular active indicator — slides between icon centers */}
          {pill && (
            <span
              aria-hidden="true"
              className="absolute pointer-events-none rounded-full"
              style={{
                left: 0,
                top: 0,
                width: INDICATOR_SIZE,
                height: INDICATOR_SIZE,
                transform: `translate(${pill.x}px, ${pill.y}px)`,
                background: 'var(--ds-gray-100)',
                transition: mounted ? 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
              }}
            />
          )}

          {tabs.map(({ id, label, Icon }) => {
            const active = id === activeId;
            const tileRipples = ripples.filter(r => r.tileId === id);
            return (
              <button
                key={id}
                onClick={() => handleTileClick(id)}
                className={`relative z-[1] flex flex-col items-center justify-center gap-1 h-14 border-none cursor-pointer p-0 bg-transparent transition-[color,transform] duration-200 active:scale-[0.97] ${
                  active ? 'text-[var(--color-brand)]' : 'text-[var(--ds-gray-700)]'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span
                  ref={el => { iconRefs.current[id] = el; }}
                  className="relative flex items-center justify-center"
                  style={{ width: INDICATOR_SIZE, height: INDICATOR_SIZE }}
                >
                  {tileRipples.map(r => (
                    <span
                      key={r.id}
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                      style={{
                        width: RIPPLE_SIZE,
                        height: RIPPLE_SIZE,
                        marginLeft: -RIPPLE_SIZE / 2,
                        marginTop: -RIPPLE_SIZE / 2,
                        background: 'var(--color-brand)',
                        animation: 'nav-tile-ripple 550ms cubic-bezier(0.25, 0.8, 0.25, 1) forwards',
                      }}
                    />
                  ))}
                  <span className="relative"><Icon /></span>
                </span>
                <span className={`relative text-[11px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes nav-tile-ripple {
          0% { transform: scale(0); opacity: 0.38; }
          60% { opacity: 0.22; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </>
  );
}
