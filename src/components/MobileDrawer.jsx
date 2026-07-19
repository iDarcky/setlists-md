import React, { useEffect, useRef, useState } from 'react';
import {
  StageGreeting,
  AccountSummary,
  PlanLabel,
  UpgradePill,
  SignInButton,
  CreateAccountButton,
} from './account/AccountPanel';
import BrandWordmark from './ui/BrandWordmark';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Account avatar — profile image or initials on the brand gradient.
function DrawerAvatar({ url, name }) {
  const initial = (name || 'G').trim().charAt(0).toUpperCase();
  return (
    <span className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-vetiver)]">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-copy-16 font-bold">{initial}</span>}
    </span>
  );
}

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const HelpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.39 5.96L20.5 10l-5.58 2.72L12 19l-2.92-6.28L3.5 10l6.11-2.04L12 2z" />
  </svg>
);

const InstallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TeamDrawerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function Row({ icon: Icon, label, onClick, accessory }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--drawer-surface)] hover:bg-[var(--drawer-surface-hover)] border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all duration-150 text-left"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="text-[var(--drawer-text-muted)]"><Icon /></span>
      <span className="flex-1 text-copy-15 text-[var(--drawer-text)] font-medium">{label}</span>
      {accessory}
    </button>
  );
}

export default function MobileDrawer({
  open,
  openKey = 0,
  onClose,
  userName,
  email,
  plan = 'Free',
  isSignedIn = false,
  hmMenu = false,
  avatarUrl = null,
  onOpenAccount,
  onOpenSettings,
  onOpenPlan,
  onOpenHelp,
  onOpenWhatsNew,
  hasNewChangelog = false,
  onUpgrade,
  onSignIn,
  onCreateAccount,
  onSignOut,
  onOpenTeam,
  canInstall = false,
  isIOS = false,
  isStandalone = false,
  onInstall,
  activeLibrary,
}) {
  const panelRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    setDragX(0);
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startXRef.current;
    // Only allow dragging left (closing)
    if (dx < 0) setDragX(dx);
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const width = panelRef.current?.offsetWidth || 320;
    if (dragX < -width * 0.35) {
      onClose?.();
    } else {
      setDragX(0);
    }
  };

  // Drawer visual shifts with dragX while being dragged
  const translateX = open
    ? (dragging ? `${dragX}px` : '0px')
    : '-100%';

  const displayName = userName?.trim() || 'Guest';
  const displayEmail = email || 'guest@setlists.md';

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[200] sm:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="drawer-panel fixed top-0 left-0 bottom-0 z-[210] sm:hidden w-[85vw] max-w-[360px] flex flex-col overflow-y-auto overscroll-contain"
        style={{
          transform: `translateX(${translateX})`,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        {/* Top bar — close only. Notifications live in the search-bar bell now,
            so the drawer no longer duplicates them. */}
        <div className="px-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--drawer-close-bg)] text-[var(--drawer-text-muted)] hover:bg-[var(--drawer-close-bg-hover)] cursor-pointer border-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── hmMenu: Account / Plan / App sections ── */}
        {hmMenu && (
          <div className="flex-1 flex flex-col">
            {/* Account card — tappable → Account (edit profile). Guests get the
                greeting + sign-in CTAs instead. */}
            <div className="px-5 pt-2">
              {isSignedIn ? (
                <button
                  onClick={onOpenAccount}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--drawer-surface)] hover:bg-[var(--drawer-surface-hover)] border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all text-left"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <DrawerAvatar url={avatarUrl} name={displayName} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-copy-16 font-semibold text-[var(--drawer-text)] truncate">{displayName}</span>
                    <span className="block text-label-13 text-[var(--drawer-text-muted)] truncate">{displayEmail}</span>
                  </span>
                  <span className="text-[var(--drawer-text-muted)] shrink-0"><ChevronRight /></span>
                </button>
              ) : (
                <>
                  <StageGreeting key={openKey} displayName={displayName} tone="drawer" />
                  <div className="mt-5 flex flex-col gap-2">
                    <SignInButton onSignIn={onSignIn} />
                    <CreateAccountButton onCreateAccount={onCreateAccount} />
                  </div>
                </>
              )}
            </div>

            {/* Plan */}
            <div className="px-5 mt-4 flex flex-col gap-2">
              <PlanLabel plan={plan} tone="drawer" onClick={isSignedIn ? onOpenPlan : undefined} />
              {isSignedIn && plan === 'Free' && <UpgradePill onUpgrade={onUpgrade} />}
            </div>

            {/* App */}
            <div className="px-5 mt-7 flex flex-col gap-2">
              <span className="text-label-11 uppercase tracking-wider text-[var(--drawer-text-muted)] px-1 mb-0.5">App</span>
              <Row icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
              {isSignedIn && activeLibrary && activeLibrary !== 'personal' && onOpenTeam && (
                <Row icon={TeamDrawerIcon} label="Your Team" onClick={onOpenTeam} />
              )}
              {onOpenWhatsNew && (
                <Row icon={SparkleIcon} label="What's new" onClick={onOpenWhatsNew}
                  accessory={hasNewChangelog ? <span aria-label="New release notes" className="w-2 h-2 rounded-full bg-[var(--color-brand)] shrink-0" /> : null} />
              )}
              <Row icon={HelpIcon} label="Help" onClick={onOpenHelp} />
              {!isStandalone && (canInstall || isIOS) && onInstall && (
                <Row icon={InstallIcon} label={isIOS ? 'Add to Home Screen' : 'Install app'} onClick={onInstall} />
              )}
            </div>

            {isSignedIn && (
              <div className="px-5 mt-auto pt-8">
                <button
                  onClick={onSignOut}
                  className="w-full text-center py-3 rounded-xl text-copy-15 font-medium text-[var(--drawer-text-muted)] hover:text-[var(--drawer-text)] bg-transparent border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Classic drawer ── */}
        {!hmMenu && (<>
        {/* Greeting */}
        <div className="px-5 pt-4 pb-6">
          <StageGreeting key={openKey} displayName={displayName} tone="drawer" />
        </div>

        {/* Account */}
        {isSignedIn && (
          <div className="px-5">
            <AccountSummary
              isSignedIn={isSignedIn}
              displayEmail={displayEmail}
              onSignOut={onSignOut}
              tone="drawer"
            />
          </div>
        )}

        {/* Workspace switching now lives in the mobile top bar, not here. */}

        {/* Plan — tap to deep-link into Plan & billing settings. */}
        <div className={`px-5 ${isSignedIn ? 'mt-5' : ''}`}>
          <PlanLabel plan={plan} tone="drawer" onClick={isSignedIn ? onOpenPlan : undefined} />
        </div>

        {/* Primary CTAs — guests get Sign in + Create account; signed-in
            users on the Free plan see the Upgrade pill as their actual
            upgrade entry. The pill is hidden for paid plans (nothing to
            upgrade to from the user's perspective) and for guests (they
            need an account first; the pill dilutes the Sign in CTA). */}
        <div className="px-5 mt-6 flex flex-col gap-2">
          {isSignedIn ? (
            plan === 'Free' && <UpgradePill onUpgrade={onUpgrade} />
          ) : (
            <>
              <SignInButton onSignIn={onSignIn} />
              <CreateAccountButton onCreateAccount={onCreateAccount} />
              {onUpgrade && (
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="self-center mt-1 text-label-13 bg-transparent border-none p-0 cursor-pointer hover:underline underline-offset-4"
                  style={{ color: 'var(--drawer-text-muted)', WebkitTapHighlightColor: 'transparent' }}
                >
                  Compare plans →
                </button>
              )}
            </>
          )}
        </div>

        {/* Nav rows — utility actions sit at the bottom of the panel,
            just above the wordmark, so primary CTAs at top can breathe. */}
        <div className="mt-auto px-5 pt-8 flex flex-col gap-2">
          {/* "Your Team" manages the current workspace — only show it while a
              team/church workspace is active, not in Personal. */}
          {isSignedIn && activeLibrary && activeLibrary !== 'personal' && onOpenTeam && (
            <Row icon={TeamDrawerIcon} label="Your Team" onClick={onOpenTeam} />
          )}
          {onOpenWhatsNew && (
            <Row
              icon={SparkleIcon}
              label="What's new"
              onClick={onOpenWhatsNew}
              accessory={hasNewChangelog ? (
                <span
                  aria-label="New release notes"
                  className="w-2 h-2 rounded-full bg-[var(--color-brand)] shrink-0"
                />
              ) : null}
            />
          )}
          <Row icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
          <Row icon={HelpIcon} label="Help" onClick={onOpenHelp } />
          {!isStandalone && (canInstall || isIOS) && onInstall && (
            <Row
              icon={InstallIcon}
              label={isIOS ? 'Add to Home Screen' : 'Install app'}
              onClick={onInstall}
            />
          )}
        </div>
        </>)}

        {/* Footer — always shows the app wordmark so the drawer reads
            as a product surface, not an account profile. */}
        <div className="px-5 pt-6 text-center">
          <BrandWordmark
            height={20}
            accent="var(--color-brand-mist)"
            className="mx-auto text-[var(--drawer-text)] opacity-90"
          />
        </div>
      </aside>
    </>
  );
}
