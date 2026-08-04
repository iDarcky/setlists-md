import BottomSheet from '@/ui/BottomSheet';
import { SetlistList } from '@/features/performance/PerformanceSetlistSheet';
import { BAR_BUTTON } from './readerChrome';
import { IconButton } from '@/ui/IconButton';

/**
 * Jump anywhere in the service — the rail, back, and on a phone this time.
 *
 * ONE list (`SetlistList`, shared with the old player so numbering, break
 * dividers and key chips stay identical) in two containers, chosen by the room
 * rather than by a setting:
 *
 *   wide   — a column pinned beside the chart, ALWAYS PRESENT: 264px open, a
 *            44px strip closed, with the toggle living in the strip. Copied
 *            from `PerformanceView`'s rail, which the owner pointed at
 *            (2026-08-04: "look at how the old chart is doing and replicate
 *            that"), because it solves the thing a pure overlay cannot — the
 *            chart never reflows when you open it, so the words do not jump
 *            mid-song. The open state is remembered per device.
 *   narrow — the existing drag-to-dismiss bottom sheet. A 260px column on a
 *            390pt phone would leave the chart unreadable.
 *
 * Prev/next is the other half of element 10 and lives in `ReaderFooter`; this
 * is the "skip the closing song, they cut it" case.
 */
export default function SetlistRail({ open, onClose, onOpen, wide, title, items, idx, onSelect, locked = false }) {
  // Wide: ALWAYS rendered, collapsed to a strip when shut. Narrow: nothing
  // until asked, because a sheet has no resting state.
  if (!wide && !open) return null;

  if (!wide) {
    return (
      <BottomSheet open onClose={onClose} title={title || 'Setlist'}>
        <SetlistList
          resolved={items}
          idx={idx}
          onSelect={(i) => { onSelect(i); onClose?.(); }}
        />
      </BottomSheet>
    );
  }

  return (
    <aside
      className="shrink-0 h-full flex flex-col border-l overflow-hidden"
      aria-label="Setlist"
      style={{
        width: open ? 264 : 44,
        transition: 'width 200ms ease',
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      {/* The toggle lives ON the rail, not in the top bar. The control that
          opens a panel belongs to the panel — and it keeps element 1's right
          edge for the ✕ alone, which is the one control whose position must
          never move because it is the one reached without looking. */}
      <div className={`shrink-0 flex items-center gap-1 py-1.5 ${open ? 'px-2' : 'justify-center px-0'}`}>
        {open && (
          <span
            className="flex-1 min-w-0 truncate text-label-11 font-mono uppercase tracking-[0.14em]"
            style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
          >
            {title || 'Setlist'}
          </span>
        )}
        <IconButton
          size="sm"
          className={BAR_BUTTON}
          aria-label={open ? 'Collapse setlist' : 'Expand setlist'}
          aria-expanded={open}
          // Inert while the song is being edited — opening the rail is one tap
          // from leaving the song with the change applied and Cancel out of
          // reach. Same reason the reader holds its ✕.
          disabled={locked}
          onClick={open ? onClose : onOpen}
        >
          <RailChevrons open={open} />
        </IconButton>
      </div>

      {/* Rendered only when open: a 44px strip cannot show a list, and keeping
          it mounted would leave a horizontally clipped column of song titles
          behind the strip. */}
      {open && (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 pb-2">
          <SetlistList resolved={items} idx={idx} onSelect={onSelect} />
        </div>
      )}
    </aside>
  );
}

/** `«` pulls the rail out, `»` pushes it back — it points the way it moves. */
function RailChevrons({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease-out' }}>
      <polyline points="15 18 9 12 15 6" />
      <polyline points="20 18 14 12 20 6" />
    </svg>
  );
}
