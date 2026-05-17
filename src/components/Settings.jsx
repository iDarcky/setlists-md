import { useState } from 'react';
import SyncSettings from './settings/SyncSettings';
import WhatsNewPanel from './settings/WhatsNewPanel';
import ChartStylePanel from './settings/ChartStylePanel';
import SectionsPanel from './settings/SectionsPanel';
import { CHART_THEME_MAP, DEFAULT_CHART_THEME_ID } from '../data/chartThemes';
import { HexColorPicker } from 'react-colorful';
import ScreenHeader from './ui/ScreenHeader';
import BrandWordmark from './ui/BrandWordmark';
import { Button } from './ui/Button';
import { useConfirm } from './ui/useConfirmHook';
import { Dialog } from './ui/Dialog';
import { useIsDesktop } from '../lib/useMediaQuery';

// ─── Icons ───────────────────────────────────────────────────────────────

const AppearanceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const CloudIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19a4.5 4.5 0 1 0-1.6-8.7A6.5 6.5 0 0 0 4 12a5 5 0 0 0 1 9.9" />
  </svg>
);

const DataIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const PlanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.39 5.96L20.5 10l-5.58 2.72L12 19l-2.92-6.28L3.5 10l6.11-2.04L12 2z" />
  </svg>
);

const AboutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
    <path d="M19 14l.7 1.7L21.5 16.5l-1.8.7L19 19l-.7-1.7-1.7-.8 1.7-.8z" />
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// ─── Shared bits used inside sub-panels ──────────────────────────────────

const Section = ({ title, subtitle, children }) => (
  <section className="flex flex-col gap-4">
    {(title || subtitle) && (
      <div className="flex flex-col gap-1 px-2">
        {title && (
          <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold m-0">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">{subtitle}</p>
        )}
      </div>
    )}
    <div className="modes-card flex flex-col p-0 overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
      {children}
    </div>
  </section>
);

const Row = ({ label, children, description }) => (
  <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-col">
      <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
      {description && <span className="text-copy-13 text-[var(--modes-text-muted)]">{description}</span>}
    </div>
    <div className="flex items-center gap-2 mt-2 sm:mt-0">
      {children}
    </div>
  </div>
);

// ─── Hub row — drills into a sub-panel ───────────────────────────────────

