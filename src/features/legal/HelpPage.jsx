import { useEffect } from 'react';
import { Button } from '@/ui/Button';
import PageHeader from '@/ui/PageHeader';
import FeedbackButton from './FeedbackButton';

// ─── Building blocks ─────────────────────────────────────────────────────

const Section = ({ id, icon, title, children }) => (
  <section id={id} className="modes-card p-0 overflow-hidden scroll-mt-20">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--modes-border)]">
      <span className="text-xl" aria-hidden="true">{icon}</span>
      <h3 className="text-heading-16 text-[var(--modes-text)] m-0 font-semibold">{title}</h3>
    </div>
    <div className="px-5 py-4 text-copy-14 text-[var(--modes-text)] leading-relaxed flex flex-col gap-3">
      {children}
    </div>
  </section>
);

const Step = ({ number, children }) => (
  <div className="flex gap-3 items-start">
    <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-brand)] text-white text-label-12 font-bold flex items-center justify-center mt-0.5">{number}</span>
    <span>{children}</span>
  </div>
);

const Item = ({ term, children }) => (
  <div><strong className="text-[var(--modes-text)]">{term}</strong> — {children}</div>
);

const Tip = ({ children }) => (
  <div className="flex gap-2 items-start px-4 py-3 rounded-lg bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)]">
    <span className="shrink-0 mt-0.5" aria-hidden="true">💡</span>
    <span className="text-copy-13 text-[var(--modes-text)]">{children}</span>
  </div>
);

const Code = ({ children }) => (
  <code className="px-1.5 py-0.5 rounded bg-[var(--modes-surface-strong)] text-[var(--modes-text)] text-copy-13">{children}</code>
);

const CATEGORIES = [
  { id: 'help-start', label: 'Getting started' },
  { id: 'help-editor', label: 'Writing songs' },
  { id: 'help-charts', label: 'Charts & display' },
  { id: 'help-setlists', label: 'Setlists' },
  { id: 'help-live', label: 'Practice & Live' },
  { id: 'help-teams', label: 'Spaces' },
  { id: 'help-sync', label: 'Sync & data' },
];

