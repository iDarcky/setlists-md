import React, { useEffect, useRef, useState } from 'react';

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
// Setlists: white outline of the mark when inactive, full colored logo when active.
const SetlistsOutlineIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <line x1="7" y1="9" x2="17" y2="9" />
    <line x1="7" y1="13" x2="15" y2="13" />
    <line x1="7" y1="17" x2="13" y2="17" />
  </svg>
);
const SetlistsLogo = () => (
  <img src="/setlists-md-mark.svg" alt="" width="24" height="24" className="rounded-[6px]" draggable="false" />
);
const SongsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);

function tabIcon(id, active) {
  if (id === 'home') return <HomeIcon />;
  if (id === 'library') return <SongsIcon />;
  // setlists
  return active ? <SetlistsLogo /> : <SetlistsOutlineIcon />;
}
const PlusIcon = ({ open = false }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const PlayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 7 5.5Z" /></svg>
);
const SwapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" /><path d="M3 6h18" /><path d="m7 22-4-4 4-4" /><path d="M21 18H3" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const TeamGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'setlists', label: 'Setlists' },
  { id: 'library', label: 'Songs' },
];

// iOS 26 "Liquid Glass": translucent fill, heavy blur+saturate, a specular
// top highlight and hairline edge, plus a soft drop shadow.
const GLASS = {
  background: 'color-mix(in srgb, var(--ds-background-200) 55%, transparent)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 12px 34px rgba(0,0,0,0.38)',
};

export default function BottomNav({
  activeView,
  onNavigate,
  onNewSong,
  onNewSetlist,
  onPlay,
  activeLibrary = 'personal',
  workspaces = [],
  setActiveLibrary,
}) {
  const [menuOpen, setMenuOpen] = useState(null); // 'create' | 'workspace' | null
  const fabRef = useRef(null);

  const activeId = tabs.some(t => t.id === activeView)
    ? activeView
    : (activeView === 'setlist-view' ? 'setlists' : 'home');

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (fabRef.current && !fabRef.current.contains(e.target)) setMenuOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(null); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const activeWorkspace = workspaces.find(w => w.id === activeLibrary) || workspaces[0] || { id: 'personal', name: 'Personal' };

  // Resolve the morphing FAB for the current view.
  let fab = null;
  if (activeView === 'home') {
    fab = { kind: 'workspace', label: 'Switch workspace' };
  } else if (activeView === 'library' && onNewSong) {
    fab = { kind: 'action', accent: true, label: 'New song', onClick: onNewSong, icon: <PlusIcon /> };
  } else if (activeView === 'setlists' && onNewSetlist) {
    fab = { kind: 'action', accent: true, label: 'New setlist', onClick: onNewSetlist, icon: <PlusIcon /> };
  } else if (activeView === 'setlist-view' && onPlay) {
    fab = { kind: 'action', accent: true, label: 'Play live', onClick: onPlay, icon: <PlayIcon /> };
  }

  const onFabClick = () => {
    if (!fab) return;
    if (fab.kind === 'workspace') setMenuOpen(m => (m === 'workspace' ? null : 'workspace'));
    else fab.onClick();
  };

  const initial = (activeWorkspace?.name || 'P').trim().charAt(0).toUpperCase();

  return (
    <div
      className="fixed left-0 right-0 z-[100] sm:hidden flex items-center justify-center gap-3 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
    >
      {/* Glass tab bar */}
      <nav className="flex items-stretch gap-1 p-2 rounded-full border border-white/10" style={GLASS}>
        {tabs.map(({ id, label }) => {
          const active = id === activeId;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 w-[84px] h-[62px] rounded-full border-none cursor-pointer transition-all duration-200 active:scale-[0.95] ${
                active ? 'text-[var(--color-brand)]' : 'text-[var(--ds-gray-700)] bg-transparent'
              }`}
              style={{
                WebkitTapHighlightColor: 'transparent',
                background: active ? 'rgba(255,255,255,0.16)' : undefined,
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.25)' : undefined,
              }}
            >
              {tabIcon(id, active)}
              <span className={`text-[11px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Separate glass circle — morphing FAB, on the same level as the bar */}
      {fab && (
        <div ref={fabRef} className="relative shrink-0">
          {/* Workspace switcher menu */}
          {menuOpen === 'workspace' && (
            <div className="absolute bottom-full right-0 mb-3 w-60 rounded-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150 py-1" style={GLASS}>
              {workspaces.map(w => {
                const isActive = w.id === activeWorkspace?.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => { setMenuOpen(null); setActiveLibrary?.(w.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none text-left cursor-pointer active:bg-white/10"
                  >
                    <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden text-[var(--ds-gray-1000)]">
                      {w.avatarUrl
                        ? <img src={w.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : w.id === 'personal'
                          ? <span className="text-label-13 font-bold">{(w.name || 'P').charAt(0)}</span>
                          : <TeamGlyph />}
                    </span>
                    <span className="flex-1 text-copy-15 text-[var(--ds-gray-1000)] truncate">{w.name}</span>
                    {isActive && <span className="text-[var(--color-brand)] shrink-0"><CheckIcon /></span>}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={onFabClick}
            aria-label={fab.label}
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform border overflow-hidden"
            style={{
              WebkitTapHighlightColor: 'transparent',
              ...(fab.accent
                ? { background: 'var(--color-brand)', color: '#fff', borderColor: 'rgba(255,255,255,0.18)', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' }
                : { ...GLASS, borderColor: 'rgba(255,255,255,0.12)', color: 'var(--ds-gray-1000)' }),
            }}
          >
            {fab.kind === 'workspace'
              ? (activeWorkspace?.avatarUrl
                  ? <img src={activeWorkspace.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : activeWorkspace?.id === 'personal'
                    ? <span className="text-label-18 font-bold leading-none">{initial}</span>
                    : <SwapIcon />)
              : fab.icon}
          </button>
        </div>
      )}
    </div>
  );
}
