import { Button } from '../../components/ui/Button';

const INSTRUMENT_LABELS = {
  guitar: 'Guitarist',
  piano: 'Pianist',
  vocals: 'Vocalist',
  bass: 'Bassist',
  drums: 'Drummer',
  other: 'Musician',
};

function buildHeadline(instruments) {
  if (!instruments || instruments.length === 0) return 'Your setup is ready';
  if (instruments.length === 1) return `Welcome, ${INSTRUMENT_LABELS[instruments[0]] || 'Musician'}.`;
  if (instruments.length === 2) {
    return `${INSTRUMENT_LABELS[instruments[0]] || 'Musician'} & ${INSTRUMENT_LABELS[instruments[1]] || 'musician'}? We've got you.`;
  }
  return `Multi-instrumentalist? Even better.`;
}

function buildFeatures({ instruments = [], useCase }) {
  const features = [];

  if (instruments.includes('guitar')) {
    features.push({
      title: 'Capo helper enabled',
      body: 'Set a capo and the chart re-tunes around it automatically.',
    });
    features.push({
      title: 'Chord diagrams on',
      body: 'Tap any chord to see the fingering shape.',
    });
  }
  if (instruments.includes('piano')) {
    features.push({
      title: 'Keys-friendly view',
      body: 'Slash chords are highlighted so your bass voicings are clear.',
    });
  }
  if (instruments.includes('vocals')) {
    features.push({
      title: 'Vocals-first display',
      body: 'Larger lyric type and a chords-off toggle for melody focus.',
    });
  }
  if (instruments.includes('bass')) {
    features.push({
      title: 'Bass-focused chords',
      body: 'Slash chords stand out so you always know the root.',
    });
  }
  if (instruments.includes('drums')) {
    features.push({
      title: 'Drummer view',
      body: 'Section beats highlighted; chords muted so you can lock in.',
    });
  }

  if (useCase === 'sunday') {
    features.push({
      title: 'Setlist builder ready',
      body: 'Plan Sunday in minutes with per-song key overrides.',
    });
  }
  if (useCase === 'band') {
    features.push({
      title: 'Stage mode + foot pedals',
      body: 'Bluetooth pedals work out of the box. Screen stays awake.',
    });
  }
  if (useCase === 'gigs') {
    features.push({
      title: 'Stage mode + foot pedals',
      body: 'Bluetooth pedals work out of the box. Screen stays awake.',
    });
  }

  // Always-on essentials
  features.push({
    title: 'Transpose any song, any time',
    body: 'Tap a key — chords shift, lyrics stay put.',
  });
  features.push({
    title: 'Works fully offline',
    body: 'Your library lives on your device. No internet needed.',
  });

  // Cap to 5 to keep the list scannable
  return features.slice(0, 5);
}

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline className="sm-onboard-check-draw" points="20 6 9 17 4 12" />
  </svg>
);

export default function PersonalizedSetup({ instruments, useCase, onContinue, onBack }) {
  const headline = buildHeadline(instruments);
  const features = buildFeatures({ instruments, useCase });

  return (
    <div className="min-h-screen bg-[var(--ds-background-200)] flex flex-col items-center px-5 py-8 relative overflow-x-hidden sm-onboard-screen-in">
      <div
        aria-hidden="true"
        className="absolute pointer-events-none w-[700px] h-[700px] rounded-full"
        style={{
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, var(--color-brand-soft) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center mt-8 flex-1">
        <div className="text-label-11 text-[var(--ds-gray-600)] uppercase tracking-widest mb-3">Step 3 of 3</div>

        {/* Sparkle */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 sm-onboard-tile-bounce"
          style={{ background: 'var(--color-brand-soft)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2z" />
            <path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9L19 14z" />
          </svg>
        </div>

        <h1 className="text-heading-28 text-[var(--ds-gray-1000)] text-center m-0 leading-tight">
          {headline}
        </h1>
        <p className="text-copy-14 text-[var(--ds-gray-600)] text-center mt-2 max-w-xs">
          We've tuned the app for you. Here's what's ready:
        </p>

        <div
          className="mt-7 w-full rounded-2xl border overflow-hidden"
          style={{ background: 'var(--ds-background-100)', borderColor: 'var(--ds-gray-400)' }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-start gap-3"
              style={i > 0 ? { borderTop: '1px solid var(--ds-gray-300)' } : {}}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--color-brand)', color: 'white' }}
              >
                {CHECK}
              </div>
              <div>
                <div className="text-copy-14 font-semibold text-[var(--ds-gray-1000)]">{f.title}</div>
                <div className="text-label-12 text-[var(--ds-gray-600)] mt-0.5">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md flex items-center gap-3 mt-6 mb-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>Back</Button>
        )}
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          className="flex-1"
        >
          Take me to my songs →
        </Button>
      </div>
    </div>
  );
}
