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

import { Play, ArrowLeft, Plus, UserPlus, CalendarPlus, Check, ListPlus, Music, ListMusic } from 'lucide-react';
import WorkspaceSwitcher from './ui/WorkspaceSwitcher';
import { cn } from '../lib/utils';

export default function BottomNav({ activeView, rawView, onNavigate, activeLibrary, setActiveLibrary, team, showPersonalSpace, onPlay, goBack, onNewSong, onNewSetlist, onAddToSetlist, onInviteMember, onNewEvent }) {
  const [ripples, setRipples] = useState([]); // [{ id, tileId }]
  const nextRippleId = useRef(0);

  const activeId = tabs.some(t => t.id === activeView) ? activeView : 'home';

  const longPressTimer = useRef(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const longPressTriggered = useRef(false);

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setQuickAddOpen(true);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50); // haptic feedback
      }
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleFabClick = (e, action) => {
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (action) action(e);
  };

  const handleTileClick = (id) => {
    const rid = nextRippleId.current++;
    setRipples(rs => [...rs, { id: rid, tileId: id }]);
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== rid)), 600);
    onNavigate(id);
  };

  return (
    <>
      <div
        className="fixed left-0 right-0 z-[100] sm:hidden flex flex-col items-center pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
        }}
      >
        <div className="w-full px-4 flex items-center justify-between gap-3 pointer-events-auto max-w-[400px]">

          <nav
            className="flex-1 bg-[var(--ds-background-100)]/40 backdrop-blur-3xl backdrop-saturate-[180%] border border-[var(--ds-gray-200)]/30 shadow-[0_16px_40px_rgb(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(255,255,255,0.1)] rounded-full px-2"
          >
            <div className="flex justify-between items-center h-16">
              {tabs.map(({ id, label, Icon }) => {
                const active = id === activeId;
                const tileRipples = ripples.filter(r => r.tileId === id);
                return (
                  <button
                    key={id}
                    onClick={() => handleTileClick(id)}
                    className={`relative overflow-hidden flex flex-1 flex-col items-center justify-center gap-1 h-full rounded-full border-none cursor-pointer bg-transparent transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.85] ${
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

          <div className="relative shrink-0">
              <div
                className="bg-[var(--ds-background-100)]/40 backdrop-blur-3xl backdrop-saturate-[180%] border border-[var(--ds-gray-200)]/30 shadow-[0_16px_40px_rgb(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(255,255,255,0.1)] rounded-full w-16 h-16 flex items-center justify-center overflow-hidden transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.85] select-none cursor-pointer"
                onPointerDown={startLongPress}
                onPointerUp={endLongPress}
                onPointerLeave={endLongPress}
                onContextMenu={(e) => { e.preventDefault(); setQuickAddOpen(true); }}
              >
                {rawView === 'setlist-view' ? (
              <button
                onClick={(e) => handleFabClick(e, onPlay)}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] transition-transform border-none rounded-full"
                aria-label="Play Live"
              >
                <Play className="w-6 h-6 ml-1" fill="currentColor" />
              </button>
            ) : rawView === 'editor' ? (
              <button
                onClick={(e) => handleFabClick(e, goBack)}
                className="w-full h-full flex flex-col items-center justify-center bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] transition-transform border-none rounded-full"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : rawView === 'chart' ? (
              <button
                onClick={(e) => handleFabClick(e, onAddToSetlist)}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] transition-transform border-none rounded-full"
                aria-label="Add to Setlist"
              >
                <ListPlus className="w-6 h-6 ml-0.5" />
              </button>
            ) : rawView === 'team' ? (
              <button
                onClick={(e) => handleFabClick(e, onInviteMember)}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] transition-transform border-none rounded-full"
                aria-label="Invite Member"
              >
                <UserPlus className="w-6 h-6" />
              </button>
            ) : rawView === 'schedule' ? (
              <button
                onClick={(e) => handleFabClick(e, onNewEvent)}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] transition-transform border-none rounded-full"
                aria-label="New Event"
              >
                <CalendarPlus className="w-6 h-6" />
              </button>
            ) : rawView === 'setlist-build' ? (
              <button
                onClick={(e) => handleFabClick(e, goBack)}
                className="w-full h-full flex flex-col items-center justify-center bg-[var(--ds-teal-600)] text-white hover:bg-[var(--ds-teal-700)] transition-transform border-none rounded-full"
                aria-label="Done"
              >
                <Check className="w-6 h-6" />
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

              {quickAddOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[105]"
                    onClick={(e) => { e.stopPropagation(); setQuickAddOpen(false); }}
                    onTouchStart={(e) => { e.stopPropagation(); setQuickAddOpen(false); }}
                  />
                  <div className="absolute bottom-[80px] right-0 z-[110] min-w-[200px] overflow-hidden rounded-xl border border-[var(--ds-gray-200)] bg-[var(--ds-background-100)] p-1.5 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                    <div className="px-2 py-1.5 text-label-12 font-semibold text-[var(--ds-gray-500)] uppercase tracking-wider">
                      Quick Add
                    </div>
                    <button
                      onClick={() => { setQuickAddOpen(false); onNewSong?.(); }}
                      className="w-full relative flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2.5 text-label-14 text-[var(--ds-gray-700)] outline-none transition-colors hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)] border-none bg-transparent text-left"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ds-teal-100)] text-[var(--ds-teal-700)]">
                        <Music className="w-4 h-4" />
                      </div>
                      <span className="font-medium">New Song</span>
                    </button>
                    <button
                      onClick={() => { setQuickAddOpen(false); onNewSetlist?.(); }}
                      className="w-full relative flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-2.5 text-label-14 text-[var(--ds-gray-700)] outline-none transition-colors hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)] border-none bg-transparent text-left"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ds-teal-100)] text-[var(--ds-teal-700)]">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <span className="font-medium">New Setlist</span>
                    </button>
                  </div>
                </>
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
