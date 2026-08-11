import { Button } from '@/ui/Button';

/**
 * What "live" means — said once, the first time you go there.
 *
 * ⚠ This exists because the owner named the fold's one real weakness before
 * choosing it (2026-08-11): *"the number 11 is the best but is not
 * understandable from the 1st time. The only way it's to do a popup the first
 * time a user open stage view and teach them."*
 *
 * So the fold is not asked to explain itself. It is asked to be unmistakable
 * ONCE YOU KNOW, and this is where you find out — which is a fair trade for a
 * mark that costs the song title nothing.
 *
 * Three rules it follows, all learned from the sheet it replaces:
 *
 *  1. **Once per ACCOUNT, not per device.** The wake-lock sheet was per-device
 *     and the owner met it on every branch preview: *"Every time I test a new
 *     branch I get the intro and it's not how it's supposed to be."*
 *     `seenLiveIntro` is a portable preference.
 *  2. **It fires when the thing happens**, not at the start of an unrelated
 *     session — you have just gone live, so it is describing the screen you are
 *     looking at.
 *  3. **It says what was taken away.** Going live removes five capabilities at
 *     once; a sheet that only said "you're live now" would leave someone
 *     hunting for the metronome that is no longer there.
 */
export default function LiveIntro({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="You're live"
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        style={{ background: 'var(--ds-background-100)', border: '1px solid var(--ds-gray-400)' }}
      >
        {/* The mark itself, in the corner of the sheet — the same shape, in the
            same corner, at the same size it will be on the reader. Showing it
            beats describing it. */}
        <span
          aria-hidden="true"
          className="absolute top-0 right-0"
          style={{ width: 0, height: 0, borderTop: '30px solid #e5484d', borderLeft: '30px solid transparent' }}
        />

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 leading-tight">
          You&rsquo;re live
        </h2>
        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-4 leading-relaxed">
          The red corner means the reader is set up for a service. It stays there
          the whole time, and it&rsquo;s the only thing on screen that changes.
        </p>

        <ul className="text-copy-14 text-[var(--ds-gray-600)] m-0 mb-5 pl-5 flex flex-col gap-1.5">
          <li>The click, editing and note-writing are put away.</li>
          <li>The screen stays awake on its own.</li>
          <li>You can still change key &mdash; it just won&rsquo;t be saved to the setlist.</li>
          <li>There&rsquo;s no <span aria-hidden="true">&#10005;</span> to press by accident. Leave from the menu.</li>
        </ul>

        <Button variant="brand" size="lg" onClick={onClose} className="w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}
