import React, { useRef, useState } from 'react';

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

const RIPPLE_SIZE = 64;

export default function BottomNav({ activeView, onNavigate }) {
  const [ripples, setRipples] = useState([]); // [{ id, tileId }]
  const nextRippleId = useRef(0);

  const activeId = tabs.some(t => t.id === activeView) ? activeView : 'home';

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
        className="fixed bottom-0 left-0 right-0 z-[100] sm:hidden"
        style={{
          background: 'var(--ds-background-100)',
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingTop: '10px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ id, label, Icon }) => {
            const active = id === activeId;
            const tileRipples = ripples.filter(r => r.tileId === id);
            return (
              <button
                key={id}
                onClick={() => handleTileClick(id)}
                className={`relative overflow-hidden flex flex-col items-center justify-center gap-1 h-14 border-none cursor-pointer p-0 bg-transparent transition-[color,transform] duration-200 active:scale-[0.97] ${
                  active ? 'text-[var(--color-brand)]' : 'text-[var(--ds-gray-700)]'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
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
