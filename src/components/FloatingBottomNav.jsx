import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/useAuth';

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const SetlistsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SongsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);



const tabs = [
  { id: 'home', label: 'Home', Icon: DashboardIcon },
  { id: 'setlists', label: 'Setlists', Icon: SetlistsIcon },
  { id: 'library', label: 'Library', Icon: SongsIcon },
];

export default function FloatingBottomNav({ 
  activeView, 
  onNavigate,
  activeLibrary,
  setActiveLibrary,
  team,
  onStartLive,
  onAddToSetlist
}) {
  const { user } = useAuth();
  const activeId = tabs.some(t => t.id === activeView) ? activeView : 'home';
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getActionConfig = () => {
    if (activeView === 'setlist-view') {
      return { icon: <PlayIcon />, onClick: onStartLive, ariaLabel: 'Start Live' };
    }
    if (activeView === 'editor') {
      return { icon: <PlusIcon />, onClick: onAddToSetlist, ariaLabel: 'Add to Setlist' };
    }
    // Default: Workspace changer
    const icon = activeLibrary === 'personal' ? (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    ) : (
      <span className="text-[14px] font-bold">{team?.name?.charAt(0).toUpperCase()}</span>
    );
    return { 
      icon, 
      onClick: () => setWorkspaceOpen(!workspaceOpen), 
      ariaLabel: 'Switch Workspace' 
    };
  };

  const actionConfig = getActionConfig();

  return (
    <div
      className="fixed left-0 right-0 z-[100] sm:hidden flex items-end justify-center pointer-events-none"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-center gap-3 pointer-events-auto">


        {/* Floating Pill */}
        <nav
          className="flex items-center h-16 rounded-full border border-[var(--ds-gray-300)] shadow-xl overflow-hidden px-2"
          style={{
            background: 'var(--header-bg-blur)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {tabs.map(({ id, label, Icon }) => {
            const active = id === activeId;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="relative flex flex-col items-center justify-center w-16 h-full gap-0.5 border-none bg-transparent transition-colors active:scale-95"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={cn(
                  "flex items-center justify-center transition-colors",
                  active ? "text-[var(--color-brand)]" : "text-[var(--ds-gray-600)]"
                )}>
                  <Icon />
                </div>
                <span className={cn(
                  "text-[10px] tracking-wide transition-colors",
                  active ? "text-[var(--color-brand)] font-semibold" : "text-[var(--ds-gray-500)] font-medium"
                )}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Dynamic Action Button */}
        <div className="relative" ref={workspaceRef}>
          <button
            onClick={actionConfig.onClick}
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl border border-[var(--ds-gray-300)] transition-transform active:scale-95"
            style={{
              background: 'var(--header-bg-blur)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--color-brand)',
            }}
            aria-label={actionConfig.ariaLabel}
          >
            {actionConfig.icon}
          </button>

          {workspaceOpen && (
            <div className="absolute bottom-full right-0 mb-3 w-56 rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] shadow-2xl py-2 z-[110] animate-[slideUp_150ms_ease-out]">
              <div className="px-4 py-2 text-label-12 text-[var(--ds-gray-500)] uppercase tracking-wider font-semibold">
                {user?.email || 'Workspaces'}
              </div>
              <button
                onClick={() => { setActiveLibrary('personal'); setWorkspaceOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left border-none cursor-pointer text-copy-15 transition-colors",
                  activeLibrary === 'personal' ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] font-medium" : "bg-transparent text-[var(--ds-gray-800)] active:bg-[var(--ds-gray-100)]"
                )}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                Personal Workspace
              </button>
              {team && (
                <button
                  onClick={() => { setActiveLibrary(team.id); setWorkspaceOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left border-none cursor-pointer text-copy-15 transition-colors",
                    activeLibrary === team.id ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] font-medium" : "bg-transparent text-[var(--ds-gray-800)] active:bg-[var(--ds-gray-100)]"
                  )}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]">
                    <span className="text-[14px] font-bold">{team.name.charAt(0).toUpperCase()}</span>
                  </div>
                  {team.name}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
