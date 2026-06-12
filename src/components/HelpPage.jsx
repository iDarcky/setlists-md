import { useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import PageHeader from './ui/PageHeader';

const Section = ({ icon, title, children }) => (
  <Card className="flex flex-col gap-0 p-0 overflow-hidden border-[var(--ds-gray-400)]">
    <div className="flex items-center gap-3 px-5 py-4 bg-[var(--ds-background-100)] border-b border-[var(--ds-gray-200)]">
      <span className="text-xl">{icon}</span>
      <h3 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 font-semibold">{title}</h3>
    </div>
    <div className="px-5 py-4 bg-[var(--ds-background-100)] text-copy-14 text-[var(--ds-gray-900)] leading-relaxed flex flex-col gap-3">
      {children}
    </div>
  </Card>
);

const Step = ({ number, text }) => (
  <div className="flex gap-3 items-start">
    <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-brand)] text-white text-label-12 font-bold flex items-center justify-center mt-0.5">{number}</span>
    <span>{text}</span>
  </div>
);

const Tip = ({ children }) => (
  <div className="flex gap-2 items-start px-4 py-3 rounded-lg bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)]">
    <span className="shrink-0 mt-0.5">💡</span>
    <span className="text-copy-13 text-[var(--ds-gray-900)]">{children}</span>
  </div>
);

