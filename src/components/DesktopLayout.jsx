import React, { useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import TeamBanner from './TeamBanner';
import { cn } from '../lib/utils';
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
  onChangeWorkspace,
  syncState,
  isOnline,
  hideBanner = false,
  settings,
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

  const cols = isFullscreen
    ? 'grid-cols-1'
    : 'grid-cols-1 sm:grid-cols-[80px_1fr] xl:grid-cols-[280px_1fr]';

  const showBanner = !hideBanner;

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden">
      {/* 
        The banner sits at the very top of the entire app viewport.
        Only visible on desktop here; mobile handles it inside MobileTopBar 
        to ensure it stays above the search bar as requested.
      */}
      {showBanner && (
        <TeamBanner 
          teamName={team?.name}
          activeLibrary={activeLibrary}
          onChangeWorkspace={onChangeWorkspace}
          className="hidden sm:flex" 
        />
      )}

      <div className={cn('flex-1 w-full grid overflow-hidden [grid-template-rows:minmax(0,1fr)]', cols)}>
        {!isFullscreen && (
          <Sidebar 
            activeView={activeView} 
            onNavigate={onNavigate} 
            hasUnreadNotifications={hasUnreadNotifications} 
            onNotificationClick={onNotificationClick} 
            notifications={notifications} 
            onMarkRead={onMarkRead} 
            onNotificationAction={onNotificationAction} 
            displayName={displayName} 
            plan={plan} 
            activeLibrary={activeLibrary} 
            setActiveLibrary={setActiveLibrary} 
            team={team} 
            syncState={syncState}
            isOnline={isOnline}
            showPersonalSpace={settings?.showPersonalSpace !== false}
          />
        )}
        {/*
          The main content area owns its scroll; the sidebar stays rigidly pinned
          to the viewport so iPad can't drag it. h-[100dvh] tracks iOS Safari's
          dynamic viewport so the layout never extends under the address bar.

          When the mobile drawer is open, the main content scales down and
          shifts right — mimicking an iOS-style push drawer.
        */}
        <main
          ref={mainRef}
          className="h-full overflow-y-auto overscroll-contain bg-[var(--ds-background-100)] relative w-full transition-transform duration-300 ease-out"
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
    </div>
  );
}
