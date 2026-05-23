import React, { useState } from 'react';
import { cn } from '../lib/utils';
import WorkspaceSwitcher from './ui/WorkspaceSwitcher';
import NotificationTray from './NotificationTray';

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const LibraryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const SetlistsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const SearchIconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const TeamNavIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const navButtonClass = (active) =>
  `group flex items-center justify-center gap-2 h-10 px-3 rounded-lg cursor-pointer transition-colors duration-200 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] ${
    active
      ? 'bg-[var(--ds-background-200)] text-[var(--ds-teal-900)] font-bold'
      : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-background-200)] hover:text-[var(--ds-gray-1000)] font-medium'
  }`;

const iconButtonClass = (active) =>
  `group flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors duration-200 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] ${
    active
      ? 'bg-[var(--ds-background-200)] text-[var(--ds-teal-900)]'
      : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-background-200)] hover:text-[var(--ds-gray-1000)]'
  }`;

export default function TopHeader({
  activeView,
  onNavigate,
  hasUnreadNotifications,
  notifications,
  onMarkRead,
  onNotificationAction,
  activeLibrary,
  setActiveLibrary,
  team,
  showPersonalSpace = true,
  searchQuery,
  setSearchQuery,
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const showTeamTab = activeLibrary !== 'personal';

  const tabs = [
    { id: 'home', label: 'Dashboard', Icon: HomeIcon },
    { id: 'setlists', label: 'Setlists', Icon: SetlistsIcon },
    { id: 'library', label: 'Library', Icon: LibraryIcon },
    ...(showTeamTab ? [{ id: 'team', label: 'Team', Icon: TeamNavIcon }] : []),
  ];

  return (
    <>
      <header className="hidden sm:flex items-center justify-between h-16 px-4 shrink-0 bg-[var(--ds-background-100)]/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--ds-gray-200)]">
        {/* Left: Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={navButtonClass(active)}
              >
                <Icon />
                <span className="text-label-14">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Center: Workspace Switcher */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <WorkspaceSwitcher
            activeLibrary={activeLibrary}
            setActiveLibrary={setActiveLibrary}
            team={team}
            showPersonalSpace={showPersonalSpace}
            className="h-10 px-3 bg-[var(--ds-background-200)] hover:bg-[var(--ds-gray-200)]"
          />
        </div>

        {/* Right: Actions (Search, Notifications, Settings) */}
        <div className="flex items-center gap-2">
          {/* Global Search Input */}
          <div className="relative group flex items-center mr-2">
            <SearchIconSvg className="absolute left-3 w-4 h-4 text-[var(--ds-gray-500)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery !== undefined ? searchQuery : localQuery}
              onChange={(e) => setSearchQuery ? setSearchQuery(e.target.value) : setLocalQuery(e.target.value)}
              className="w-48 xl:w-64 h-10 pl-9 pr-3 rounded-full bg-[var(--ds-background-200)] border border-transparent focus:border-[var(--ds-teal-300)] focus:ring-2 focus:ring-[var(--ds-teal-100)] outline-none transition-all text-[var(--ds-gray-900)] placeholder:text-[var(--ds-gray-500)] text-sm"
            />
          </div>

          <button
            onClick={() => setTrayOpen(true)}
            className={iconButtonClass(false)}
            aria-label="Notifications"
          >
            <span className="relative flex items-center justify-center">
              <BellIcon />
              {hasUnreadNotifications && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--ds-red-600)] border-2 border-[var(--ds-background-100)]" />
              )}
            </span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={iconButtonClass(activeView === 'settings')}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

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
