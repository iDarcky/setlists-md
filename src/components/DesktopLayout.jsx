import React, { useRef, useEffect } from 'react';
import TopHeader from './TopHeader';
import { useMediaQuery } from '../lib/useMediaQuery';

export default function DesktopLayout({
  children,
  activeView,
  onNavigate,
  isFullscreen = false,
  hasUnreadNotifications,
  onNotificationClick,
  notifications,
  onMarkRead,
  onNotificationAction,
  drawerOpen = false,
  displayName,
  plan,
  hideBottomSpacer = false,
  activeLibrary,
  setActiveLibrary,
  team,
  teams,
  onChangeWorkspace,
  syncState,
  onSyncNow,
  isOnline,
}) {
  const mainRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 639.98px)');
  const applyDrawerTransform = drawerOpen && isMobile;

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
          activeView={activeView}
          onNavigate={onNavigate}
          hasUnreadNotifications={hasUnreadNotifications}
          notifications={notifications}
          onMarkRead={onMarkRead}
          onNotificationAction={onNotificationAction}
          displayName={displayName}
          plan={plan}
          activeLibrary={activeLibrary}
          setActiveLibrary={setActiveLibrary}
          team={team}
          teams={teams}
          onManageTeams={onChangeWorkspace}
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[var(--ds-background-100)] relative w-full transition-transform duration-300 ease-out"
        style={{
          transform: applyDrawerTransform ? 'translateX(72%) scale(0.92)' : undefined,
          transformOrigin: 'left center',
          willChange: applyDrawerTransform ? 'transform' : undefined,
          borderRadius: applyDrawerTransform ? '24px' : undefined,
          boxShadow: applyDrawerTransform ? '0 30px 60px rgba(0,0,0,0.45)' : undefined,
        }}
      >
        {children}
        {/* Mobile Spacer: Guaranteed scrollable space to prevent bottom-nav obstruction */}
        {!hideBottomSpacer && (
          <div
            className="shrink-0 sm:hidden"
            style={{ height: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}
            aria-hidden="true"
          />
        )}
      </main>
    </div>
  );
}
