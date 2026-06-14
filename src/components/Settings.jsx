import { useState, useMemo, useRef, useEffect } from 'react';
import Account from './Account';
import { useAuth } from '../auth/useAuth';
import { useEntitlement } from '../hooks/useEntitlement';
import { Input } from './ui/Input';
import { BILLING_ENABLED, startTeamCheckout, openBillingPortal, billingError } from '../billing/checkout';
import SyncSettings from './settings/SyncSettings';
import WhatsNewPanel from './settings/WhatsNewPanel';
import ChartStylePanel from './settings/ChartStylePanel';
import SectionsPanel from './settings/SectionsPanel';
import { CHART_THEME_MAP, DEFAULT_CHART_THEME_ID } from '../data/chartThemes';
import { HexColorPicker } from 'react-colorful';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import PageHeader from './ui/PageHeader';
import BrandWordmark from './ui/BrandWordmark';
import { Button } from './ui/Button';
import { useConfirm } from './ui/useConfirmHook';
import { Dialog } from './ui/Dialog';
import { useIsDesktop } from '../lib/useMediaQuery';

// ─── Icons ───────────────────────────────────────────────────────────────

const AccountIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

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

const GeneralIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
    <div className="modes-card flex flex-col p-0 overflow-hidden divide-y divide-[var(--modes-border)]">
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

// ─── General panel ───────────────────────────────────────────────────────

