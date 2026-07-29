import { IconButton } from '@/ui/IconButton';
import NoteContent from '@/ui/NoteContent';

/**
 * A break, read through the reader.
 *
 * Same shell as a song — chart theme, top bar with the exit on the right, the
 * SAME footer pinned to the bottom — so moving through a service never changes
 * shape. The old version was a bordered card floating in the middle with the
 * exit stranded on the left of its own pager, which read as a different app.
 *
 * The break itself is set like a title page rather than a card: the reader has
 * no boxes anywhere else, and a break is a rest, not an object.
 */
export default function BreakScreen({
  label, duration, note, missing = false, onExit, footer,
}) {
  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-300))' };
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        background: 'var(--chart-bg, var(--ds-background-100))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
      }}
    >
      {/* Element 1, reduced to what a break has: a name and the way out. */}
      <div className="shrink-0 border-b" style={rule}>
        <div className="wide-container flex items-center gap-2 py-1.5">
          <span
            className="flex-1 min-w-0 truncate text-label-13 font-semibold"
            style={{ color: 'var(--chart-text, #111111)' }}
          >
            {missing ? 'Song not available' : (label || 'Break')}
          </span>
          {onExit && (
            <IconButton size="sm" aria-label="Exit" onClick={onExit} style={{ color: muted }}>
              ✕
            </IconButton>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div
            className="text-label-11 font-mono uppercase tracking-[0.18em]"
            style={{ color: muted }}
          >
            {missing ? 'Missing' : 'Break'}
          </div>

          <div className="mt-2 text-heading-24 font-semibold" style={{ color: 'var(--chart-text, #111111)' }}>
            {missing ? 'Song not available' : (label || 'Break')}
          </div>

          {!missing && duration && (
            <div className="mt-3 font-mono font-bold text-[28px] leading-none" style={{ color: 'var(--chord)' }}>
              {duration}
              <span className="ml-1.5 text-[13px] font-medium" style={{ color: muted }}>min</span>
            </div>
          )}

          {missing && (
            <p className="mt-3 text-copy-13 m-0" style={{ color: muted }}>
              This song isn't in your library on this device.
            </p>
          )}

          {!missing && note && (
            <div
              className="mt-6 pt-5 border-t text-copy-13 text-left"
              style={{ ...rule, color: muted }}
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
          <div className="wide-container flex items-center gap-2 py-1.5">{footer}</div>
        </div>
      )}
    </div>
  );
}
