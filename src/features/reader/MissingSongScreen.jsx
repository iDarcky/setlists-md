import { Button } from '@/ui/shadcn/button';
import ReaderTopBar from './ReaderTopBar';
import { useSwipe } from './useSwipe';
import { chartSurface } from './readerSurface';
import { SAFE_BOTTOM_TOPUP } from './readerChrome';

/**
 * Element 14 — a setlist item whose song isn't here.
 *
 * This used to fall through to `BreakScreen` with a `missing` flag, which meant
 * a deleted song was announced with the same layout as a scheduled pause. On a
 * Sunday the two need to look nothing alike: one is planned, the other is a
 * problem, and the person holding the tablet has about four seconds to deal
 * with it.
 *
 * The 30-day trash is the point of this screen. Deleting a song has always been
 * recoverable (`storage.js` → `loadTrash`), but the bin lives in Settings →
 * Data, which is nowhere near the place you find out the song is gone. So when
 * the id is still in the bin, the fix is one button, here.
 *
 * Deliberately NOT offered: "remove from setlist". Editing the running order
 * from the reader mid-service is a destructive act on a shared object, made in
 * a hurry, on the worst possible evidence. Skip past it now; fix the setlist
 * afterwards.
 */
export default function MissingSongScreen({
  title, onExit, onMenu, aboveBar = null, leading = null, progress = null, onRestore, onSkip, footer, hasNext = false,
  // Element 28's ☰, docked — see BreakScreen.
  menuDock = null, menuOpen = false,
  onSwipeLeft, onSwipeRight,
}) {
  const swipeProps = useSwipe(onSwipeLeft, onSwipeRight);
  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-300))' };
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';
  const text = 'var(--chart-text, var(--ds-gray-1000))';

  return (
    <div className="h-full flex flex-col overflow-hidden" style={chartSurface} {...swipeProps}>
      {/* The same bar as a song and a break — ☰, title, ✕, and the set above it
          (owner, 2026-08-03). Losing your place in the service is the ONE thing
          the reader must not do, and that is most true on the screen that is
          already telling you something has gone wrong.

          The title is the one from the SETLIST ITEM, not the song — the song is
          what's missing. A bar reading "Song not available" tells you nothing;
          the name tells you whether it matters. */}
      <ReaderTopBar title={title || 'Missing song'} onExit={onExit} onMenu={onMenu} aboveBar={aboveBar} leading={leading} progress={progress} menuOpen={menuOpen} />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex items-center justify-center px-6">
        {/* The new look (QA 11 Nov, row 174): the app's red as a soft
            disc, the title in the app's type scale, the app's buttons. */}
        <div className="w-full max-w-sm text-center">
          <div
            className="mx-auto size-12 grid place-items-center rounded-full"
            style={{ color: 'var(--danger-text, #e5484d)', background: 'color-mix(in srgb, var(--danger-text, #e5484d) 14%, transparent)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5h.01" />
            </svg>
          </div>

          <h2 className="m-0 mt-4 text-title" style={{ color: text }}>
            {title || 'This song'} isn&rsquo;t here
          </h2>
          <p className="mt-2 mb-0 text-body" style={{ color: muted }}>
            {onRestore
              ? 'It was deleted, and it’s still in the trash. You can put it back now.'
              : 'It isn’t in your library on this device.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {onRestore && <Button onClick={onRestore}>Restore this song</Button>}
            {hasNext && <Button variant="outline" onClick={onSkip}>Skip to the next one</Button>}
          </div>
        </div>
      </div>

      {footer && (
        <div className="shrink-0 border-t" style={{ ...rule, paddingBottom: SAFE_BOTTOM_TOPUP }}>
          <div className="wide-container flex items-center gap-2 py-1">{footer}</div>
        </div>
      )}

      {/* Element 28's docked ☰ — the same 70/30 split the reader has, so the
          menu does not change shape on a break. */}
      {menuDock && (
        <div className="shrink-0 min-h-0" style={{ flex: '0 0 40%' }}>{menuDock}</div>
      )}
    </div>
  );
}
