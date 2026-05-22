import React, { useState, useRef, useEffect } from 'react';
import NotificationTray from './NotificationTray';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/useAuth';



const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function DesktopTopBar({ 
  activeView, 
  onNavigate, 
  hasUnreadNotifications, 
  notifications, 
  onMarkRead, 
  onNotificationAction, 
  displayName = 'Guest', 
  activeLibrary, 
  setActiveLibrary, 
  team
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef(null);

  const { user } = useAuth();

  useEffect(() => {
    const handler = (e) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'setlists', label: 'Setlists' },
    { id: 'library', label: 'Library' },
  ];

  const activeWorkspaceName = activeLibrary === 'personal' ? 'Personal Workspace' : team?.name || 'Workspace';

  return (
    <>
      <header className="hidden sm:flex items-center justify-between h-14 px-4 bg-[var(--ds-background-200)] border-b border-[var(--ds-gray-200)] shrink-0 select-none">
        {/* Left: Navigation Tabs */}
        <nav className="flex items-center gap-1 flex-1 h-full pt-1">
          {tabs.map(({ id, label }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={cn(
                  "h-full px-4 flex items-center justify-center text-label-14 font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] relative border-t-2 bg-transparent",
                  active 
                    ? "text-[var(--ds-gray-1000)] border-[var(--color-brand)]" 
                    : "text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] border-transparent"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Center: Workspace Switcher */}
        <div className="flex-1 flex justify-center">
          <div className="relative" ref={workspaceRef}>
            <button
              onClick={() => setWorkspaceOpen(!workspaceOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent border-none cursor-pointer hover:bg-[var(--ds-gray-200)] transition-colors focus:outline-none"
            >
              <div className="w-5 h-5 rounded flex items-center justify-center bg-[var(--ds-gray-300)] text-[var(--ds-gray-700)]">
                {activeLibrary === 'personal' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                ) : (
                  <span className="text-[10px] font-bold">{team?.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="text-label-14 font-medium text-[var(--ds-gray-1000)]">{activeWorkspaceName}</span>
              <span className="text-[var(--ds-gray-500)]"><ChevronDownIcon /></span>
            </button>

            {workspaceOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] shadow-lg py-1 z-50">
                <div className="px-3 py-2 text-label-12 text-[var(--ds-gray-500)] uppercase tracking-wider font-semibold">
                  {user?.email || 'Workspaces'}
                </div>
                <button
                  onClick={() => { setActiveLibrary('personal'); setWorkspaceOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left border-none cursor-pointer text-copy-14 transition-colors",
                    activeLibrary === 'personal' ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] font-medium" : "bg-transparent text-[var(--ds-gray-800)] hover:bg-[var(--ds-gray-100)]"
                  )}
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                  Personal Workspace
                </button>
                {team && (
                  <button
                    onClick={() => { setActiveLibrary(team.id); setWorkspaceOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left border-none cursor-pointer text-copy-14 transition-colors",
                      activeLibrary === team.id ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] font-medium" : "bg-transparent text-[var(--ds-gray-800)] hover:bg-[var(--ds-gray-100)]"
                    )}
                  >
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]">
                      <span className="text-[12px] font-bold">{team.name.charAt(0).toUpperCase()}</span>
                    </div>
                    {team.name}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex-1 flex items-center justify-end gap-1">


          <button
            onClick={() => setTrayOpen(true)}
            aria-label="Notifications"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--ds-gray-700)] bg-transparent hover:bg-[var(--ds-gray-200)] border-none cursor-pointer transition-colors relative"
          >
            <BellIcon />
            {hasUnreadNotifications && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--ds-red-600)]" />
            )}
          </button>

          <button
            onClick={() => onNavigate('settings')}
            aria-label="Preferences"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--ds-gray-700)] bg-transparent hover:bg-[var(--ds-gray-200)] border-none cursor-pointer transition-colors mr-2"
          >
            <SettingsIcon />
          </button>

          <button
            onClick={() => onNavigate('account')}
            aria-label="Account"
            className="w-7 h-7 rounded-full bg-[var(--ds-gray-300)] flex items-center justify-center text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-400)] transition-colors border-none cursor-pointer"
          >
            <span className="text-label-12 font-bold">{displayName.charAt(0).toUpperCase()}</span>
          </button>
        </div>
      </header>

      {/* Notification Tray Modal */}
      <NotificationTray
        open={trayOpen}
        onClose={() => setTrayOpen(false)}
        notifications={notifications || []}
        onMarkRead={onMarkRead}
        onAction={(action) => {
          onNotificationAction?.(action);
          setTrayOpen(false);
        }}
      />
    </>
  );
}