function HubRow({ icon: Icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 cursor-pointer border-none text-left hover:bg-[var(--modes-surface)] transition-colors"
      style={{ background: 'transparent', WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="text-[var(--modes-text-muted)] shrink-0">
        <Icon />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-copy-15 text-[var(--modes-text)] font-medium">{label}</span>
        {value && (
          <span className="text-label-12 text-[var(--modes-text-muted)] mt-0.5 truncate">{value}</span>
        )}
      </span>
      <span className="text-[var(--modes-text-dim)] shrink-0">
        <ChevronRight />
      </span>
    </button>
  );
}

// ─── Panel labels (also the ScreenHeader title) ──────────────────────────

const PANEL_TITLES = {
  hub: 'Preferences',
  appearance: 'Appearance',
  chart: 'Chart Defaults',
  'chart-style': 'Chart Style',
  sections: 'Sections',
  sync: 'Cloud Sync',
  plan: 'Plan & billing',
  data: 'Data',
  whatsnew: "What's New",
  about: 'About',
};

const PLAN_DESCRIPTIONS = {
  free: 'The basics — songs and setlists on this device, no cloud sync.',
  sync: 'Personal cloud sync, smart import, multi-device.',
  team: 'Team library, member roles, shared setlists. Up to 10 seats.',
  church: 'Everything in Team plus multi-service scheduling. Up to 30 seats.',
};

const PLAN_LABELS = { free: 'Free', sync: 'Sync', team: 'Team', church: 'Church' };

// ─── Sub-panel renderers — pure, just take what they need ────────────────

function AppearancePanel({ settings, update, isSignedIn }) {
  const accent = settings?.accentColor || '';
  const [accentOpen, setAccentOpen] = useState(false);

  return (
    <Section
      subtitle={isSignedIn
        ? 'Synced to your account — changes follow you across devices.'
        : 'Sign in to sync these preferences to every device you use.'}
    >
      <Row label="App theme" description="System follows your device preference.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'default', label: 'System' },
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
            { key: 'midnight', label: 'Midnight' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={settings.theme === key ? 'secondary' : 'ghost'}
              onClick={() => update('theme', key)}
              className={settings.theme === key ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Accent colour" description="The brand colour used on buttons, selections, and active states.">
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {accent && (
              <Button size="sm" variant="ghost" onClick={() => update('accentColor', null)}>Reset</Button>
            )}
            <button
              type="button"
              onClick={() => setAccentOpen((o) => !o)}
              className="h-9 w-14 rounded-lg border transition-all"
              style={{ background: accent || 'var(--color-brand)', borderColor: accentOpen ? 'var(--color-brand)' : 'var(--ds-gray-400)' }}
              aria-label="Pick accent colour"
            />
          </div>
          {accentOpen && (
            <div className="w-full max-w-[260px] flex flex-col gap-2 items-end">
              <HexColorPicker
                color={accent || '#0070f3'}
                onChange={(v) => update('accentColor', v)}
                style={{ width: '100%', height: 180 }}
              />
              <Button size="sm" variant="ghost" onClick={() => setAccentOpen(false)}>Done</Button>
            </div>
          )}
        </div>
      </Row>
      <Row label="First day of week" description="Affects calendar grids and weekly schedule.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'sunday', label: 'Sunday' },
            { key: 'monday', label: 'Monday' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={(settings.firstDayOfWeek || 'sunday') === key ? 'secondary' : 'ghost'}
              onClick={() => update('firstDayOfWeek', key)}
              className={(settings.firstDayOfWeek || 'sunday') === key ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Clock format" description="How times display on cards and schedules.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: '12h', label: '12-hour' },
            { key: '24h', label: '24-hour' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={(settings.clockFormat || '12h') === key ? 'secondary' : 'ghost'}
              onClick={() => update('clockFormat', key)}
              className={(settings.clockFormat || '12h') === key ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
    </Section>
  );
}

function ChartPanel({ settings, update }) {
  return (
    <Section subtitle="How charts are laid out and which elements are visible by default.">
      <Row label="Library layout" description="Number of columns for the song library view.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {['auto', 1, 2].map(v => (
            <Button
              key={v}
              size="sm"
              variant={settings.defaultColumns === v ? 'secondary' : 'ghost'}
              onClick={() => update('defaultColumns', v)}
              className={settings.defaultColumns === v ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {v === 'auto' ? 'Auto' : `${v} col`}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Chart flow" description="How sections fill when using 2 columns.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'columns', label: 'Top ↓ Down' },
            { key: 'rows', label: 'Left → Right' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={settings.chartLayout === key ? 'secondary' : 'ghost'}
              onClick={() => update('chartLayout', key)}
              className={settings.chartLayout === key ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Display mode" description="Control which elements are visible by default.">
        <div className="flex p-1 bg-[var(--ds-gray-200)] rounded-lg flex-wrap">
          {[
            { key: 'leader', label: 'Full' },
            { key: 'vocalist', label: 'Vocals' },
            { key: 'drummer', label: 'Drums' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={settings.displayRole === key ? 'secondary' : 'ghost'}
              onClick={() => update('displayRole', key)}
              className={settings.displayRole === key ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
    </Section>
  );
}

function SyncPanel({ syncState, onSyncStateChange, onSyncNow, onRequestSignIn, activeLibrary, team }) {
  if (activeLibrary !== 'personal') {
    return (
      <Section subtitle={`This workspace is automatically synced with your team "${team?.name || 'Team'}".`}>
        <Row label="Provider" description="Team Cloud (Supabase Postgres)">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--ds-green-500)]" />
            <span className="text-copy-13 font-medium text-[var(--ds-green-700)]">Connected</span>
          </div>
        </Row>
      </Section>
    );
  }

  return (
    <SyncSettings
      syncState={syncState || { state: 'idle', lastSync: null, provider: null }}
      onSyncStateChange={onSyncStateChange}
      onSyncNow={onSyncNow}
      onRequestSignIn={onRequestSignIn}
    />
  );
}

function DataPanel({ songCount, setlistCount, onDownloadSongs, onClearAll }) {
  const confirm = useConfirm();
  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear all local data?',
      description: 'Every song and setlist on this device will be removed. Cloud copies stay intact, but unsynced edits will be lost. This cannot be undone.',
      confirmLabel: 'Clear all',
      variant: 'danger',
    });
    if (ok) onClearAll();
  };
  return (
    <Section subtitle={`${songCount} songs, ${setlistCount} setlists saved on this device.`}>
      <Row label="Export library" description="Download every song as a separate .md file.">
        <Button size="sm" variant="secondary" onClick={onDownloadSongs}>Download all</Button>
      </Row>
      <Row label="Clear all data" description="Wipe every song and setlist on this device. Cloud copies are kept.">
        <Button size="sm" variant="error" onClick={handleClear}>Clear all</Button>
      </Row>
    </Section>
  );
}

function PlanPanel({ plan, onUpgrade, onRequestSignIn, isSignedIn }) {
  const planKey = (plan || 'free').toLowerCase();
  const label = PLAN_LABELS[planKey] || 'Free';
  const description = PLAN_DESCRIPTIONS[planKey] || PLAN_DESCRIPTIONS.free;

  return (
    <div className="flex flex-col gap-6">
      <div className="modes-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-label-11 uppercase tracking-[0.15em] text-[var(--modes-text-dim)] mb-1">
              Current plan
            </div>
            <div className="text-heading-20 font-semibold text-[var(--modes-text)]">
              {label}
            </div>
          </div>
          {!isSignedIn ? (
            <Button variant="brand" size="sm" onClick={onRequestSignIn}>Sign in</Button>
          ) : planKey === 'free' ? (
            <Button variant="brand" size="sm" onClick={onUpgrade}>Upgrade</Button>
          ) : (
            <span className="text-label-11 uppercase tracking-wider text-[var(--modes-text-muted)]">
              Active
            </span>
          )}
        </div>
        <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
          {description}
        </p>
      </div>

      <Section>
        {isSignedIn && planKey !== 'free' && (
          <Row
            label="Manage billing"
            description="Update your payment method, cancel, or switch plans."
          >
            <Button variant="secondary" size="sm" onClick={onUpgrade}>Open</Button>
          </Row>
        )}
        <Row
          label="Compare plans"
          description="See everything Sync, Team, and Church add on top of Free."
        >
          <Button variant="secondary" size="sm" onClick={onUpgrade}>View plans</Button>
        </Row>
      </Section>
    </div>
  );
}

function planSummary(plan) {
  const label = PLAN_LABELS[(plan || 'free').toLowerCase()] || 'Free';
  return `${label} plan`;
}

function AboutPanel({ isSignedIn, displayName }) {
  const linkClass = 'hover:text-[var(--modes-text)] transition-colors underline-offset-4 underline decoration-[var(--modes-border)]';
  const docBase = 'https://github.com/iDarcky/setlists-md/blob/master/docs';
  return (
    <div className="flex flex-col gap-4">
      <div className="modes-card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/setlists-md-mark.svg"
            alt=""
            aria-hidden="true"
            width="44"
            height="44"
            className="rounded-xl shadow-sm shrink-0"
          />
          <BrandWordmark
            height={22}
            accent="var(--color-brand-mist)"
            className="text-[var(--modes-text)]"
          />
        </div>
        {isSignedIn && displayName && (
          <p className="text-copy-15 text-[var(--modes-text)] font-medium m-0">
            Hi, {displayName}.
          </p>
        )}
        <p className="text-copy-14 text-[var(--modes-text-muted)] leading-relaxed m-0">
          A workspace for music teams. Your songs belong to you as plain Markdown files — open them in any text editor, forever.
        </p>
        <div className="mt-2 flex items-center gap-3 text-label-12 text-[var(--modes-text-muted)] font-medium">
          <span>v{__APP_VERSION__}</span>
          <span className="text-[var(--modes-text-dim)]">·</span>
          <a
            href="https://github.com/iDarcky/setlists-md"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="modes-card p-5 flex flex-col gap-3">
        <h3 className="text-label-12 font-semibold uppercase tracking-widest text-[var(--modes-text-dim)] m-0">
          Legal &amp; Copyright
        </h3>
        <p className="text-copy-13 text-[var(--modes-text-muted)] leading-relaxed m-0">
          setlists.md is a private workspace; you are responsible for licensing
          the content you import. We act on valid copyright takedown notices.
        </p>
        <div className="flex flex-col gap-2 mt-1 text-copy-14">
          <a href={`${docBase}/PRIVACY.md`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy Policy
          </a>
          <a href={`${docBase}/TERMS.md`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms of Service
          </a>
          <a href={`${docBase}/COPYRIGHT.md`} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Copyright Policy &amp; DMCA
          </a>
          <a
            href="mailto:legal@setlists.md?subject=Content%20report"
            className={linkClass}
          >
            Report content (legal@setlists.md)
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Hub summaries — show the current value next to each row ─────────────

function appearanceSummary(s) {
  const theme = s?.theme === 'light' ? 'Light' : s?.theme === 'dark' ? 'Dark' : s?.theme === 'midnight' ? 'Midnight' : 'System';
  const week = s?.firstDayOfWeek === 'monday' ? 'Mon-start' : 'Sun-start';
  const clock = s?.clockFormat === '24h' ? '24h' : '12h';
  return `${theme} · ${week} · ${clock}`;
}

function chartSummary(s) {
  const cols = s?.defaultColumns === 'auto' ? 'Auto' : `${s?.defaultColumns || 1}-col`;
  const flow = s?.chartLayout === 'rows' ? 'L→R' : 'T↓D';
  const role = s?.displayRole === 'vocalist' ? 'Vocals'
    : s?.displayRole === 'drummer' ? 'Drums'
    : 'Full';
  return `${cols} · ${flow} · ${role}`;
}

function chartStyleSummary(s) {
  const id = s?.chartTheme || DEFAULT_CHART_THEME_ID;
  const builtIn = CHART_THEME_MAP[id]?.name;
  if (builtIn) return builtIn;
  const custom = (s?.customChartThemes || []).find(t => t.id === id);
  return custom?.name || 'Custom';
}

function sectionsSummary(s) {
  const labels = Object.keys(s?.sectionLabels || {}).length;
  const colors = Object.keys(s?.sectionColors || {}).length;
  const custom = (s?.customSectionTypes || []).length;
  if (labels + colors + custom === 0) return 'Defaults';
  const parts = [];
  if (custom) parts.push(`${custom} custom`);
  if (labels) parts.push(`${labels} renamed`);
  if (colors) parts.push(`${colors} recoloured`);
  return parts.join(' · ');
}

function syncSummary(syncState) {
  if (!syncState?.provider) return 'Off';
  const provider = syncState.provider;
  if (provider.startsWith('supabase-team:')) return 'Team Cloud';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

// ─── Main component ──────────────────────────────────────────────────────

export default function Settings({
  settings,
  onUpdate,
  onBack,
  onClose,
  onClearAll,
  onDownloadSongs,
  songCount,
  setlistCount,
  syncState,
  onSyncStateChange,
  onSyncNow,
  onRequestSignIn,
  onUpgrade,
  plan = 'Free',
  isSignedIn = false,
  displayName = '',
  // Sub-panel state lives in App.jsx so it participates in the back stack.
  panel = 'hub',
  onChangePanel = () => {},
  activeLibrary = 'personal',
  team = null,
}) {
  // Accepts (key, value) for single-field tweaks or a patch object for
  // multi-field updates done in the same render — without this, two
  // back-to-back update('foo', ...) calls each spread the *stale*
  // settings prop and clobber each other (e.g. creating a new theme +
  // switching to it was losing one or the other).
  const update = (keyOrPatch, value) => {
    if (keyOrPatch && typeof keyOrPatch === 'object') {
      onUpdate({ ...settings, ...keyOrPatch });
    } else {
      onUpdate({ ...settings, [keyOrPatch]: value });
    }
  };
  const isDesktop = useIsDesktop();

  const renderPanel = (activePanel) => {
    switch (activePanel) {
      case 'appearance':
        return <AppearancePanel settings={settings} update={update} isSignedIn={isSignedIn} />;
      case 'chart':
        return <ChartPanel settings={settings} update={update} />;
      case 'chart-style':
        return <ChartStylePanel settings={settings} update={update} onUpgrade={onUpgrade} />;
      case 'sections':
        return <SectionsPanel settings={settings} update={update} onUpgrade={onUpgrade} />;
      case 'sync':
        return (
          <SyncPanel
            syncState={syncState}
            onSyncStateChange={onSyncStateChange}
            onSyncNow={onSyncNow}
            onRequestSignIn={onRequestSignIn}
            activeLibrary={activeLibrary}
            team={team}
          />
        );
      case 'plan':
        return (
          <PlanPanel
            plan={plan}
            isSignedIn={isSignedIn}
            onUpgrade={onUpgrade}
            onRequestSignIn={onRequestSignIn}
          />
        );
      case 'data':
        return (
          <DataPanel
            songCount={songCount}
            setlistCount={setlistCount}
            onDownloadSongs={onDownloadSongs}
            onClearAll={onClearAll}
          />
        );
      case 'whatsnew':
        return (
          <WhatsNewPanel
            settings={settings}
            onMarkSeen={version => update('lastChangelogVersion', version)}
          />
        );
      case 'about':
        return <AboutPanel isSignedIn={isSignedIn} displayName={displayName} />;
      default:
        return null;
    }
  };

  // Desktop: Notion-style modal with sidebar nav + content pane.
  if (isDesktop) {
    const desktopPanel = panel === 'hub' ? 'appearance' : panel;
    const navItems = [
      { key: 'appearance', label: 'Appearance', icon: AppearanceIcon, summary: appearanceSummary(settings) },
      { key: 'chart', label: 'Chart Defaults', icon: ChartIcon, summary: chartSummary(settings) },
      { key: 'chart-style', label: 'Chart Style', icon: AppearanceIcon, summary: chartStyleSummary(settings), badge: 'Pro' },
      { key: 'sections', label: 'Sections', icon: ChartIcon, summary: sectionsSummary(settings), badge: 'Pro' },
      { key: 'sync', label: 'Cloud Sync', icon: CloudIcon, summary: syncSummary(syncState) },
      { key: 'plan', label: 'Plan & billing', icon: PlanIcon, summary: planSummary(plan) },
      { key: 'data', label: 'Data', icon: DataIcon, summary: `${songCount} songs · ${setlistCount} setlists` },
      { key: 'whatsnew', label: "What's New", icon: SparkleIcon, summary: `v${__APP_VERSION__}` },
      { key: 'about', label: 'About', icon: AboutIcon, summary: `v${__APP_VERSION__}` },
    ];
    const handleClose = onClose || onBack;
    return (
      <Dialog open={true} onClose={handleClose} size="xl" ariaLabel="Settings" className="overflow-hidden">
        <div data-theme-variant="modes" className="flex h-[640px] max-h-[85vh]">
          {/* Sidebar */}
          <aside className="w-[240px] shrink-0 border-r border-[var(--modes-border)] bg-[var(--ds-background-200)] flex flex-col">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-heading-16 font-semibold text-[var(--modes-text)] m-0">Settings</h2>
              <p className="text-copy-13 text-[var(--modes-text-muted)] m-0 mt-1">
                {isSignedIn && displayName ? displayName : 'Local device'}
              </p>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
              {navItems.map(({ key, label, icon: Icon }) => {
                const active = desktopPanel === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChangePanel(key)}
                    className={
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer border-none transition-colors ' +
                      (active
                        ? 'bg-[var(--modes-surface-strong)] text-[var(--modes-text)]'
                        : 'bg-transparent text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)] hover:text-[var(--modes-text)]')
                    }
                  >
                    <span className="shrink-0"><Icon /></span>
                    <span className="text-copy-14 font-medium">{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-[var(--ds-background-100)]">
            <header className="flex items-center justify-between px-7 pt-5 pb-3 border-b border-[var(--modes-border)]">
              <div className="flex flex-col">
                <h3 className="text-heading-20 font-semibold text-[var(--modes-text)] m-0">
                  {PANEL_TITLES[desktopPanel] || 'Settings'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="bg-transparent border-none text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] cursor-pointer p-1 rounded-md"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-7 py-6">
              <div className="flex flex-col gap-6 max-w-[640px]">
                {renderPanel(desktopPanel)}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    );
  }

  // Mobile/tablet: existing full-page hub-and-drilldown layout.
  return (
    <div data-theme-variant="modes" className="flex flex-col">
      <ScreenHeader onBack={onBack} title={PANEL_TITLES[panel]} />

      <div className="a4-container py-6 pb-20 flex flex-col gap-6">
        {panel === 'hub' && (
          <div className="modes-card flex flex-col p-0 overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
            <HubRow
              icon={AppearanceIcon}
              label="Appearance"
              value={appearanceSummary(settings)}
              onClick={() => onChangePanel('appearance')}
            />
            <HubRow
              icon={ChartIcon}
              label="Chart Defaults"
              value={chartSummary(settings)}
              onClick={() => onChangePanel('chart')}
            />
            <HubRow
              icon={AppearanceIcon}
              label="Chart Style"
              value={chartStyleSummary(settings)}
              onClick={() => onChangePanel('chart-style')}
            />
            <HubRow
              icon={ChartIcon}
              label="Sections"
              value={sectionsSummary(settings)}
              onClick={() => onChangePanel('sections')}
            />
            <HubRow
              icon={CloudIcon}
              label="Cloud Sync"
              value={syncSummary(syncState)}
              onClick={() => onChangePanel('sync')}
            />
            <HubRow
              icon={PlanIcon}
              label="Plan & billing"
              value={planSummary(plan)}
              onClick={() => onChangePanel('plan')}
            />
            <HubRow
              icon={DataIcon}
              label="Data"
              value={`${songCount} songs · ${setlistCount} setlists`}
              onClick={() => onChangePanel('data')}
            />
            <HubRow
              icon={SparkleIcon}
              label="What's New"
              value={`v${__APP_VERSION__}`}
              onClick={() => onChangePanel('whatsnew')}
            />
            <HubRow
              icon={AboutIcon}
              label="About"
              value={`v${__APP_VERSION__}`}
              onClick={() => onChangePanel('about')}
            />
          </div>
        )}

        {panel !== 'hub' && renderPanel(panel)}
      </div>
    </div>
  );
}
