import React, { useRef, useState, useEffect } from 'react';
import TeamBanner from './TeamBanner';

const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const PlusIcon = ({ open = false }) => (
  <svg
    width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function MobileTopBar({
  view,
  onOpenDrawer,
  onNewSong,
  onNewSetlist,
  activeLibrary,
  team,
  onChangeWorkspace
}) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePlus = () => {
    if (view === 'library') {
      onNewSong?.();
    } else if (view === 'setlists') {
      onNewSetlist?.();
    } else {
      setAddOpen(o => !o);
    }
  };

  const showBanner = activeLibrary !== 'personal' && team;
  
  const getTitle = () => {
    if (view === 'library') return 'Library';
    if (view === 'setlists') return 'Setlists';
    if (view === 'home') return 'Home';
    return '';
  };

  return (
    <div
      className="sm:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        backgroundColor: 'var(--ds-background-100)',
      }}
    >
      {showBanner && (
        <TeamBanner 
          teamName={team.name} 
          onChangeWorkspace={onChangeWorkspace}
        />
      )}
      <div className="flex items-center justify-between px-2 h-14 border-b border-[var(--ds-gray-200)]">
        <button
          onClick={onOpenDrawer}
          aria-label="Menu"
          className="w-10 h-10 flex items-center justify-center bg-transparent border-none text-[var(--ds-gray-800)] cursor-pointer active:bg-[var(--ds-gray-200)] rounded-full transition-colors"
        >
          <HamburgerIcon />
        </button>

        <h1 className="text-copy-16 font-semibold text-[var(--ds-gray-1000)] m-0 truncate">
          {getTitle()}
        </h1>

        <div ref={addRef} className="relative w-10 h-10 flex items-center justify-center">
          {(onNewSong || onNewSetlist) && (
            <button
              onClick={handlePlus}
              aria-label="New"
              className="w-10 h-10 flex items-center justify-center bg-transparent border-none text-[var(--ds-gray-800)] cursor-pointer active:bg-[var(--ds-gray-200)] rounded-full transition-colors"
            >
              <PlusIcon open={addOpen} />
            </button>
          )}

          {addOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)] shadow-xl overflow-hidden z-50 animate-[fadeIn_120ms_ease-out]">
              {onNewSong && (
                <button
                  onClick={() => { setAddOpen(false); onNewSong?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left text-copy-14 text-[var(--text-1)] cursor-pointer hover:bg-[var(--bg-2)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  New Song
                </button>
              )}
              {onNewSong && onNewSetlist && <div className="h-px bg-[var(--border-1)]" />}
              {onNewSetlist && (
                <button
                  onClick={() => { setAddOpen(false); onNewSetlist?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left text-copy-14 text-[var(--text-1)] cursor-pointer hover:bg-[var(--bg-2)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  New Setlist
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