export default function HelpPage({ onBack, onMarkSeen }) {
  // Mark help as seen on mount
  useEffect(() => {
    onMarkSeen?.();
  }, []);

  return (
    <div className="min-h-screen material-page pb-8">
      <PageHeader title="Welcome to setlists.md" onClose={onBack} />

      <div className="a4-container py-8 flex flex-col gap-6">

        {/* Intro */}
        <div className="px-2 pb-2">
          <p className="text-copy-16 text-[var(--ds-gray-700)] leading-relaxed max-w-lg m-0">
            setlists.md is a free, offline-first chord chart app built for worship teams.
            Your songs are stored as simple markdown files — no accounts, no subscriptions, no lock-in.
          </p>
        </div>

        {/* Getting Started */}
        <Section icon="🚀" title="Getting Started">
          <Step number="1" text="Open the Library tab — you'll find 3 demo songs to explore." />
          <Step number="2" text="Tap any song to open its chord chart. Try transposing with the ▲/▼ buttons." />
          <Step number="3" text="Create your first song by tapping New Song on the Dashboard or Library." />
          <Tip>You can import existing .md or .txt chord sheets — just use the Import button in the Library.</Tip>
        </Section>

        {/* Song Editor */}
        <Section icon="✏️" title="The Song Editor">
          <p className="m-0">The editor has three modes, each suited to a different workflow:</p>
          <div className="flex flex-col gap-2 pl-1">
            <div><strong className="text-[var(--ds-gray-1000)]">Arrange</strong> — Visual canvas: tap a lyric to place chords, reorder sections, insert tabs and key changes anywhere. Best for everyday editing.</div>
            <div><strong className="text-[var(--ds-gray-1000)]">Advanced</strong> — Plain markdown editor for the song body. Best for power users who want full control.</div>
            <div><strong className="text-[var(--ds-gray-1000)]">Tabs</strong> — A library of reusable tab blocks you create once and place into any section. Best for solos and riffs.</div>
          </div>
          <Tip>Chords are written inline with square brackets: <code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-[var(--ds-gray-1000)] text-copy-13">[Am]</code> before the word they&apos;re played on.</Tip>
        </Section>

        {/* Chord Chart Syntax */}
        <Section icon="🎵" title="Chord Chart Syntax">
          <p className="m-0">Your songs use a simple markdown format:</p>
          <div className="px-4 py-3 rounded-lg bg-[var(--ds-gray-200)] font-mono text-copy-13 text-[var(--ds-gray-1000)] flex flex-col gap-1 overflow-x-auto">
            <span className="text-[var(--ds-gray-600)]">---</span>
            <span>title: Amazing Grace</span>
            <span>key: G</span>
            <span>tempo: 72</span>
            <span className="text-[var(--ds-gray-600)]">---</span>
            <span className="mt-1 text-[var(--color-brand)]">## Verse 1</span>
            <span>[G]Amazing [G/B]grace, how [C]sweet the [G]sound</span>
          </div>
          <div className="flex flex-col gap-2 pl-1">
            <div><code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13">## Section Name</code> — Creates a section (Verse, Chorus, Bridge, etc.)</div>
            <div><code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13">&gt; Band cue</code> — Adds a note visible to the whole band</div>
            <div><code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13">{'{!note}'}</code> — Inline performance pill (e.g., <em>bass out</em>)</div>
            <div><code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13">{'{modulate: +2}'}</code> — Key change marker</div>
          </div>
        </Section>

        {/* Building Setlists */}
        <Section icon="📋" title="Building Setlists">
          <Step number="1" text="Go to the Setlists tab and tap New Setlist." />
          <Step number="2" text="Give it a name, date, and time — then add songs from your library." />
          <Step number="3" text="Drag to reorder. Set per-song transpose and add band notes." />
          <Step number="4" text="Hit Play to enter Live Mode — full-screen, swipe or pedal through songs." />
          <Tip>Export setlists as .zip bundles to share with your team. They can import them on their own device.</Tip>
        </Section>

        {/* Live Mode */}
        <Section icon="🎸" title="Live Mode">
          <p className="m-0">Live Mode is designed for the stage — large touch targets, minimal distractions.</p>
          <div className="flex flex-col gap-2 pl-1">
            <div><strong className="text-[var(--ds-gray-1000)]">Swipe</strong> or use <strong className="text-[var(--ds-gray-1000)]">arrow keys</strong> to navigate between songs.</div>
            <div><strong className="text-[var(--ds-gray-1000)]">Bluetooth pedals</strong> work out of the box — map them in Settings → Pedal Mapping.</div>
            <div>Transpose and column layout adjust per-song in the setlist builder.</div>
          </div>
          <Tip>For best results, install the app on your tablet via &ldquo;Add to Home Screen&rdquo; for true full-screen mode.</Tip>
        </Section>

        {/* Cloud Sync */}
        <Section icon="☁️" title="Cloud Sync">
          <p className="m-0">Connect your own cloud storage to sync songs across devices:</p>
          <div className="flex flex-col gap-2 pl-1">
            <div><strong className="text-[var(--ds-gray-1000)]">Google Drive</strong>, <strong className="text-[var(--ds-gray-1000)]">Dropbox</strong>, or <strong className="text-[var(--ds-gray-1000)]">OneDrive</strong> — your files stay in your account.</div>
            <div>Go to <strong className="text-[var(--ds-gray-1000)]">Settings → Cloud Sync</strong> to connect.</div>
            <div>Sync happens automatically on startup and when you switch tabs.</div>
          </div>
          <Tip>On Safari/iOS, always use &ldquo;Add to Home Screen&rdquo; to prevent Safari from deleting your local data after 7 days.</Tip>
        </Section>

        {/* Display Modes */}
        <Section icon="👁️" title="Display Modes">
          <p className="m-0">Customize what each musician sees:</p>
          <div className="flex flex-col gap-2 pl-1">
            <div><strong className="text-[var(--ds-gray-1000)]">Full</strong> — Chords, lyrics, notes, tabs — everything visible.</div>
            <div><strong className="text-[var(--ds-gray-1000)]">Vocals</strong> — Hides chords, emphasizes lyrics and structure.</div>
            <div><strong className="text-[var(--ds-gray-1000)]">Drums</strong> — Minimalist: section headers and dynamics only.</div>
          </div>
          <p className="m-0 text-copy-13 text-[var(--ds-gray-600)]">Set your default in Settings → Chart Preferences → Display Mode.</p>
        </Section>

        {/* Tips & Tricks */}
        <Section icon="⚡" title="Tips & Tricks">
          <div className="flex flex-col gap-2 pl-1">
            <div>Use the <strong className="text-[var(--ds-gray-1000)]">Smart Import</strong> (paste icon) to convert plain text chord sheets into the correct format automatically.</div>
            <div>Add <code className="px-1.5 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13">{'{tab}...{/tab}'}</code> blocks for guitar tab notation inside any section.</div>
            <div>The <strong className="text-[var(--ds-gray-1000)]">Structure Ribbon</strong> at the top of each chart shows the song flow at a glance.</div>
            <div>Capo shapes are calculated automatically — set the capo in the song metadata.</div>
          </div>
        </Section>

        {/* Footer */}
        <div className="px-2 pt-4 pb-8 text-center">
          <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-4">
            Have questions or feedback? Use the feedback button in the bottom-left corner.
          </p>
          <Button variant="brand" onClick={onBack} className="px-8">
            Start Using the App
          </Button>
        </div>
      </div>
    </div>
  );
}
