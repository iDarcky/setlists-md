import React, { useEffect, useRef, useState } from 'react';
import {
  StageGreeting,
  AccountSummary,
  PlanLabel,
  UpgradePill,
  SignInButton,
  CreateAccountButton,
} from '@/components/account/AccountPanel';
import BrandWordmark from '@/ui/BrandWordmark';
import { workspaceStatusLabel } from '@/billing/checkout';

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
function DrawerAvatar({ url, name, size = 44 }) {
  const initial = (name || 'G').trim().charAt(0).toUpperCase();
  return (
    <span
      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-vetiver)]"
      style={{ width: size, height: size }}
    >
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <span className="font-bold" style={{ fontSize: Math.round(size * 0.4) }}>{initial}</span>}
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

// ── accountPanel (Labs) ───────────────────────────────────────────────────
// Apple's Account sheet vocabulary: a plain title + round close, an identity
// row that pushes into a detail screen, and grouped inset lists (related rows
// share one rounded container, separators inset past the leading element).
// Spaces are Spotify's horizontal rail so the panel's height doesn't grow with
// the number of Spaces.

function Group({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-[var(--drawer-surface)] border border-[var(--drawer-border)] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <div className="text-label-11 uppercase tracking-[0.13em] text-[var(--drawer-text-dim)] mb-2 ml-1.5">
      {children}
    </div>
  );
}

// A row inside a Group. `inset` pulls the hairline past a 29px leading badge.
function GroupRow({ children, onClick, first = false, inset = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 bg-transparent cursor-pointer text-left active:bg-[var(--drawer-surface-hover)] transition-colors border-none ${
        first ? '' : `border-t border-[var(--drawer-border)] ${inset ? 'ml-[52px] pl-0 w-[calc(100%-52px)]' : ''}`
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  );
}

const PanelChevron = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--drawer-text-dim)] shrink-0">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

