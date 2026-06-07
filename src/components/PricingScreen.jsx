import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../auth/supabase';
import { useAuth } from '../auth/useAuth';

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Pull a personalized one-liner based on the onboarding quiz answers so
// the upsell speaks directly to the user instead of reading like a generic
// pricing page.
function buildPersonalHook({ instruments = [], useCase }) {
  if (instruments.includes('guitar')) {
    return 'Paste from ChordPro, OpenSong, or chord-over-lyric text and your songbook imports in minutes.';
  }
  if (instruments.includes('piano') || instruments.includes('keys')) {
    return 'ChordPro and plain-text scores convert into clean setlists.md charts automatically.';
  }
  if (instruments.includes('vocals')) {
    return 'Your transpositions sync the moment you set them — every device shows the same key.';
  }
  if (instruments.includes('drums')) {
    return 'Stage layouts that keep your section counts and feel-marks in sight, on every device.';
  }
  if (useCase === 'sunday') {
    return "Plan Sunday's setlist on one device, run the band rehearsal on another. Done.";
  }
  if (useCase === 'band') {
    return "Spaces let your whole band see the same charts in real time during rehearsals.";
  }
  return 'Your library follows you to every device, with end-to-end encryption.';
}

// Two audiences: solo musicians (Free / Pro / Sync) and teams (Band / Church).
// Prices are easy to tweak here — they're the single source for the cards.
function buildTiers() {
  return [
    {
      id: 'free',
      group: 'solo',
      name: 'Free',
      price: '$0',
      interval: '',
      altPrice: 'forever',
      tagline: 'Everything you need to play',
      featured: false,
      badge: null,
      features: [
        'Full editor — Visual, Form & Raw',
        'Unlimited songs & setlists',
        'Transpose, capo & Nashville numbers',
        'Chord diagrams & guitar tabs',
        'Export & import as .md / .zip',
        'Works fully offline',
      ],
      cta: 'Your current plan',
      ctaVariant: 'secondary',
      ctaAction: 'back',
    },
    {
      id: 'pro',
      group: 'solo',
      name: 'Pro',
      price: '$25',
      interval: '',
      altPrice: 'one-time · yours forever',
      tagline: 'Own it. Bring your own cloud.',
      featured: false,
      badge: '⭐ Best value',
      features: [
        'Bring your own cloud — Google Drive (Dropbox & OneDrive soon)',
        'Files live in your own cloud folder',
        'Smart Import — ChordPro, OpenSong, chord-over-lyric',
        'Advanced layout — themes, colours, fonts',
        'Multiple arrangements per song',
        'Pay once — no subscription',
        'Everything in Free',
      ],
      cta: 'Buy Pro',
      ctaVariant: 'brand',
      ctaAction: 'pro',
    },
    {
      id: 'sync',
      group: 'solo',
      name: 'Sync',
      price: '$5',
      interval: '/mo',
      altPrice: 'or $48/yr',
      tagline: 'Hosted cloud — just works',
      featured: false,
      badge: null,
      features: [
        'Hosted cloud sync — zero setup',
        'Automatic backups across all devices',
        '30-day version history',
        'Web access from any browser',
        'Multiple arrangements per song',
        'Everything in Pro',
      ],
      cta: 'Start free trial',
      ctaVariant: 'brand',
      ctaAction: 'sync',
    },
    {
      id: 'band',
      group: 'team',
      name: 'Band',
      price: '$15',
      interval: '/mo',
      altPrice: 'up to 10 members',
      tagline: 'Shared library for your whole band',
      featured: true,
      badge: '🔥 Most popular',
      features: [
        'Shared song library (up to 10 members)',
        'Real-time setlist push',
        'Member roles — admin, editor, viewer',
        'Rehearsal mode',
        'All Pro features for every member',
        'Service planning (rolling out)',
      ],
      cta: 'Start free trial',
      ctaVariant: 'brand',
      ctaAction: 'band',
    },
    {
      id: 'church',
      group: 'team',
      name: 'Church',
      price: '$25',
      interval: '/mo',
      altPrice: 'up to 30 members · +$2/seat after',
      tagline: 'For multi-service churches',
      featured: false,
      badge: null,
      features: [
        'Up to 30 members',
        'Multi-service setlist management',
        'Extra seats at $2/member/mo',
        'Service planning (rolling out)',
        'Priority support',
        'Everything in Band',
      ],
      cta: 'Start free trial',
      ctaVariant: 'secondary',
      ctaAction: 'church',
    },
  ];
}