export default function HelpPage({ onBack, onMarkSeen }) {
  // Mark help as seen on mount.
  useEffect(() => {
    onMarkSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-theme-variant="modes" className="min-h-screen material-page pb-8">
      <PageHeader title="Help & guide" onClose={onBack} />

      <div className="a4-container py-8 flex flex-col gap-6">
        {/* Intro */}
        <div className="px-2">
          <p className="text-copy-16 text-[var(--modes-text-muted)] leading-relaxed max-w-lg m-0">
            setlists.md is an offline-first chord-chart app for worship teams. Songs are
            stored on your device as simple markdown — install it to your home screen and it
            works full-screen, even with no signal.
          </p>
        </div>

        {/* Quick category nav */}
        <div className="flex gap-2 flex-wrap px-2">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => jumpTo(c.id)}
              className="px-3 py-1.5 rounded-full text-label-12 font-medium bg-[var(--modes-surface)] border border-[var(--modes-border)] text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] transition-colors cursor-pointer"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Getting started */}
        <Section id="help-start" icon="🚀" title="Getting started">
          <Step number="1">Open <strong className="text-[var(--modes-text)]">Songs</strong> from the bottom bar — a few demo songs are there to explore.</Step>
          <Step number="2">Tap a song to open its chart, then transpose with the key picker in the header.</Step>
          <Step number="3">Tap <strong className="text-[var(--modes-text)]">New Song</strong> (on Home or Songs). The <strong className="text-[var(--modes-text)]">New song</strong> dialog lets you start <strong className="text-[var(--modes-text)]">Blank</strong>, <strong className="text-[var(--modes-text)]">Import</strong> a file, <strong className="text-[var(--modes-text)]">Paste</strong> a chord sheet, or <strong className="text-[var(--modes-text)]">Browse</strong> bundled songs.</Step>
          <Tip>The <strong className="text-[var(--modes-text)]">Paste</strong> option converts an Ultimate-Guitar or ChordPro sheet into a clean chart and fills in the title and key for you.</Tip>
        </Section>

        {/* Writing songs */}
        <Section id="help-editor" icon="✏️" title="Writing songs">
          <p className="m-0">The editor has an <strong className="text-[var(--modes-text)]">Arrange</strong> and <strong className="text-[var(--modes-text)]">Advanced</strong> editing mode, plus a <strong className="text-[var(--modes-text)]">Tabs</strong> tab:</p>
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Arrange">Visual canvas — tap a lyric to drop a chord, reorder sections, and insert tabs or key changes anywhere.</Item>
            <Item term="Advanced">Plain markdown for the song body — full control for power users.</Item>
            <Item term="Tabs">A library of reusable tab blocks you build once and place into any section.</Item>
          </div>
          <p className="m-0 text-copy-13 text-[var(--modes-text-muted)]">Tap the song title to open Song details (artist, key, tempo, capo, tags…).</p>
          <p className="m-0">The underlying markdown is simple:</p>
          <div className="px-4 py-3 rounded-lg bg-[var(--modes-surface-strong)] font-mono text-copy-13 text-[var(--modes-text)] flex flex-col gap-1 overflow-x-auto">
            <span className="text-[var(--modes-text-dim)]">---</span>
            <span>title: Amazing Grace</span>
            <span>key: G</span>
            <span className="text-[var(--modes-text-dim)]">---</span>
            <span className="mt-1 text-[var(--color-brand)]">## Verse 1</span>
            <span>[G]Amazing [G/B]grace, how [C]sweet the [G]sound</span>
          </div>
          <div className="flex flex-col gap-2 pl-1">
            <div><Code>## Section</Code> — a section (Verse, Chorus, Bridge…)</div>
            <div><Code>[Am]</Code> — an inline chord, before the word it lands on</div>
            <div><Code>&gt; Band cue</Code> — a note for the whole band</div>
            <div><Code>{'{!note}'}</Code> — an inline performance pill (e.g. <em>bass out</em>)</div>
            <div><Code>{'{modulate: +2}'}</Code> — a key-change marker</div>
            <div><Code>{'{tab}…{/tab}'}</Code> — a guitar/bass tab block</div>
          </div>
        </Section>

        {/* Charts & display */}
        <Section id="help-charts" icon="🎵" title="Charts & display">
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Transpose & capo">Change key from the header; capo shapes are worked out automatically from the song metadata.</Item>
            <Item term="View modes">Switch between <strong className="text-[var(--modes-text)]">Chords</strong>, <strong className="text-[var(--modes-text)]">Lyrics</strong>, <strong className="text-[var(--modes-text)]">Tabs</strong>, and <strong className="text-[var(--modes-text)]">Song map</strong> (a bird&apos;s-eye flow of every section).</Item>
            <Item term="Notation">Show chords as letters, Nashville numbers, or Do-Re-Mi.</Item>
            <Item term="Roles">Pick a role (Leader, Vocalist, Bassist, Drummer…) to tailor what shows — Bassist collapses chords to root notes.</Item>
            <Item term="Structure ribbon">The scrollable bar at the top of a chart is the song flow — tap a section to jump to it.</Item>
          </div>
          <p className="m-0 text-copy-13 text-[var(--modes-text-muted)]">Set your defaults in Settings → Chart Defaults and Chart Style.</p>
        </Section>

        {/* Setlists */}
        <Section id="help-setlists" icon="📋" title="Setlists">
          <Step number="1">In <strong className="text-[var(--modes-text)]">Setlists</strong>, tap New Setlist and give it a name and date.</Step>
          <Step number="2">Add songs, drag to reorder, and add breaks between blocks.</Step>
          <Step number="3">Set a per-song key and a cue note for each item.</Step>
          <Step number="4">Open it with <strong className="text-[var(--modes-text)]">Play live</strong> or <strong className="text-[var(--modes-text)]">Practice this set</strong>, or export it.</Step>
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Share a link">Publish a read-only snapshot (with an optional expiry) and a QR code; revoke any time.</Item>
            <Item term="PDF / print">Export a one-page set order, or full chord charts for every song.</Item>
            <Item term="Bundles">Export a <Code>.zip</Code> to hand the whole set to another device.</Item>
          </div>
        </Section>

        {/* Practice & Live */}
        <Section id="help-live" icon="🎸" title="Practice & Live">
          <p className="m-0">Two stage modes share the same chart, tuned for different moments:</p>
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Practice this set">Rehearsal mode — edit cues, the song structure, and band notes as you go.</Item>
            <Item term="Play live">A locked-down performance view; it inherits the display options you set in Practice and Settings.</Item>
          </div>
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Roles">One tap applies a preset for <strong className="text-[var(--modes-text)]">Leader</strong>, <strong className="text-[var(--modes-text)]">Vocalist</strong>, <strong className="text-[var(--modes-text)]">Guitarist</strong>, <strong className="text-[var(--modes-text)]">Bassist</strong>, <strong className="text-[var(--modes-text)]">Keys</strong>, or <strong className="text-[var(--modes-text)]">Drummer</strong>.</Item>
            <Item term="Navigation">Choose how you move between songs in Settings → Navigation controls: a <strong className="text-[var(--modes-text)]">floating pill</strong>, <strong className="text-[var(--modes-text)]">header buttons</strong>, or <strong className="text-[var(--modes-text)]">swipe</strong>. Arrow keys and Bluetooth pedals always work too.</Item>
            <Item term="Setlist rail">On a landscape tablet the set sits beside the chart; on a phone tap the list icon to open it as a sheet.</Item>
            <Item term="Customize">The sliders icon opens display options without leaving the song.</Item>
          </div>
          <Tip>Install the app via &ldquo;Add to Home Screen&rdquo; for true full-screen — and the screen stays awake while you play.</Tip>
        </Section>

        {/* Teams */}
        <Section id="help-teams" icon="👥" title="Spaces & scheduling">
          <p className="m-0">A Space lets a band or church share one library:</p>
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Switch Spaces">Use the switcher in the header to move between your <strong className="text-[var(--modes-text)]">Personal Space</strong> and any team; <strong className="text-[var(--modes-text)]">+ New Space</strong> creates one.</Item>
            <Item term="Roles">Admins manage members and the library; Worship Leaders run the schedule; Members read along (Editors can edit).</Item>
            <Item term="Schedule & availability">Plan services, assign the band and vocal parts, and let members mark when they&apos;re available.</Item>
          </div>
          <p className="m-0 text-copy-13 text-[var(--modes-text-muted)]">Each Space is its own shared library — songs and setlists stay private to that team.</p>
        </Section>

        {/* Sync & data */}
        <Section id="help-sync" icon="☁️" title="Sync & your data">
          <div className="flex flex-col gap-2 pl-1">
            <Item term="Your device first">Everything works offline; your songs live in this browser&apos;s storage.</Item>
            <Item term="Personal cloud sync">Connect Google Drive, Dropbox, or OneDrive in Settings → Cloud Sync — files stay in your own account.</Item>
            <Item term="Account preferences">Signing in syncs your settings across devices.</Item>
            <Item term="Export anytime">Download your songs from Settings → Data; there&apos;s no lock-in.</Item>
          </div>
          <Tip>On iOS/Safari, always &ldquo;Add to Home Screen&rdquo; — it stops Safari clearing your local data after a week of no use.</Tip>
        </Section>

        {/* Footer */}
        <div className="px-2 pt-2 pb-8 flex flex-col items-center gap-4 text-center">
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            Still stuck, or have an idea? Send us a note.
          </p>
          <FeedbackButton variant="inline" />
          <Button variant="brand" onClick={onBack} className="px-8 mt-2">
            Back to the app
          </Button>
        </div>
      </div>
    </div>
  );
}