// Space tile in the rail. `warn` shows a red pip (billing trouble) — the full
// "Past due" wording can't fit under a 50px tile, so it lives in Settings.
function SpaceTile({ workspace, active, warn, onClick }) {
  const initial = (workspace?.name || 'S').trim().charAt(0).toUpperCase();
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={workspace?.name}
      className="w-[62px] shrink-0 flex flex-col items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span
        className="relative w-[50px] h-[50px] min-h-0 rounded-[15px] overflow-hidden flex items-center justify-center text-white transition-all duration-200"
        style={{
          background: workspace?.avatarUrl ? undefined : 'linear-gradient(135deg, var(--color-brand), var(--color-brand-vetiver))',
          boxShadow: active ? '0 0 0 2.5px var(--color-brand), 0 6px 16px rgba(0,0,0,0.4)' : undefined,
          transform: active ? 'scale(1.04)' : 'scale(1)',
        }}
      >
        {workspace?.avatarUrl
          ? <img src={workspace.avatarUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-copy-16 font-bold">{initial}</span>}
        {warn && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--ds-red-700,#e5484d)] border-2 border-[var(--drawer-bg,#0b0910)]" />}
      </span>
      {/* "Personal Space" → "Personal": the word Space is redundant under a
          rail already labelled SPACES, and it truncates to "Persona…". */}
      <span className={`text-label-11 max-w-full truncate ${active ? 'text-[var(--drawer-text)] font-semibold' : 'text-[var(--drawer-text-dim)]'}`}>
        {(workspace?.name || '').replace(/\s+Space$/i, '')}
      </span>
    </button>
  );
}

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
  accountPanel = false,
  avatarUrl = null,
  workspaces = [],
  setActiveLibrary,
  onNewWorkspace,
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
    const t = e.touches[0];
    startXRef.current = accountPanel ? t.clientY : t.clientX;
    setDragX(0);
    setDragging(true);
  };
  // accountPanel is an iOS-style bottom sheet (drags down to dismiss); the
  // classic drawer slides in from the left (drags left). `dragX` carries
  // whichever axis is active.
  const asSheet = accountPanel;

  const onTouchMove = (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    const d = (asSheet ? t.clientY : t.clientX) - startXRef.current;
    // Only allow dragging toward the edge the panel came from (closing).
    if (asSheet ? d > 0 : d < 0) setDragX(d);
  };
  const onTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    // Sheets dismiss on a shorter throw than a side drawer — it's a flick down,
    // not a full swipe across.
    const past = asSheet
      ? dragX > (panelRef.current?.offsetHeight || 480) * 0.25
      : dragX < -(panelRef.current?.offsetWidth || 320) * 0.35;
    if (past) onClose?.(); else setDragX(0);
  };

  const offset = open ? (dragging ? `${dragX}px` : '0px') : '100%';
  const transform = asSheet
    ? `translateY(${offset})`
    : `translateX(${open ? (dragging ? `${dragX}px` : '0px') : '-100%'})`;

  // The sheet scrolls its own content, so a drag-anywhere handler would fight
  // the scroll. Only the grabber/header area drags.
  const dragBind = { onTouchStart, onTouchMove, onTouchEnd };

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
        {...(asSheet ? {} : dragBind)}
        className={
          asSheet
            ? 'drawer-panel fixed left-0 right-0 bottom-0 z-[210] sm:hidden w-full max-h-[88vh] flex flex-col overflow-y-auto overscroll-contain rounded-t-[22px]'
            : 'drawer-panel fixed top-0 bottom-0 left-0 z-[210] sm:hidden w-[85vw] max-w-[360px] flex flex-col overflow-y-auto overscroll-contain'
        }
        style={{
          transform,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingTop: asSheet ? 0 : 'calc(env(safe-area-inset-top, 0px) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          boxShadow: asSheet ? '0 -12px 40px rgba(0,0,0,0.45)' : undefined,
        }}
      >
        {/* ── accountPanel (Labs): the merged Account + Spaces panel ── */}
        {accountPanel && (
          <div className="px-4 flex flex-col">
            {/* Grabber + header. Both carry the drag handlers — the sheet body
                scrolls, so dragging from anywhere would fight the scroll. */}
            <div {...dragBind} className="-mx-4 px-4 pt-2.5 pb-3.5 sticky top-0 z-10">
              <div className="w-9 h-1 rounded-full bg-[var(--drawer-text-dim)] opacity-50 mx-auto mb-3" aria-hidden="true" />
              <div className="flex items-center justify-between px-1">
                <h2 className="text-heading-16 font-semibold text-[var(--drawer-text)] m-0">Account</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 min-h-0 rounded-full flex items-center justify-center bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)] cursor-pointer border-none active:scale-95 transition-transform"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Identity — pushes into Settings → Account. Guests get CTAs. */}
            {isSignedIn ? (
              <Group className="mb-3.5">
                <GroupRow first onClick={onOpenAccount}>
                  <DrawerAvatar url={avatarUrl} name={displayName} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-copy-15 font-semibold text-[var(--drawer-text)] truncate">{displayName}</span>
                    <span className="block text-label-12 text-[var(--drawer-text-muted)] truncate">Profile, plan, and settings</span>
                  </span>
                  <PanelChevron />
                </GroupRow>
              </Group>
            ) : (
              <div className="mb-3.5 flex flex-col gap-2">
                <SignInButton onSignIn={onSignIn} />
                <CreateAccountButton onCreateAccount={onCreateAccount} />
              </div>
            )}

            {/* Spaces — a rail, so the panel height doesn't grow with count. */}
            {workspaces.length > 0 && (
              <>
                <GroupLabel>Spaces</GroupLabel>
                <Group className="mb-3.5">
                  <div className="flex gap-2.5 px-3 py-3 overflow-x-auto no-scrollbar">
                    {workspaces.map(w => (
                      <SpaceTile
                        key={w.id}
                        workspace={w}
                        active={w.id === activeLibrary}
                        warn={!!workspaceStatusLabel(w.status)}
                        onClick={() => { onClose?.(); setActiveLibrary?.(w.id); }}
                      />
                    ))}
                    {onNewWorkspace && (
                      <button
                        onClick={() => { onClose?.(); onNewWorkspace(); }}
                        aria-label="New Space"
                        className="w-[62px] shrink-0 flex flex-col items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <span className="w-[50px] h-[50px] min-h-0 rounded-[15px] flex items-center justify-center border border-dashed border-[var(--drawer-border)] text-[var(--drawer-text-dim)]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </span>
                        <span className="text-label-11 text-[var(--drawer-text-dim)]">New</span>
                      </button>
                    )}
                  </div>
                </Group>
              </>
            )}

            {/* App */}
            <Group className="mb-3.5">
              {isSignedIn && activeLibrary && activeLibrary !== 'personal' && onOpenTeam && (
                <GroupRow first onClick={onOpenTeam}>
                  <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text)]">Your Team</span>
                  <PanelChevron />
                </GroupRow>
              )}
              <GroupRow first={!(isSignedIn && activeLibrary && activeLibrary !== 'personal' && onOpenTeam)} onClick={onOpenSettings}>
                <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text)]">Settings</span>
                <PanelChevron />
              </GroupRow>
              {!isStandalone && (canInstall || isIOS) && onInstall && (
                <GroupRow onClick={onInstall}>
                  <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text)]">{isIOS ? 'Add to Home Screen' : 'Install app'}</span>
                  <PanelChevron />
                </GroupRow>
              )}
              {onOpenWhatsNew && (
                <GroupRow onClick={onOpenWhatsNew}>
                  <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text)]">What's new</span>
                  {hasNewChangelog && <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] shrink-0" />}
                </GroupRow>
              )}
              <GroupRow onClick={onOpenHelp}>
                <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text)]">Get help or send feedback</span>
                <PanelChevron />
              </GroupRow>
            </Group>

            {plan === 'Free' && onUpgrade && <div className="mb-3.5"><UpgradePill onUpgrade={onUpgrade} /></div>}

            {isSignedIn && (
              <Group>
                <GroupRow first onClick={onSignOut}>
                  <span className="flex-1 text-copy-15 font-medium text-[var(--drawer-text-muted)]">Sign out</span>
                </GroupRow>
              </Group>
            )}
          </div>
        )}

        {/* Top bar — close only. Notifications live in the search-bar bell now,
            so the drawer no longer duplicates them. hmMenu drops the close
            button entirely (swipe or tap-outside to dismiss). */}
        {!hmMenu && !accountPanel && (
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
        )}

        {/* ── hmMenu: identity up top, app utilities pinned to the bottom ── */}
        {hmMenu && !accountPanel && (
          <div className="flex-1 flex flex-col px-5 pt-4">
            {/* Account card — tappable → Account (edit profile). Guests get the
                greeting + sign-in CTAs instead. Plan shows as a chip here so we
                don't duplicate the Plan tab that already lives in Settings. */}
            {isSignedIn ? (
              <>
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
                  <span
                    onClick={(e) => { if (onOpenPlan) { e.stopPropagation(); onOpenPlan(); } }}
                    className="shrink-0 text-label-11 font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]"
                  >
                    {plan}
                  </span>
                </button>
                {plan === 'Free' && <div className="mt-3"><UpgradePill onUpgrade={onUpgrade} /></div>}
              </>
            ) : (
              <>
                <StageGreeting key={openKey} displayName={displayName} tone="drawer" />
                <div className="mt-5 flex flex-col gap-2">
                  <SignInButton onSignIn={onSignIn} />
                  <CreateAccountButton onCreateAccount={onCreateAccount} />
                  {plan === 'Free' && onUpgrade && <div className="mt-1"><UpgradePill onUpgrade={onUpgrade} /></div>}
                </div>
              </>
            )}

            {/* App utilities — pinned to the bottom. */}
            <div className="mt-auto pt-8 flex flex-col gap-2">
              <Row icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
              {isSignedIn && activeLibrary && activeLibrary !== 'personal' && onOpenTeam && (
                <Row icon={TeamDrawerIcon} label="Your Team" onClick={onOpenTeam} />
              )}
              {!isStandalone && (canInstall || isIOS) && onInstall && (
                <Row icon={InstallIcon} label={isIOS ? 'Add to Home Screen' : 'Install app'} onClick={onInstall} />
              )}
              {/* What's new + Help — a compact pair, not full rows. */}
              <div className="flex items-stretch gap-2">
                {onOpenWhatsNew && (
                  <button
                    onClick={onOpenWhatsNew}
                    className="relative flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--drawer-surface)] hover:bg-[var(--drawer-surface-hover)] border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all text-label-14 text-[var(--drawer-text)]"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span className="text-[var(--drawer-text-muted)]"><SparkleIcon /></span>
                    What's new
                    {hasNewChangelog && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                  </button>
                )}
                <button
                  onClick={onOpenHelp}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--drawer-surface)] hover:bg-[var(--drawer-surface-hover)] border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all text-label-14 text-[var(--drawer-text)]"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className="text-[var(--drawer-text-muted)]"><HelpIcon /></span>
                  Help
                </button>
              </div>
              {isSignedIn && (
                <button
                  onClick={onSignOut}
                  className="w-full text-center py-3 mt-1 rounded-xl text-copy-15 font-medium text-[var(--drawer-text-muted)] hover:text-[var(--drawer-text)] bg-transparent border border-[var(--drawer-border)] cursor-pointer active:scale-[0.98] transition-all"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Classic drawer ── */}
        {!hmMenu && !accountPanel && (<>
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
          {accountPanel && (
            <div className="mt-1.5 text-label-11 text-[var(--drawer-text-dim)]">v{__APP_VERSION__}</div>
          )}
        </div>
      </aside>
    </>
  );
}