export default function PricingScreen({ onBack, onSignIn, settings }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(null);

  const tiers = buildTiers();
  const personalHook = buildPersonalHook({
    instruments: settings?.quizInstruments || [],
    useCase: settings?.quizUseCase,
  });

  const soloTiers = tiers.filter(t => t.group === 'solo');
  const teamTiers = tiers.filter(t => t.group === 'team');

  const handleTierAction = (action) => {
    if (action === 'pro' || action === 'sync' || action === 'band' || action === 'church') {
      onSignIn?.();
      return;
    }
    onBack?.();
  };

  const submitWaitlist = async (e) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Sign-up is temporarily unavailable.');
      const { error: insertErr } = await supabase
        .from('pro_waitlist')
        .insert({ email: email.trim().toLowerCase() });
      if (insertErr && insertErr.code !== '23505') throw insertErr;
      setJoined(true);
    } catch (err) {
      setError(err.message || 'Could not join the waitlist.');
    } finally {
      setBusy(false);
    }
  };

  const renderCard = (tier) => (
    <div
      key={tier.id}
      className={`relative rounded-2xl p-5 flex flex-col gap-4 ${tier.featured ? 'modes-card-strong' : 'modes-card'}`}
      style={tier.featured ? {
        borderColor: 'var(--color-brand)',
        boxShadow: '0 0 0 1px var(--color-brand), 0 8px 32px var(--color-brand-border)',
      } : {}}
    >
      {(tier.featured || tier.badge) && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-label-11 font-semibold uppercase tracking-widest whitespace-nowrap"
          style={{ background: tier.featured ? 'var(--color-brand)' : 'var(--modes-surface-strong)', color: tier.featured ? 'white' : 'var(--modes-text)' }}
        >
          {tier.badge || 'Most Popular'}
        </div>
      )}

      <div>
        <div className="text-copy-15 font-semibold text-[var(--modes-text)]">{tier.name}</div>
        <div className="text-label-12 text-[var(--modes-text-muted)] mt-0.5">{tier.tagline}</div>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-heading-32 font-bold text-[var(--modes-text)]">{tier.price}</span>
          {tier.interval && (
            <span className="text-copy-14 text-[var(--modes-text-muted)]">{tier.interval}</span>
          )}
        </div>
        {tier.altPrice && (
          <div className="text-label-11 text-[var(--modes-text-dim)] mt-0.5">{tier.altPrice}</div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {tier.features.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5 text-copy-13 text-[var(--modes-text)]">
            <div
              className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: tier.featured ? 'var(--color-brand)' : 'var(--modes-surface-strong)',
                color: tier.featured ? 'white' : 'var(--color-brand)',
              }}
            >
              {CHECK}
            </div>
            <span>{f}</span>
          </div>
        ))}
      </div>

      <Button
        variant={tier.ctaVariant}
        size="md"
        onClick={() => handleTierAction(tier.ctaAction)}
        className="mt-auto w-full"
      >
        {tier.cta}
      </Button>
    </div>
  );

  return (
    <div data-theme-variant="modes" className="min-h-full">
      <div className="flex items-start justify-center px-4 py-6 sm:py-10 pb-20">
        <div className="w-full max-w-5xl flex flex-col gap-6">
          {/* Hero */}
          <div className="modes-card-strong p-6 sm:p-8 flex flex-col gap-3 text-center">
            <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 leading-tight">
              Upgrade your plan.
            </h1>
            <p className="text-copy-15 text-[var(--modes-text-muted)] m-0 max-w-lg mx-auto">
              {personalHook}
            </p>
          </div>

          {/* Early access — billing isn't live yet, capture intent */}
          <div className="modes-card p-5">
            <div className="text-label-11 font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-brand)' }}>
              Early access
            </div>
            <h3 className="text-heading-18 text-[var(--modes-text)] m-0 mb-1 font-semibold">
              Billing goes live in v1.1
            </h3>
            <p className="text-copy-13 text-[var(--modes-text-muted)] m-0 mb-4">
              Billing isn't live yet. Drop your email and we'll let you know the moment it is.
            </p>

            {joined ? (
              <div className="text-copy-14 text-[var(--modes-text)]">
                You're on the list. We'll email <strong>{email}</strong> the moment billing ships.
              </div>
            ) : (
              <form onSubmit={submitWaitlist} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1"
                />
                <Button type="submit" variant="brand" disabled={busy || !email}>
                  {busy ? 'Joining…' : 'Notify me'}
                </Button>
              </form>
            )}
            {error && (
              <div className="text-copy-13 mt-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-1000)' }}>
                {error}
              </div>
            )}
          </div>

          {/* Solo tiers */}
          <div className="flex flex-col gap-3">
            <div className="text-label-11 font-semibold uppercase tracking-widest text-[var(--modes-text-dim)] px-1">
              For solo musicians
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {soloTiers.map(renderCard)}
            </div>
          </div>

          {/* Team tiers */}
          <div className="flex flex-col gap-3">
            <div className="text-label-11 font-semibold uppercase tracking-widest text-[var(--modes-text-dim)] px-1">
              For bands & churches
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {teamTiers.map(renderCard)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
