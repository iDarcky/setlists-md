import React, { useRef, useEffect } from 'react';
import TopHeader from './TopHeader';
import { useMediaQuery, useIsTablet } from '../lib/useMediaQuery';

export default function DesktopLayout({
  children,
  activeView,
  onNavigate,
  isFullscreen = false,
  hasUnreadNotifications,
  notifications,
  onMarkRead,
  onNotificationAction,
  drawerOpen = false,
  displayName,
  plan,
  avatarUrl,
  hideBottomSpacer = false,
  activeLibrary,
  setActiveLibrary,
  team,
  teams,
  onChangeWorkspace,
  onNewWorkspace,
  newWorkspaceLocked = false,
  supportContact,
}) {
  const mainRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 639.98px)');
  const isTablet = useIsTablet();
  const applyDrawerTransform = drawerOpen && isMobile;
  // The bottom nav is present on mobile and tablet — both need scroll room so
  // the floating bar never covers the last rows of content.
  const showBottomSpacer = !hideBottomSpacer && (isMobile || isTablet);

  // Scroll to top whenever the active view changes
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeView]);

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden">
      {/*
        Desktop / tablet top header (sm+). Replaces the old left sidebar and the
        church "TeamBanner" — the workspace switcher in the header now owns
        Personal ↔ team/church switching. Hidden on mobile, which keeps the
        bespoke MobileTopBar + BottomNav shell.
      */}
      {!isFullscreen && (
        <TopHeader
          className="hidden sm:grid"
          hidePrimaryNav={isTablet}
          activeView={activeView}
          onNavigate={onNavigate}
          hasUnreadNotifications={hasUnreadNotifications}
          notifications={notifications}
          onMarkRead={onMarkRead}
          onNotificationAction={onNotificationAction}
          displayName={displayName}
          plan={plan}
          avatarUrl={avatarUrl}
          activeLibrary={activeLibrary}
          setActiveLibrary={setActiveLibrary}
          team={team}
          teams={teams}
          onManageTeams={onChangeWorkspace}
          onNewWorkspace={onNewWorkspace}
          newWorkspaceLocked={newWorkspaceLocked}
          supportContact={supportContact}
        />
      )}

      {/*
        The main content area owns its scroll. h-full + min-h-0 inside the
        flex column tracks iOS Safari's dynamic viewport so the layout never
        extends under the address bar.

        When the mobile drawer is open, the main content scales down and
        shifts right — mimicking an iOS-style push drawer.
      */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] bg-[var(--ds-background-100)] relative w-full transition-transform duration-300 ease-out"
        style={{
          transform: applyDrawerTransform ? 'translateX(72%) scale(0.92)' : undefined,
          transformOrigin: 'left center',
          willChange: applyDrawerTransform ? 'transform' : undefined,
          borderRadius: applyDrawerTransform ? '24px' : undefined,
          boxShadow: applyDrawerTransform ? '0 30px 60px rgba(0,0,0,0.45)' : undefined,
        }}
      >
        {children}
        {/* Spacer: guaranteed scrollable space so the floating bottom nav
            (mobile + tablet) never obstructs the last rows of content. */}
        {showBottomSpacer && (
          <div
            className="shrink-0"
            style={{ height: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}
            aria-hidden="true"
          />
        )}
      </main>
    </div>
  );
}