function GeneralPanel({ settings, update, onShowHelp, onReplayOnboarding }) {
  const landing = settings?.landingView || 'home';
  const confirmDelete = settings?.confirmBeforeDelete !== false;
  return (
    <Section subtitle="Language, your landing page, and how the app behaves.">
      <Row label="Default landing page" description="Where the app opens when you launch it.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'home', label: 'Home' },
            { key: 'library', label: 'Songs' },
            { key: 'setlists', label: 'Setlists' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={landing === key ? 'secondary' : 'ghost'}
              onClick={() => update('landingView', key)}
              className={landing === key ? 'bg-[var(--ds-background-100)] shadow-sm' : 'text-[var(--ds-gray-900)]'}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Language" description="App language. More languages are on the way.">
        <Select value={settings?.language || 'en'} onValueChange={(v) => update('language', v)}>
          <SelectTrigger className="h-8 px-2 min-w-[8rem] w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Confirm before deleting" description="Ask for confirmation before deleting songs or setlists.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[{ key: true, label: 'On' }, { key: false, label: 'Off' }].map(({ key, label }) => (
            <Button
              key={String(key)}
              size="sm"
              variant={confirmDelete === key ? 'secondary' : 'ghost'}
              onClick={() => update('confirmBeforeDelete', key)}
              className={confirmDelete === key ? 'bg-[var(--ds-background-100)] shadow-sm' : 'text-[var(--ds-gray-900)]'}
            >
              {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Help guide" description="Open the in-app help and feedback.">
        <Button size="sm" variant="secondary" onClick={() => onShowHelp?.()}>Open Help</Button>
      </Row>
      <Row label="Replay onboarding" description="See the first-run welcome flow again.">
        <Button size="sm" variant="secondary" onClick={() => onReplayOnboarding?.()}>Replay</Button>
      </Row>
    </Section>
  );
}

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
  hub: 'Settings',
  general: 'General',
  account: 'Account',
  appearance: 'Appearance',
  chart: 'Chart Defaults',
  'chart-style': 'Chart Style',
  sections: 'Sections',
  sync: 'Cloud Sync',
  services: 'Services',
  plan: 'Plan & billing',
  data: 'Data',
  whatsnew: "What's New",
  about: 'About',
};

// Short descriptions under each panel title for the Notion-style content pane.
const PANEL_SUBTITLES = {
  general: 'Language, your landing page, and app behaviour.',
  account: 'Manage your profile, sign-in, and plan.',
  appearance: 'Theme, accent colour, and date/time format.',
  chart: 'How charts lay out and which elements show by default.',
  'chart-style': 'Fine-tune chart colours, fonts, and spacing.',
  sections: 'Custom section types, colours, and labels.',
  sync: 'Connect cloud storage to sync across devices.',
  services: 'Manage the service names used across setlists.',
  plan: 'Your current plan and billing.',
  data: 'Export your library or clear all local data.',
  whatsnew: 'Recent updates and changes.',
  about: 'Version, legal, and credits.',
};

const PLAN_DESCRIPTIONS = {
  free: 'The basics — songs and setlists on this device, no cloud sync.',
  sync: 'Personal cloud sync, smart import, multi-device.',
  team: 'Team library, member roles, shared setlists. Up to 10 seats.',
  church: 'Everything in Team plus multi-service scheduling. Up to 30 seats.',
};

const PLAN_LABELS = { free: 'Free', pro: 'Pro', sync: 'Sync', team: 'Band', church: 'Church' };

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
        <Select value={settings.theme || 'default'} onValueChange={(v) => update('theme', v)}>
          <SelectTrigger className="h-9 px-3 text-label-13 font-medium gap-1 min-w-[160px] w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="midnight">Midnight</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Accent colour" description="The brand colour used on buttons, selections, and active states.">
        <div className="flex items-center gap-2">
          {accent && (
            <Button size="sm" variant="ghost" onClick={() => update('accentColor', null)}>Reset</Button>
          )}
          <button
            type="button"
            onClick={() => setAccentOpen((o) => !o)}
            className="h-9 w-14 rounded-lg border transition-all"
            style={{
              background: accent || 'var(--color-brand)',
              borderColor: accentOpen ? 'var(--color-brand)' : 'var(--modes-border)',
            }}
            aria-label="Pick accent colour"
          />
        </div>
      </Row>
      {accentOpen && (
        <div className="modes-card p-3 flex flex-col gap-2">
          <HexColorPicker
            color={accent || '#0070f3'}
            onChange={(v) => update('accentColor', v)}
            style={{ width: '100%', height: 180 }}
          />
          <div className="flex items-center gap-2">
            <span className="text-label-11 text-[var(--modes-text-dim)] uppercase tracking-wider">Hex</span>
            <input
              type="text"
              value={accent || ''}
              placeholder="#0070f3"
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#?[0-9a-fA-F]{6}$/.test(v)) update('accentColor', v.startsWith('#') ? v : `#${v}`);
              }}
              className="flex-1 h-8 px-2 rounded-md bg-[var(--modes-surface-strong)] text-copy-13 text-[var(--modes-text)] border border-[var(--modes-border)] font-mono"
            />
            <Button size="sm" variant="ghost" onClick={() => setAccentOpen(false)}>Done</Button>
          </div>
        </div>
      )}
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
      <Row label="Setlist rail" description="Show the setlist beside the chart in live & practice on landscape tablets.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: true, label: 'On' },
            { key: false, label: 'Off' },
          ].map(({ key, label }) => {
            const active = (settings.performanceRail !== false) === key;
            return (
              <Button
                key={String(key)}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('performanceRail', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Navigation controls" description="How you move between songs in live & practice.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'pill', label: 'Floating pill' },
            { key: 'header', label: 'Header buttons' },
            { key: 'edge', label: 'Edge arrows' },
            { key: 'swipe', label: 'Swipe' },
          ].map(({ key, label }) => {
            const active = (settings.navStyle || 'pill') === key;
            return (
              <Button
                key={key}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('navStyle', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Auto-hide title bar" description="Collapse the header in live & practice after a few seconds idle; tap to bring it back.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: true, label: 'On' },
            { key: false, label: 'Off' },
          ].map(({ key, label }) => {
            const active = (settings.autoHideHeader !== false) === key;
            return (
              <Button
                key={String(key)}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('autoHideHeader', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Structure ribbon" description="How the section flow shows above the chart in chart, practice & live.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 'chips', label: 'Chips' },
            { key: 'numbered', label: 'Codes' },
            { key: 'dots', label: 'Dots' },
          ].map(({ key, label }) => {
            const active = (settings.ribbonStyle || 'chips') === key;
            return (
              <Button
                key={key}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('ribbonStyle', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Tab grid resolution" description="Default subdivisions when creating a new tab. Beats only keeps it simple; finer grids allow 8th/16th-note detail.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 1, label: '1/4' },
            { key: 2, label: '1/8' },
            { key: 4, label: '1/16' },
          ].map(({ key, label }) => {
            const active = (settings.tabSubdivision || 1) === key;
            return (
              <Button
                key={key}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('tabSubdivision', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Tab size" description="How large guitar/bass tabs render in the chart view.">
        <div className="flex p-1 bg-[var(--modes-surface-strong)] rounded-lg">
          {[
            { key: 0.85, label: 'Small' },
            { key: 1, label: 'Medium' },
            { key: 1.25, label: 'Large' },
          ].map(({ key, label }) => {
            const active = (settings.tabSize || 1) === key;
            return (
              <Button
                key={key}
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => update('tabSize', key)}
                className={active ? "bg-[var(--ds-background-100)] shadow-sm" : "text-[var(--ds-gray-900)]"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Row>
      <Row label="Tab string colour" description="Colour of the string lines, bar lines and string labels in tabs.">
        <TabColorControl value={settings.tabStringColor} fallback="#9b9b9b" onChange={v => update('tabStringColor', v)} />
      </Row>
      <Row label="Tab number colour" description="Colour of the fret numbers in tabs.">
        <TabColorControl value={settings.tabNumberColor} fallback="#e0a82e" onChange={v => update('tabNumberColor', v)} />
      </Row>
      <Row label="Tab background" description="Fill behind the fret numbers (where the string line is broken).">
        <TabColorControl value={settings.tabBg} fallback="#101010" onChange={v => update('tabBg', v)} />
      </Row>
    </Section>
  );
}

// Color swatch + native picker with a reset-to-theme option for tab styling.
function TabColorControl({ value, fallback, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || fallback}
        onChange={e => onChange(e.target.value)}
        className="w-9 h-8 rounded-md border border-[var(--ds-gray-400)] bg-transparent cursor-pointer p-0"
        aria-label="Pick colour"
      />
      <span className="text-label-12 font-mono text-[var(--ds-gray-700)] w-[72px]">{value || 'Theme'}</span>
      {value && (
        <Button size="sm" variant="ghost" onClick={() => onChange('')} className="text-[var(--ds-gray-700)]">Reset</Button>
      )}
    </div>
  );
}

function SyncPanel({ syncState, onSyncStateChange, onSyncNow, onRequestSignIn, activeLibrary, team }) {
  if (activeLibrary !== 'personal') {
    return (
      <Section subtitle={`This Space is automatically synced with your team "${team?.name || 'Team'}".`}>
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

function PlanPanel({ plan, onUpgrade, onRequestSignIn, isSignedIn, activeLibrary, team }) {
  const { user } = useAuth();
  const isTeam = activeLibrary !== 'personal';
  // Canonical tier field is team.plan ('team' | 'church'); billing_plan is
  // deprecated. Per-workspace subscription status defaults to 'active'.
  const effectivePlan = isTeam ? (team?.plan || 'free') : plan;
  const planKey = (effectivePlan || 'free').toLowerCase();
  const teamStatus = isTeam ? (team?.subscription_status || 'active').toLowerCase() : null;
  const teamBillingOk = teamStatus === 'active' || teamStatus === 'trialing';
  const isOwner = isTeam && !!user?.id && team?.owner_id === user.id;

  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState(null);
  const runBilling = async (fn) => {
    setBillingBusy(true);
    setBillingMsg(null);
    try {
      await fn();
    } catch (err) {
      setBillingMsg(billingError(err));
    } finally {
      setBillingBusy(false);
    }
  };
  
  const label = isTeam 
    ? (team?.name || 'Team') + ' Plan' 
    : (PLAN_LABELS[planKey] || 'Free');
    
  const description = isTeam
    ? `Managed by the team owner.`
    : (PLAN_DESCRIPTIONS[planKey] || PLAN_DESCRIPTIONS.free);

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
          ) : !isTeam && planKey === 'free' ? (
            <Button variant="brand" size="sm" onClick={onUpgrade}>Upgrade</Button>
          ) : (
            <span
              className="text-label-11 uppercase tracking-wider"
              style={{ color: isTeam && !teamBillingOk ? 'var(--ds-red-900)' : 'var(--modes-text-muted)' }}
            >
              {isTeam ? (teamStatus === 'past_due' ? 'Past due' : teamStatus === 'canceled' ? 'Canceled' : teamStatus === 'unpaid' ? 'Unpaid' : teamStatus === 'trialing' ? 'Trial' : 'Active') : 'Active'}
            </span>
          )}
        </div>
        <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
          {description}
        </p>
      </div>

      <Section>
        {isSignedIn && !isTeam && planKey !== 'free' && (
          <Row
            label="Manage billing"
            description="Update your payment method, cancel, or switch plans."
          >
            <Button variant="secondary" size="sm" onClick={onUpgrade}>Open</Button>
          </Row>
        )}
        {isSignedIn && isTeam && (
          isOwner && BILLING_ENABLED ? (
            <>
              {!teamBillingOk && (
                <Row label="Subscribe" description="Activate this Space’s subscription to restore paid features.">
                  <Button variant="brand" size="sm" disabled={billingBusy} onClick={() => runBilling(() => startTeamCheckout(team.id, team.plan))}>
                    Subscribe
                  </Button>
                </Row>
              )}
              <Row label="Manage billing" description="Update your payment method, cancel, or switch plans for this Space.">
                <Button variant="secondary" size="sm" disabled={billingBusy} onClick={() => runBilling(() => openBillingPortal(team.id))}>
                  Open
                </Button>
              </Row>
              {billingMsg && (
                <p className="text-copy-13 m-0 px-1" style={{ color: 'var(--ds-red-900)' }}>{billingMsg}</p>
              )}
            </>
          ) : (
            <Row
              label="Team Subscription"
              description={isOwner ? 'Billing isn’t live yet — check back soon.' : 'Only the Space owner can manage this subscription.'}
            />
          )
        )}
        {!isTeam && (
          <Row
            label="Compare plans"
            description="See everything Sync, Team, and Church add on top of Free."
          >
            <Button variant="secondary" size="sm" onClick={onUpgrade}>View plans</Button>
          </Row>
        )}
      </Section>
    </div>
  );
}

function planSummary(plan) {
  const label = PLAN_LABELS[(plan || 'free').toLowerCase()] || 'Free';
  return `${label} plan`;
}

function ServicesPanel({ setlists = [], onRemapService }) {
  const confirm = useConfirm();
  const services = useMemo(() => {
    const counts = {};
    setlists.forEach(sl => {
      const s = (sl.service || '').trim();
      if (s) counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [setlists]);

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  const startEdit = (name) => { setEditing(name); setDraft(name); };
  const saveEdit = (oldName) => {
    const next = draft.trim();
    if (next && next !== oldName) onRemapService?.(oldName, next);
    setEditing(null);
  };
  const remove = async (name, count) => {
    const ok = await confirm({
      title: `Remove “${name}”?`,
      description: `This clears the service from ${count} setlist${count === 1 ? '' : 's'}. The setlists themselves are kept.`,
      confirmLabel: 'Remove service',
      variant: 'danger',
    });
    if (ok) onRemapService?.(name, '');
  };

  return (
    <Section subtitle="Services are the slots a setlist belongs to (e.g. Sunday AM). They come from what you type on setlists — rename or remove them here.">
      {services.length === 0 ? (
        <div className="modes-card p-6 text-center text-copy-14 text-[var(--modes-text-muted)]">
          No services yet. Set a service on a setlist and it’ll appear here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {services.map(svc => (
            <div key={svc.name} className="modes-card flex items-center gap-2 px-4 py-3">
              {editing === svc.name ? (
                <>
                  <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(svc.name); if (e.key === 'Escape') setEditing(null); }}
                    autoFocus
                    className="flex-1"
                  />
                  <Button variant="brand" size="sm" onClick={() => saveEdit(svc.name)} disabled={!draft.trim()}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-copy-14 font-medium text-[var(--modes-text)] truncate">{svc.name}</div>
                    <div className="text-label-12 text-[var(--modes-text-dim)]">{svc.count} setlist{svc.count === 1 ? '' : 's'}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(svc.name)}>Rename</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(svc.name, svc.count)} className="text-[var(--ds-red-700)]">Remove</Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function AboutPanel({ isSignedIn, displayName, onShowLegal }) {
  const linkClass = 'text-left hover:text-[var(--modes-text)] transition-colors underline-offset-4 underline decoration-[var(--modes-border)] bg-transparent border-none p-0 cursor-pointer';
  const showLegal = onShowLegal || (() => {});
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
        <div className="flex flex-col items-start gap-2 mt-1 text-copy-14">
          <button type="button" onClick={() => showLegal('privacy')} className={linkClass}>
            Privacy Policy
          </button>
          <button type="button" onClick={() => showLegal('terms')} className={linkClass}>
            Terms of Service
          </button>
          <button type="button" onClick={() => showLegal('copyright')} className={linkClass}>
            Copyright Policy &amp; DMCA
          </button>
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
  onShowLegal,
  plan = 'Free',
  isSignedIn = false,
  displayName = '',
  displayEmail = '',
  onSignOut,
  onSignIn,
  onCreateAccount,
  onShowHelp,
  onReplayOnboarding,
  // Sub-panel state lives in App.jsx so it participates in the back stack.
  panel = 'hub',
  onChangePanel = () => {},
  activeLibrary = 'personal',
  team = null,
  setlists = [],
  onRemapService,
}) {
  const { allowed: canManageServices } = useEntitlement('multi-service');
  // Reset the desktop content pane to the top whenever the active panel
  // changes — otherwise switching to a shorter panel keeps the previous
  // scroll offset and lands the user mid-page.
  const desktopScrollRef = useRef(null);
  useEffect(() => {
    if (desktopScrollRef.current) desktopScrollRef.current.scrollTop = 0;
  }, [panel]);
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
      case 'account':
        return (
          <Account
            embedded
            settings={settings}
            onUpdate={onUpdate}
            isSignedIn={isSignedIn}
            displayName={displayName}
            displayEmail={displayEmail}
            plan={plan}
            onUpgrade={onUpgrade}
            onSignIn={onSignIn || onRequestSignIn}
            onCreateAccount={onCreateAccount}
            onSignOut={onSignOut}
          />
        );
      case 'general':
        return <GeneralPanel settings={settings} update={update} onShowHelp={onShowHelp} onReplayOnboarding={onReplayOnboarding} />;
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
      case 'services':
        return <ServicesPanel setlists={setlists} onRemapService={onRemapService} />;
      case 'plan':
        return (
          <PlanPanel
            plan={plan}
            isSignedIn={isSignedIn}
            onUpgrade={onUpgrade}
            onRequestSignIn={onRequestSignIn}
            activeLibrary={activeLibrary}
            team={team}
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
        return <AboutPanel isSignedIn={isSignedIn} displayName={displayName} onShowLegal={onShowLegal} />;
      default:
        return null;
    }
  };

  // Single source of truth for the settings navigation, grouped into labelled
  // sections. Both the desktop sidebar and the mobile hub render from this so
  // they never drift apart. `show: false` items are filtered out.
  const serviceCount = new Set(setlists.map(s => (s.service || '').trim()).filter(Boolean)).size;
  const navGroups = [
    {
      title: 'Account',
      items: [
        { key: 'account', label: 'Account', icon: AccountIcon, value: isSignedIn ? (displayEmail || displayName) : 'Sign in' },
        { key: 'general', label: 'General', icon: GeneralIcon, value: 'Language, landing page' },
        { key: 'plan', label: 'Plan & billing', icon: PlanIcon, value: planSummary(plan) },
      ],
    },
    {
      title: 'Display',
      items: [
        { key: 'appearance', label: 'Appearance', icon: AppearanceIcon, value: appearanceSummary(settings) },
        { key: 'chart', label: 'Chart Defaults', icon: ChartIcon, value: chartSummary(settings) },
        { key: 'chart-style', label: 'Chart Style', icon: AppearanceIcon, value: chartStyleSummary(settings), badge: 'Pro' },
        { key: 'sections', label: 'Sections', icon: ChartIcon, value: sectionsSummary(settings), badge: 'Pro' },
      ],
    },
    {
      title: 'Sync & data',
      items: [
        { key: 'sync', label: 'Cloud Sync', icon: CloudIcon, value: syncSummary(syncState) },
        { key: 'services', label: 'Services', icon: PlanIcon, value: `${serviceCount} service${serviceCount === 1 ? '' : 's'}`, show: canManageServices },
        { key: 'data', label: 'Data', icon: DataIcon, value: `${songCount} songs · ${setlistCount} setlists` },
      ],
    },
    {
      title: 'About',
      items: [
        { key: 'whatsnew', label: "What's New", icon: SparkleIcon, value: `v${__APP_VERSION__}` },
        { key: 'about', label: 'About', icon: AboutIcon, value: `v${__APP_VERSION__}` },
      ],
    },
  ].map(g => ({ ...g, items: g.items.filter(it => it.show !== false) }));

  // Desktop: Notion-style modal with sidebar nav + content pane.
  if (isDesktop) {
    // Opening Preferences fresh (panel === 'hub') lands on Account on desktop;
    // the sidebar still exposes every other panel.
    const desktopPanel = panel === 'hub' ? 'account' : panel;
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
            <nav className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-3">
              {navGroups.map(group => (
                <div key={group.title} className="flex flex-col gap-0.5">
                  <span className="px-3 pt-2 pb-1 text-label-10 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]">
                    {group.title}
                  </span>
                  {group.items.map(({ key, label, icon: Icon, badge }) => {
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
                        <span className="flex-1 text-copy-14 font-medium">{label}</span>
                        {badge && (
                          <span className="shrink-0 text-label-10 font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border border-[var(--color-brand-border)]">{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-[var(--ds-background-100)]">
            <header className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[var(--modes-border)]">
              <div className="flex flex-col gap-1">
                <h3 className="text-heading-24 font-semibold text-[var(--modes-text)] m-0">
                  {PANEL_TITLES[desktopPanel] || 'Settings'}
                </h3>
                {PANEL_SUBTITLES[desktopPanel] && (
                  <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">{PANEL_SUBTITLES[desktopPanel]}</p>
                )}
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
            <div ref={desktopScrollRef} className="flex-1 overflow-y-auto px-7 py-6">
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
      <PageHeader
        title={PANEL_TITLES[panel]}
        onBack={panel === 'hub' ? undefined : () => onChangePanel('hub')}
        onClose={onClose || onBack}
      />

      <div className="a4-container py-6 pb-20 flex flex-col gap-6">
        {panel === 'hub' && navGroups.map(group => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="px-2 text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold m-0">
              {group.title}
            </h2>
            <div className="modes-card flex flex-col p-0 overflow-hidden divide-y divide-[var(--modes-border)]">
              {group.items.map(({ key, label, icon, value }) => (
                <HubRow
                  key={key}
                  icon={icon}
                  label={label}
                  value={value}
                  onClick={() => onChangePanel(key)}
                />
              ))}
            </div>
          </section>
        ))}

        {panel !== 'hub' && renderPanel(panel)}
      </div>
    </div>
  );
}
