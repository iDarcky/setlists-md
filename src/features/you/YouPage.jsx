import { useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Avatar } from '@/app/AppTopBar';
import {
  BackIcon, ChevronRightIcon, UserIcon, TeamIcon, GearIcon, MoonIcon, HelpIcon,
  SparkIcon, PhoneIcon, SignOutIcon,
} from '@/app/navIcons';
import WebSheet from '@/features/legal/WebSheet';
import FeedbackSheet from './FeedbackSheet';

// "You": the one menu, opened from the avatar. A real page, not a pop-over:
// full screen on a phone, a centred column inside the app from the iPad up.
// Reworked 2026-11-14 (owner, OnStage's settings tab as the reference): the
// church is the title and you are under it; Subscription for the owner;
// help and legal are the website's pages shown inside the app; a form for
// feedback; the version at the bottom unlocks Labs after 7 taps.

const Svg = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CrownIcon = () => <Svg><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5z" /></Svg>;
const SendIcon = () => <Svg><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></Svg>;
const DocIcon = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Svg>;
const ExternalIcon = () => <Svg size={16}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Svg>;

function Row({ icon, label, sub, detail, badge, onClick, danger = false, external = false, chevron = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 border-0 border-t border-border bg-transparent px-4 py-2 text-left font-sans text-[16px] outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised sm:min-h-12 sm:text-[15px]',
        danger ? 'text-danger-text' : 'text-foreground',
      )}
    >
      <span className={danger ? 'text-danger-text' : 'text-muted-foreground'}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate">{label}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {detail && <span className="text-small text-muted-foreground">{detail}</span>}
      {badge != null && badge !== 0 && badge !== false && (
        typeof badge === 'number'
          ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[12px] font-semibold text-white">{badge}</span>
          : <span className="rounded-full bg-selected px-2 py-0.5 text-[12px] font-semibold text-link">{badge}</span>
      )}
      {external ? <span className="text-input"><ExternalIcon /></span> : chevron && <span className="text-input"><ChevronRightIcon /></span>}
    </button>
  );
}

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'default', label: 'Auto' },
];

