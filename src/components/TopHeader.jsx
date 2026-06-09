import React, { useState, useEffect, useRef } from 'react';
import NotificationTray from './NotificationTray';
import FeedbackButton from './FeedbackButton';
import { cn } from '../lib/utils';
import { workspaceStatusLabel } from '../billing/checkout';

/* Icons (kept local so the header is self-contained) */
const TeamNavIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const UserIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
// Renders a workspace's avatar/logo, falling back to a personal/team glyph.
const WorkspaceBadge = ({ workspace, size = 20 }) => {
  const iconSize = Math.round(size * 0.6);
  return (
    <span
      className="rounded-full bg-[var(--ds-gray-300)] flex items-center justify-center shrink-0 overflow-hidden text-[var(--ds-gray-700)]"
      style={{ width: size, height: size }}
    >
      {workspace?.avatarUrl ? (
        <img src={workspace.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : workspace?.isPersonal ? (
        <UserIcon size={iconSize} />
      ) : (
        <TeamNavIcon />
      )}
    </span>
  );
};
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={cn('transition-transform duration-150', open && 'rotate-180')}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Desktop / tablet top header. Replaces the left sidebar (and the old church
 * "TeamBanner"). Left: primary nav. Center: workspace switcher (Personal +
 * every team/church). Right: notifications, preferences, account.
 *
 * Mobile (< sm) keeps the bespoke MobileTopBar + BottomNav, so this is
 * hidden below the sm breakpoint via the `hidden sm:flex` class passed by
 * DesktopLayout.
 */
export default function TopHeader({
  className,
  activeView,
  onNavigate,
  activeLibrary,
  setActiveLibrary,
  teams = [],
  plan = 'Free',
  avatarUrl = null,
  hasUnreadNotifications,
  notifications,
  onMarkRead,
  onNotificationAction,
  onManageTeams,
  onNewWorkspace,
  newWorkspaceLocked = false,
  supportContact,
  // On the tablet shell, primary nav moves to the bottom nav. We then show
  // the brand lockup on the left instead of the nav tabs, keeping the
  // workspace switcher centered and the right-side actions in place.
  hidePrimaryNav = false,
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef(null);

  const planLower = (plan || '').toLowerCase();
  const hasTeamPlan = planLower === 'team' || planLower === 'church';
  // The Team tab manages the *current* workspace, so it only appears while a
  // team/church workspace is active — not in Personal.
  const inTeamWorkspace = !!activeLibrary && activeLibrary !== 'personal';

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'setlists', label: 'Setlists' },
    { id: 'library', label: 'Library' },
    ...(inTeamWorkspace ? [{ id: 'team', label: 'Team' }] : []),
  ];

  // Workspaces: Personal + every team the user belongs to.
  const workspaces = [
    { id: 'personal', name: 'Personal Space', isPersonal: true, avatarUrl },
    ...teams.map(t => ({ id: t.id, name: t.name, plan: t.plan, avatarUrl: t.logo_url || null, status: t.subscription_status })),
  ];
  const activeWorkspace =
    workspaces.find(w => w.id === activeLibrary) || workspaces[0];

  // Close the workspace menu on outside click / Escape.
  useEffect(() => {
    if (!wsOpen) return;
    const onDown = (e) => {
      if (wsRef.current && !wsRef.current.contains(e.target)) setWsOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setWsOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [wsOpen]);

  const selectWorkspace = (id) => {
    setWsOpen(false);
    setActiveLibrary?.(id);
  };

  const navBtn = (active) =>
    cn(
      'inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-label-14 font-semibold',
      'cursor-pointer border-none transition-colors duration-150 focus:outline-none',
      'focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]',
      active
        ? 'bg-[var(--color-brand)] text-white'
        : 'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)]'
    );

  const iconBtn =
    'relative inline-flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none ' +
    'bg-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] ' +
    'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]';

  return (
    <>
      <header
        className={cn(
          'w-full shrink-0 items-center gap-3 px-4 xl:px-6',
          'bg-[var(--ds-background-200)] border-b border-[var(--ds-gray-200)]',
          'grid-cols-[1fr_auto_1fr]',
          className
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
        }}
      >
        {/* Left — primary nav, or the brand lockup on the tablet shell where
            nav has moved to the bottom bar. */}
        {hidePrimaryNav ? (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            aria-label="Home"
            className="flex items-center gap-2.5 min-w-0 bg-transparent border-none cursor-pointer p-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
          >
            <img src="/setlists-md-mark.svg" alt="" width="26" height="26" className="rounded-[7px]" draggable="false" />
            <span className="text-label-14 font-bold text-[var(--ds-gray-1000)] tracking-tight truncate">Setlists.md</span>
          </button>
        ) : (
          <nav className="flex items-center gap-1 min-w-0">
            {tabs.map(({ id, label }) => {
              const active = activeView === id;
              return (
                <button key={id} onClick={() => onNavigate(id)} className={navBtn(active)}>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Center — workspace switcher */}
        <div ref={wsRef} className="relative justify-self-center">
          <button
            onClick={() => setWsOpen(o => !o)}
            className={cn(
              'inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-full max-w-[260px]',
              'text-label-14 font-medium cursor-pointer border border-[var(--ds-gray-300)]',
              'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-500)]',
              'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]'
            )}
            aria-haspopup="menu"
            aria-expanded={wsOpen}
          >
            <WorkspaceBadge workspace={activeWorkspace} size={20} />
            <span className="truncate">{activeWorkspace?.name || 'Personal Space'}</span>
            <ChevronIcon open={wsOpen} />
          </button>

          {wsOpen && (
            <div
              role="menu"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[280px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg z-[120] overflow-hidden py-1"
            >
              {workspaces.map(w => {
                const active = w.id === activeWorkspace?.id;
                return (
                  <button
                    key={w.id}
                    role="menuitem"
                    onClick={() => selectWorkspace(w.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer border-none bg-transparent text-left hover:bg-[var(--ds-gray-200)] transition-colors"
                  >
                    <WorkspaceBadge workspace={w} size={28} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="block text-label-14 font-medium text-[var(--ds-gray-1000)] truncate">{w.name}</span>
                        {workspaceStatusLabel(w.status) && (
                          <span className="shrink-0 text-label-10 font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-900)' }}>
                            {workspaceStatusLabel(w.status)}
                          </span>
                        )}
                      </span>
                      {!w.isPersonal && (
                        <span className="block text-label-12 text-[var(--ds-gray-600)] capitalize">{w.plan || 'team'} Space</span>
                      )}
                    </span>
                    {active && <span className="text-[var(--color-brand)] shrink-0"><CheckIcon /></span>}
                  </button>
                );
              })}

              {(onNewWorkspace || newWorkspaceLocked || (hasTeamPlan && onManageTeams)) && (
                <>
                  <div className="my-1 border-t border-[var(--ds-gray-200)]" />
                  {onNewWorkspace && (
                    <button
                      role="menuitem"
                      onClick={() => { setWsOpen(false); onNewWorkspace(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer border-none bg-transparent text-left text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[var(--color-brand)]"><PlusIcon /></span>
                      <span className="text-label-14 font-medium">New Space</span>
                    </button>
                  )}
                  {!onNewWorkspace && newWorkspaceLocked && (
                    <a
                      role="menuitem"
                      href={supportContact ? `mailto:${supportContact}?subject=Additional%20Space` : undefined}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-[var(--ds-gray-500)] hover:bg-[var(--ds-gray-200)] transition-colors no-underline"
                      title="Spaces are limited during testing"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"><PlusIcon /></span>
                      <span className="text-label-13">Contact support for more Spaces</span>
                    </a>
                  )}
                  {hasTeamPlan && onManageTeams && (
                    <button
                      role="menuitem"
                      onClick={() => { setWsOpen(false); onManageTeams(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer border-none bg-transparent text-left text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"><TeamNavIcon /></span>
                      <span className="text-label-14 font-medium">Manage teams</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right — feedback, notifications, preferences. Account is reached
            through Preferences (which opens on the Account panel). */}
        <div className="flex items-center gap-1 justify-self-end">
          <FeedbackButton variant="header" />
          <button onClick={() => setTrayOpen(true)} className={iconBtn} aria-label="Notifications">
            <BellIcon />
            {hasUnreadNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--ds-red-600)]" />
            )}
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={cn(iconBtn, (activeView === 'settings' || activeView === 'account') && 'bg-[var(--ds-gray-200)] text-[var(--ds-gray-1000)]')}
            aria-label="Preferences"
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
