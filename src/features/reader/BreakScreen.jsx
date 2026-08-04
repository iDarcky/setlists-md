import NoteContent from '@/ui/NoteContent';
import ReaderTopBar from './ReaderTopBar';
import { chartSurface } from './readerSurface';

/**
 * A break, read through the reader.
 *
 * Same `ReaderTopBar` as a song and the same footer, so moving through a
 * service never changes shape. The break is named ONCE, in the bar — an
 * eyebrow, a heading and a bar title all saying "Benedicție" is three answers
 * to a question nobody asked. The middle is what the bar cannot carry: how
 * long it runs, and what the band does during it.
 *
 * **The bar is the SAME bar** (owner, 2026-08-03: "the same header to
 * everything, the one with the ☰ and the X"). Sharing the component was never
 * enough on its own — this screen passed it three props, so the break quietly
 * lost the ☰ and, once element 8b landed, the set bar too. That is the exact
 * drift `ReaderTopBar` exists to prevent, arriving through props instead of
 * through a second component. The structure ribbon is the one thing a break
 * does NOT get: it has no sections to map.
 */
export default function BreakScreen({
  label, duration, note, onExit, onMenu, aboveBar = null, leading = null, progress = null, footer,
}) {
  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-300))' };
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';
  // `duration && …` renders a literal 0 — a break saved with no length showed
  // a stray "0" under the title.
  const mins = Number(duration) > 0 ? Number(duration) : null;
  const title = label || 'Break';

  return (
    <div className="h-full flex flex-col overflow-hidden" style={chartSurface}>
      <ReaderTopBar title={title} onExit={onExit} onMenu={onMenu} aboveBar={aboveBar} leading={leading} progress={progress} />

      {/* Centred when the break is just a length — a lone "5 min" belongs in
          the middle of the screen. TOP-aligned as soon as there is a note
          (owner, 2026-08-03): text centred vertically starts in a different
          place depending on how long it is, and a note long enough to scroll
          was starting below the fold. Reading starts at the top. */}
      <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar flex justify-center px-6 ${
        note ? 'items-start pt-10 pb-8' : 'items-center'
      }`}>
        <div className="w-full max-w-md text-center">
          {mins ? (
            <div className="font-mono font-bold text-[44px] leading-none" style={{ color: 'var(--chord)' }}>
              {mins}
              <span className="ml-2 text-[15px] font-medium" style={{ color: muted }}>min</span>
            </div>
          ) : (
            <div className="text-label-11 font-mono uppercase tracking-[0.18em]" style={{ color: muted }}>
              Break
            </div>
          )}

          {note && (
            <div
              className="mt-7 pt-6 border-t text-copy-14 text-left"
              style={{ ...rule, color: 'var(--chart-text, var(--ds-gray-1000))' }}
            >
              <NoteContent text={note} />
            </div>
          )}
        </div>
      </div>

      {footer && (
        <div
          className="shrink-0 border-t"
          style={{ ...rule, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="wide-container flex items-center gap-2 py-1">{footer}</div>
        </div>
      )}
    </div>
  );
}
