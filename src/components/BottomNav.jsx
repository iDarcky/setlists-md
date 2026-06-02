import React, { useEffect, useRef, useState } from 'react';

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
const SetlistsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const SongsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);
const PlusIcon = ({ open = false }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 7 5.5Z" /></svg>
);
const SongMenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);
const SetlistMenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const tabs = [
  { id: 'home', label: 'Home', icon: <DashboardIcon /> },
  { id: 'setlists', label: 'Setlists', icon: <SetlistsIcon /> },
  { id: 'library', label: 'Songs', icon: <SongsIcon /> },
];

const GLASS = {
  background: 'color-mix(in srgb, var(--ds-background-200) 70%, transparent)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
};

/**
 * Mobile shell footer (iOS 26 "liquid glass"): a floating translucent tab bar
 * (Home / Setlists / Songs) plus a separate morphing action button whose
 * action changes per view — new song, new setlist, or Play Live.
 */
export default function BottomNav({ activeView, onNavigate, onNewSong, onNewSetlist, onPlay }) {
  const [addOpen, setAddOpen] = useState(false);
  const fabRef = useRef(null);

  const activeId = tabs.some(t => t.id === activeView)
    ? activeView
    : (activeView === 'setlist-view' ? 'setlists' : 'home');

  useEffect(() => {
    if (!addOpen) return;
    const handler = (e) => { if (fabRef.current && !fabRef.current.contains(e.target)) setAddOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setAddOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey); };
  }, [addOpen]);

  // Resolve the morphing FAB for the current view.
  let fab = null;
  if (activeView === 'library' && onNewSong) {
    fab = { kind: 'action', label: 'New song', onClick: onNewSong, icon: <PlusIcon /> };
  } else if (activeView === 'setlists' && onNewSetlist) {
    fab = { kind: 'action', label: 'New setlist', onClick: onNewSetlist, icon: <PlusIcon /> };
  } else if (activeView === 'home' && (onNewSong || onNewSetlist)) {
    fab = { kind: 'menu', label: 'Create', icon: <PlusIcon open={addOpen} /> };
  } else if (activeView === 'setlist-view' && onPlay) {
    fab = { kind: 'action', label: 'Play live', onClick: onPlay, icon: <PlayIcon /> };
  }

  const fabBottom = 'calc(env(safe-area-inset-bottom, 0px) + 92px)';

  return (
    <>
      {/* Morphing FAB */}
      {fab && (
        <div ref={fabRef} className="fixed right-5 z-[101] sm:hidden" style={{ bottom: fabBottom }}>
          {fab.kind === 'menu' && addOpen && (
            <div className="absolute bottom-full right-0 mb-3 w-52 rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150" style={GLASS}>
              {onNewSong && (
                <button onClick={() => { setAddOpen(false); onNewSong(); }} className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none text-left text-copy-15 text-[var(--ds-gray-1000)] cursor-pointer active:bg-white/10">
                  <SongMenuIcon /> New Song
                </button>
              )}
              {onNewSong && onNewSetlist && <div className="h-px bg-white/10" />}
              {onNewSetlist && (
                <button onClick={() => { setAddOpen(false); onNewSetlist(); }} className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none text-left text-copy-15 text-[var(--ds-gray-1000)] cursor-pointer active:bg-white/10">
                  <SetlistMenuIcon /> New Setlist
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => fab.kind === 'menu' ? setAddOpen(o => !o) : fab.onClick()}
            aria-label={fab.label}
            className="w-[60px] h-[60px] rounded-full bg-[var(--color-brand)] text-white shadow-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-white/15"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {fab.icon}
          </button>
        </div>
      )}

      {/* Floating glass tab bar */}
      <div
        className="fixed left-0 right-0 z-[100] sm:hidden flex justify-center px-5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
      >
        <nav
          className="flex items-stretch gap-1 p-1.5 rounded-[24px] border border-white/10 shadow-2xl"
          style={GLASS}
        >
          {tabs.map(({ id, label, icon }) => {
            const active = id === activeId;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 w-[76px] h-14 rounded-[18px] border-none cursor-pointer transition-all duration-200 active:scale-[0.95] ${
                  active ? 'bg-[var(--color-brand)] text-white' : 'bg-transparent text-[var(--ds-gray-700)]'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {icon}
                <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
