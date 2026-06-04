import React, { useEffect, useRef, useState } from 'react';
import { useMediaQuery, useIsTablet } from '../lib/useMediaQuery';

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
const PlusIcon = ({ open = false }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const PlayIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 7 5.5Z" /></svg>
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
// Team only appears in the tablet bottom nav (on mobile it lives in the
// drawer). The tablet shell moves primary nav out of the top bar, so Team
// needs a home down here when the user has a team/church plan.
const TeamIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const BASE_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'setlists', label: 'Setlists' },
  { id: 'library', label: 'Songs' },
];

function tabIcon(id, active) {
  if (id === 'home') return <HomeIcon />;
  if (id === 'library') return <SongsIcon />;
  if (id === 'team') return <TeamIcon />;
  return active ? <SetlistsLogo /> : <SetlistsOutlineIcon />;
}

// iOS 26 "Liquid Glass": translucent fill, heavy blur+saturate, a specular
// top highlight and hairline edge, plus a soft drop shadow.
const GLASS = {
  background: 'color-mix(in srgb, var(--ds-background-200) 55%, transparent)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 12px 34px rgba(0,0,0,0.38)',
};

/**
 * Mobile shell footer (iOS 26 "liquid glass"): a floating translucent tab bar
 * (Home / Setlists / Songs) plus a separate morphing action button. The FAB is
 * a pure primary action — a create menu on Home, + on Songs/Setlists, and Play
 * on a setlist. Workspace switching lives in the top bar.
 */
export default function BottomNav({ activeView, onNavigate, onNewSong, onNewSetlist, onPlay, plan }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fabRef = useRef(null);

  // The bottom nav is the primary nav on mobile AND on touch tablets (the
  // tablet shell moves nav out of the top bar). Hidden on mouse-driven
  // desktops, where TopHeader owns the nav. `useIsTablet` is coarse-gated,
  // so desktop browsers at iPad widths never trip this.
  const isMobile = useMediaQuery('(max-width: 639.98px)');
  const isTablet = useIsTablet();

  const planLower = (plan || '').toLowerCase();
  const hasTeamPlan = planLower === 'team' || planLower === 'church';
  // Team gets a tab only on the tablet shell; mobile keeps it in the drawer.
  const tabs = (isTablet && hasTeamPlan)
    ? [...BASE_TABS, { id: 'team', label: 'Team' }]
    : BASE_TABS;

  const activeId = tabs.some(t => t.id === activeView)
    ? activeView
    : (activeView === 'setlist-view' ? 'setlists' : 'home');

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (fabRef.current && !fabRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Resolve the morphing FAB for the current view.
  let fab = null;
  if (activeView === 'home' && (onNewSong || onNewSetlist)) {
    fab = { kind: 'menu', label: 'Create', icon: <PlusIcon open={menuOpen} /> };
  } else if (activeView === 'library' && onNewSong) {
    fab = { kind: 'action', label: 'New song', onClick: onNewSong, icon: <PlusIcon /> };
  } else if (activeView === 'setlists' && onPlay) {
    // A setlist is selected in the tablet split pane — the prominent action is
    // to go live, not to create. (Creating still lives in the list header.)
    fab = { kind: 'action', label: 'Play live', onClick: onPlay, icon: <PlayIcon /> };
  } else if (activeView === 'setlists' && onNewSetlist) {
    fab = { kind: 'action', label: 'New setlist', onClick: onNewSetlist, icon: <PlusIcon /> };
  } else if (activeView === 'setlist-view' && onPlay) {
    fab = { kind: 'action', label: 'Play live', onClick: onPlay, icon: <PlayIcon /> };
  }

  // Only render where the bottom nav is the primary nav.
  if (!isMobile && !isTablet) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4"
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
          {fab.kind === 'menu' && menuOpen && (
            <div className="absolute bottom-full right-0 mb-3 w-52 rounded-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150" style={GLASS}>
              {onNewSong && (
                <button onClick={() => { setMenuOpen(false); onNewSong(); }} className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none text-left text-copy-15 text-[var(--ds-gray-1000)] cursor-pointer active:bg-white/10">
                  <SongMenuIcon /> New Song
                </button>
              )}
              {onNewSong && onNewSetlist && <div className="h-px bg-white/10" />}
              {onNewSetlist && (
                <button onClick={() => { setMenuOpen(false); onNewSetlist(); }} className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent border-none text-left text-copy-15 text-[var(--ds-gray-1000)] cursor-pointer active:bg-white/10">
                  <SetlistMenuIcon /> New Setlist
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => fab.kind === 'menu' ? setMenuOpen(o => !o) : fab.onClick()}
            aria-label={fab.label}
            className="w-[68px] h-[68px] rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-white/15 text-white"
            style={{
              WebkitTapHighlightColor: 'transparent',
              background: 'var(--color-brand)',
              boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
            }}
          >
            {fab.icon}
          </button>
        </div>
      )}
    </div>
  );
}
