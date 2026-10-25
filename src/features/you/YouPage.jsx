import { cn } from '@/ui/shadcn/utils';
import { Avatar } from '@/app/AppTopBar';
import {
  BackIcon, ChevronRightIcon, UserIcon, TeamIcon, GearIcon, MoonIcon, HelpIcon,
  SparkIcon, PhoneIcon, SwatchIcon, SignOutIcon,
} from '@/app/navIcons';

// "You": the one menu, opened from the avatar (canvas "Signed out and
// joining" → Navigation options, menu B). A real page, not a pop-over: full
// screen on a phone, a centred column inside the app from the iPad up.

function Row({ icon, label, detail, badge, onClick, danger = false, chevron = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 border-0 border-t border-border bg-transparent px-4 text-left font-sans text-[16px] outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised sm:min-h-12 sm:text-[15px]',
        danger ? 'text-danger-text' : 'text-foreground',
      )}
    >
      <span className={danger ? 'text-danger-text' : 'text-muted-foreground'}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail && <span className="text-small text-muted-foreground">{detail}</span>}
      {badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[12px] font-semibold text-white">{badge}</span>
      )}
      {chevron && <span className="text-input"><ChevronRightIcon /></span>}
    </button>
  );
}

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'default', label: 'Auto' },
];

function ThemeRow({ theme, onChange }) {
  // Midnight is on its way out (to-do row 75); until then it reads as Dark.
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

/**
 * @param {{ name: string, email?: string, url?: string }} me
 * @param {{ name: string }} [church]  the open church; its row leads to Team
 */
export default function YouPage({
  me, signedIn = true, church, teamBadge = 0,
  onBack, onProfile, onTeam, onSettings, theme, onThemeChange, onHelp,
  onWhatsNew, hasNewChangelog = false, onInstall, onDesign, onSignOut, onLogIn,
  embedded = false,
}) {
  return (
    <div
      data-slot="you-page"
      className={cn('min-h-full bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}
    >
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 pb-10 sm:px-6 sm:pt-8">
        <div className="flex h-14 items-center sm:h-auto" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-11 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BackIcon />
            Back
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 pb-3 pt-1 text-center sm:flex-row sm:items-center sm:gap-4 sm:pt-4 sm:text-left">
          <Avatar name={me?.name} url={me?.url} size={72} />
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 mt-1.5 text-[20px] font-semibold tracking-[-0.4px] sm:mt-0 sm:text-[22px]">{me?.name}</h1>
            {me?.email && <span className="text-small text-muted-foreground">{me.email}</span>}
          </div>
        </div>

        <GroupLabel>You</GroupLabel>
        <Group>
          {signedIn && onProfile && <Row icon={<UserIcon />} label="Profile" onClick={onProfile} />}
          {church && onTeam && <Row icon={<TeamIcon />} label={church.name} detail="Team" badge={teamBadge} onClick={onTeam} />}
          <Row icon={<GearIcon />} label="Settings" onClick={onSettings} />
        </Group>

        <GroupLabel>App</GroupLabel>
        <Group>
          <ThemeRow theme={theme} onChange={onThemeChange} />
          {onInstall && <Row icon={<PhoneIcon />} label="Put the app on your phone" onClick={onInstall} />}
          {onWhatsNew && <Row icon={<SparkIcon />} label="What’s new" badge={hasNewChangelog ? 1 : 0} onClick={onWhatsNew} />}
          <Row icon={<HelpIcon />} label="Help and feedback" onClick={onHelp} />
          {onDesign && <Row icon={<SwatchIcon />} label="Design system" onClick={onDesign} />}
        </Group>

        <div className="h-5" />
        <Group>
          {signedIn
            ? <Row icon={<SignOutIcon />} label="Sign out" danger chevron={false} onClick={onSignOut} />
            : <Row icon={<UserIcon />} label="Log in or create an account" onClick={onLogIn} />}
        </Group>
      </div>
    </div>
  );
}
