import { Button } from '@/ui/Button';

/**
 * The keep-awake OFFER — shown once, the first time a set is opened to read.
 *
 * ⚠ This used to be an EXPLAINER, and it explained something that stopped being
 * true. `SetlistPlayer` and `PerformanceView` acquired the wake lock
 * unconditionally (`useWakeLock(true)`), so the screen simply stayed on and
 * this sheet said why. The Reader that replaced them asks
 * `settings.keepAwake === true`, and `keepAwake` has never had an entry in
 * DEFAULT_SETTINGS — so for every user who has not been into Settings it is
 * `undefined`, and graduating the flag would have handed them a screen that
 * sleeps mid-service while this sheet promised the opposite. A switch wired at
 * one end, and the one end that was wired was the sentence describing it.
 *
 * Two things fix it, and they have to happen together:
 *   1. the sheet ASKS instead of announcing, and its primary button writes
 *      `keepAwake`;
 *   2. the wording states the real default (off), so the sheet is still true
 *      for anyone who says no.
 *
 * Owner, 2026-08-11: *"the keep awake was a bit intrusive anyway, it should be
 * a setting that's off and the user should decide if it wants it on or not."*
 * So OFF stays the default and this is where the decision is offered — at the
 * only moment it means anything, which is when you are about to read from the
 * screen for an hour. "Not now" is a real answer and it is a real button, not a
 * dismissal you have to find; the setting stays in Settings → General either
 * way, which is the second end of the switch.
 */
export default function WakeLockExplainer({ onEnable, onDecline }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 sm-onboard-screen-in shadow-2xl"
        style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--color-brand-soft)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 leading-tight">
          Keep the screen on while you play?
        </h2>
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-6 leading-relaxed">
          Your iPad, phone or laptop won&rsquo;t lock in the middle of a set. No system
          permission popup &mdash; it just works in the background. It&rsquo;s off by
          default, and you can change it any time in Settings &rarr; General.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="brand" size="lg" onClick={onEnable} className="w-full">
            Keep it on
          </Button>
          {/* A real second option, not an X in a corner. "Off by default" is
              only honest if declining is as easy as accepting. */}
          <Button variant="secondary" size="lg" onClick={onDecline} className="w-full">
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
