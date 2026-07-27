import React, { useState } from 'react';
import NotificationTray from '@/components/NotificationTray';
import { cn } from '@/lib/utils';

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const LibraryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
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

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-700)]">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CloudIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// Button shell shared by every nav row. Collapsed (< xl) centers a single
// 44×44 icon hit-area; expanded (xl+) becomes a padded row with label.
const navButtonClass = (active) =>
  `group flex items-center justify-center xl:justify-start xl:gap-3 h-11 w-11 xl:w-full xl:px-3 mx-auto xl:mx-0 rounded-lg cursor-pointer transition-colors duration-200 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] ${
    active
      ? 'bg-[var(--ds-teal-100)] text-[var(--ds-teal-900)]'
      : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)]'
  }`;

const TeamNavIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function Sidebar({ 
  activeView, 
  onNavigate, 
  hasUnreadNotifications, 
  notifications, 
  onMarkRead, 
  onNotificationAction, 
  displayName = 'Guest', 
  plan = 'Free', 
  activeLibrary, 
  setActiveLibrary, 
  team,
  syncState,
  onSyncNow,
  isOnline 
}) {
  const [trayOpen, setTrayOpen] = useState(false);

  const planLower = plan.toLowerCase();
  const hasTeamPlan = planLower === 'team' || planLower === 'church';

  // Determine sync label and color
  let syncLabel = 'Local Only';
  let syncColor = 'text-[var(--ds-gray-500)]';
  let isSyncing = false;

  if (syncState?.state === 'syncing') {
    syncLabel = 'Syncing...';
    syncColor = 'text-[var(--ds-blue-700)]';
    isSyncing = true;
  } else if (syncState?.state === 'error') {
    syncLabel = 'Sync Error';
    syncColor = 'text-[var(--ds-red-600)]';
  } else if (syncState?.provider || activeLibrary !== 'personal') {
    syncLabel = 'Cloud Synced';
    syncColor = 'text-[var(--ds-green-700)]';
  }

  const tabs = [
    { id: 'home', label: 'Dashboard', Icon: HomeIcon },
    { id: 'setlists', label: 'Setlists', Icon: SetlistsIcon },
    { id: 'library', label: 'Songs', Icon: LibraryIcon },
    ...(hasTeamPlan ? [{ id: 'team', label: 'Team', Icon: TeamNavIcon }] : []),
  ];

  return (
    <>
      <aside className="h-full hidden sm:flex flex-col bg-[var(--ds-background-200)] transition-all duration-300 w-[80px] xl:w-[280px] py-6 px-3 xl:px-4 overflow-hidden overscroll-contain">
        {/* Profile */}
        <button
          onClick={() => onNavigate('account')}
          aria-label="Account"
          className={`flex items-center justify-center xl:justify-start gap-3 mb-8 xl:px-2 shrink-0 bg-transparent border-none cursor-pointer rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-teal-600)] transition-colors text-left ${
            activeView === 'account'
              ? 'bg-[var(--ds-teal-100)]'
              : 'hover:bg-[var(--ds-gray-200)]'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-[var(--ds-gray-300)] flex items-center justify-center shrink-0">
            <UserIcon />
          </div>
          <div className="hidden xl:block overflow-hidden">
            <p className="text-label-14 font-semibold text-[var(--ds-gray-1000)] truncate">{displayName}</p>
            <p className="text-label-12 text-[var(--ds-teal-800)] font-medium truncate uppercase tracking-widest text-[10px]">{plan} TIER</p>
          </div>
        </button>

        {/* Library Switcher */}
        {team && (
          <div className="mb-6 xl:px-2 flex flex-col gap-2">
            <span className="hidden xl:block text-label-12 text-[var(--ds-gray-500)] font-semibold uppercase tracking-wider pl-1">
              Workspace
            </span>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveLibrary('personal')}
                className={`flex items-center justify-center xl:justify-start gap-2 h-10 w-10 xl:w-full xl:px-3 mx-auto xl:mx-0 rounded-lg cursor-pointer transition-colors duration-200 border-none focus:outline-none ${
                  activeLibrary === 'personal'
                    ? 'bg-[var(--ds-gray-900)] text-white'
                    : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)]'
                }`}
                title="Personal Library"
              >
                <UserIcon />
                <span className={`hidden xl:block text-label-14 ${activeLibrary === 'personal' ? 'font-bold' : 'font-medium'}`}>Personal</span>
              </button>
              
              <button
                onClick={() => setActiveLibrary(team.id)}
                className={`flex items-center justify-center xl:justify-start gap-2 h-10 w-10 xl:w-full xl:px-3 mx-auto xl:mx-0 rounded-lg cursor-pointer transition-colors duration-200 border-none focus:outline-none ${
                  activeLibrary === team.id
                    ? 'bg-[var(--ds-gray-900)] text-white'
                    : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)]'
                }`}
                title={team.name}
              >
                <TeamNavIcon />
                <span className={`hidden xl:block text-label-14 truncate ${activeLibrary === team.id ? 'font-bold' : 'font-medium'}`}>
                  {team.name}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Nav Menu */}
        <nav className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={navButtonClass(active)}
              >
                <Icon />
                <span className={`hidden xl:block text-label-14 text-left ${active ? 'font-bold' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Secondary Nav */}
        <div className="mt-auto flex flex-col gap-1 pt-6 mb-6 border-t border-[var(--ds-gray-200)] shrink-0">
          <button
            onClick={() => setTrayOpen(true)}
            className={navButtonClass(false)}
          >
            <span className="relative flex items-center justify-center">
              <BellIcon />
              {hasUnreadNotifications && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--ds-red-600)]" />
              )}
            </span>
            <span className="hidden xl:block text-label-14 text-left font-medium">Notifications</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={navButtonClass(activeView === 'settings')}
          >
            <SettingsIcon />
            <span className={`hidden xl:block text-label-14 text-left ${activeView === 'settings' ? 'font-bold' : 'font-medium'}`}>Settings</span>
          </button>
        </div>

        {/* Sync Status — expanded only */}
        <div className="hidden xl:flex flex-col gap-2 text-label-12 uppercase font-semibold shrink-0">
          <button 
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing || !isOnline}
            className={cn(
              "flex items-center gap-2 bg-transparent border-none p-1 -ml-1 rounded-md text-left transition-colors",
              isSyncing || !isOnline ? "cursor-default opacity-80" : "cursor-pointer hover:bg-[var(--ds-gray-200)]",
              syncColor
            )}
            title="Click to sync now"
          >
            <div className={cn("shrink-0", isSyncing && "animate-spin")}>
              <CloudIcon />
            </div>
            <span>{syncLabel}</span>
          </button>
          <div className={cn("flex items-center gap-2 p-1 -ml-1", isOnline ? "text-[var(--ds-green-700)]" : "text-[var(--ds-amber-600)]")}>
            <div className="shrink-0">
              <CheckCircleIcon />
            </div>
            <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>
      </aside>

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
