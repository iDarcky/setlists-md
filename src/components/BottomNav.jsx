import React, { useRef, useState } from 'react';
import WorkspaceSwitcher from './ui/WorkspaceSwitcher';
import { cn } from '../lib/utils';

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

import { Play, ArrowLeft } from 'lucide-react';

export default function BottomNav({ activeView, rawView, onNavigate, activeLibrary, setActiveLibrary, team, showPersonalSpace, onPlay, goBack }) {
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
      {/*
        Dynamic Island Floating Navigation Container
        We keep the z-index high enough so it sits above content.
      */}
      <div
        className="fixed left-0 right-0 z-[100] sm:hidden flex flex-col items-center pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
        }}
      >
        <div className="w-full px-4 flex items-center justify-between gap-3 pointer-events-auto max-w-[400px]">

          {/*
            Left Side: The Floating Navigation Pill
          */}
          <nav
            className="flex-1 bg-[var(--ds-background-100)]/90 backdrop-blur-xl border border-[var(--ds-gray-200)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-2"
          >
            <div className="flex justify-between items-center h-16">
              {tabs.map(({ id, label, Icon }) => {
                const active = id === activeId;
                const tileRipples = ripples.filter(r => r.tileId === id);
                return (
                  <button
                    key={id}
                    onClick={() => handleTileClick(id)}
                    className={`relative overflow-hidden flex flex-1 flex-col items-center justify-center gap-1 h-full rounded-full border-none cursor-pointer bg-transparent transition-[color,transform] duration-200 active:scale-[0.95] ${
                      active ? 'text-[var(--ds-teal-700)]' : 'text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-900)]'
                    }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    aria-label={label}
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
                    <div className={cn("relative p-2 rounded-full transition-colors", active && "bg-[var(--ds-teal-100)]")}>
                      <Icon />
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

                    {/*
            Right Side: Smart FAB (Transforms based on context)
          */}
          <div className="shrink-0 bg-[var(--ds-background-100)]/90 backdrop-blur-xl border border-[var(--ds-gray-200)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full w-16 h-16 flex items-center justify-center overflow-hidden transition-all duration-300">
            {rawView === 'setlist-view' ? (
              <button
                onClick={onPlay}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] active:scale-95 transition-transform border-none rounded-full"
                aria-label="Play Live"
              >
                <Play className="w-6 h-6 ml-1" fill="currentColor" />
              </button>
            ) : rawView === 'editor' ? (
              <button
                onClick={goBack}
                className="w-full h-full flex flex-col items-center justify-center bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] active:scale-95 transition-transform border-none rounded-full"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <WorkspaceSwitcher
                activeLibrary={activeLibrary}
                setActiveLibrary={setActiveLibrary}
                team={team}
                showPersonalSpace={showPersonalSpace}
                isMobileFloater={true}
                className="bg-transparent hover:bg-[var(--ds-gray-200)] !w-full !h-full rounded-full p-0 flex items-center justify-center focus-visible:ring-0"
              />
            )}
          </div>

        </div>
      </div>

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