function ThemeRow({ theme, onChange }) {
  const current = theme === 'midnight' ? 'dark' : (theme || 'dark');
  return (
    <div className="flex min-h-[52px] items-center gap-3.5 px-4 sm:min-h-12">
      <span className="text-muted-foreground"><MoonIcon /></span>
      <span id="you-theme" className="flex-1 text-[16px] sm:text-[15px]">Theme</span>
      <div role="radiogroup" aria-labelledby="you-theme" className="flex gap-0.5 rounded-control bg-raised p-0.5">
        {THEMES.map(t => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={current === t.id}
            onClick={() => onChange?.(t.id)}
            className={cn(
              'h-[30px] min-h-0 cursor-pointer rounded-[6px] border-0 px-2.5 font-sans text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
              current === t.id ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'bg-transparent text-muted-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const Group = ({ children }) => (
  <div className="overflow-hidden rounded-card border border-border bg-card">{children}</div>
);
const GroupLabel = ({ children }) => (
  <div className="px-1 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
);

const UNLOCK_TAPS = 7;
const TAP_WINDOW_MS = 3000;

/**
 * The version line: tap it 7 times to unlock Labs, like Android's developer
 * options. Taps more than 3 seconds apart start the count again.
 */
function VersionLine({ version, labsUnlocked, onUnlockLabs }) {
  const taps = useRef({ n: 0, at: 0 });
  const [hint, setHint] = useState('');
  const tap = () => {
    const now = Date.now();
    const t = taps.current;
    t.n = now - t.at > TAP_WINDOW_MS ? 1 : t.n + 1;
    t.at = now;
    if (labsUnlocked) { if (t.n >= 3) setHint('Labs is already on. Find it in Settings.'); return; }
    const left = UNLOCK_TAPS - t.n;
    if (left <= 0) {
      t.n = 0;
      setHint('Labs is on. Find it in Settings.');
      onUnlockLabs?.();
    } else if (left <= 3) {
      setHint(left === 1 ? '1 more tap to turn on Labs' : `${left} more taps to turn on Labs`);
    }
  };
  return (
    <div className="flex flex-col items-center gap-1 pt-6">
      <button type="button" onClick={tap}
        className="min-h-0 cursor-default rounded-control border-0 bg-transparent px-3 py-2 font-sans text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Setlists.md · version {version}
      </button>
      <span role="status" aria-live="polite" className="min-h-[18px] text-[13px] text-foreground">{hint}</span>
    </div>
  );
}

const LEGAL = [
  { id: 'privacy', label: 'Privacy policy' },
  { id: 'terms', label: 'Terms of service' },
  { id: 'copyright', label: 'Copyright and takedowns' },
];

/**
 * @param {{ name: string, email?: string, url?: string }} me
 * @param {{ name: string, logoUrl?: string, role?: string, people?: number }} [church]  the open church
 * @param {{ label: string }} [subscription]  only for the church's owner
 */
export default function YouPage({
  me, signedIn = true, church, teamBadge = 0, subscription, userId = null,
  onBack, onProfile, onTeam, onSubscription, onSettings, theme, onThemeChange,
  onWhatsNew, hasNewChangelog = false, onInstall, onSignOut, onLogIn,
  version = __APP_VERSION__, labsUnlocked = false, onUnlockLabs, sendFeedback,
  embedded = false,
}) {
  const [web, setWeb] = useState(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <div
      data-slot="you-page"
      className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}
    >
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 pb-10 sm:px-6 sm:pt-8">
        {/* Back only on a phone: from the iPad up the pill and the top bar are
            always on screen, and a Back floating in the middle of a wide
            page reads as a stray. */}
        <div className="flex h-14 items-center sm:hidden" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          <button type="button" onClick={onBack} aria-label="Back" title="Back" className="-ml-2.5 flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><BackIcon /></button>
        </div>

        {/* The church is the title, you are under it (owner, 2026-11-14).
            Without a church, you are the title. */}
        <div className="flex items-center gap-4 pb-1 pt-1 sm:pt-4">
          <Avatar name={church ? church.name : me?.name} url={church ? church.logoUrl : me?.url} size={64} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="m-0 truncate text-[22px] font-semibold tracking-[-0.4px]">{church ? church.name : me?.name}</h1>
            <div className="flex min-w-0 items-center gap-2 text-[14px] text-muted-foreground">
              <span className="truncate">{church ? me?.name : me?.email}</span>
              {church?.role && <span className="shrink-0 rounded-full bg-selected px-2 py-0.5 text-[12px] font-semibold text-link">{church.role}</span>}
            </div>
          </div>
        </div>

        <GroupLabel>You</GroupLabel>
        <Group>
          {signedIn && onProfile && <Row icon={<UserIcon />} label="Profile" sub="Name, photo, what you play" onClick={onProfile} />}
          {church && onTeam && <Row icon={<TeamIcon />} label="Team" detail={church.people ? `${church.people} ${church.people === 1 ? 'person' : 'people'}` : null} badge={teamBadge} onClick={onTeam} />}
          {subscription && onSubscription && <Row icon={<CrownIcon />} label="Subscription" detail={subscription.label} onClick={onSubscription} />}
          <Row icon={<GearIcon />} label="Settings" onClick={onSettings} />
        </Group>

        <GroupLabel>App</GroupLabel>
        <Group>
          <ThemeRow theme={theme} onChange={onThemeChange} />
          {onInstall && <Row icon={<PhoneIcon />} label="Put the app on your phone" onClick={onInstall} />}
          {onWhatsNew && <Row icon={<SparkIcon />} label="What’s new" badge={hasNewChangelog ? 'New' : 0} onClick={onWhatsNew} />}
          <Row icon={<HelpIcon />} label="Help" external onClick={() => setWeb('help')} />
          <Row icon={<SendIcon />} label="Send feedback" onClick={() => setFeedbackOpen(true)} />
          <Row icon={<DocIcon />} label="Privacy and terms" onClick={() => setLegalOpen(true)} />
        </Group>

        <div className="h-5" />
        <Group>
          {signedIn
            ? <Row icon={<SignOutIcon />} label="Sign out" danger chevron={false} onClick={onSignOut} />
            : <Row icon={<UserIcon />} label="Log in or create an account" onClick={onLogIn} />}
        </Group>

        <VersionLine version={version} labsUnlocked={labsUnlocked} onUnlockLabs={onUnlockLabs} />
      </div>

      <Sheet open={legalOpen} onOpenChange={setLegalOpen} title="Privacy and terms" className="h-auto sm:max-w-[440px]">
        <Group>
          {LEGAL.map(l => (
            <Row key={l.id} icon={<DocIcon />} label={l.label} external onClick={() => { setLegalOpen(false); setWeb(l.id); }} />
          ))}
        </Group>
      </Sheet>
      <WebSheet page={web} onClose={() => setWeb(null)} />
      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} userId={userId} send={sendFeedback} />
    </div>
  );
}
