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
 *   wide   — a 264px column beside the chart WHEN OPEN, and nothing at all when
 *            shut. It used to keep a 44px strip permanently docked so the chart
 *            never reflowed on opening; the owner took that trade back on
 *            2026-08-06 — *"should we remove the rail on ipad to win more
 *            space? … we don't even need the button because we can open the
 *            rail from the x/x bar at the bottom"* — and he is right about the
 *            arithmetic: on a 1024px iPad the strip was 44px of permanent
 *            chrome to hold one chevron, while the way in already existed. The
 *            counter in `ReaderFooter` opens it (`onOpenSetlist`), and the edge
 *            hotspot still does on the swipe/edge nav modes. Opening now
 *            reflows the chart, which is the price, and it is a price you only
 *            pay when you ask.
 *   narrow — the existing drag-to-dismiss bottom sheet. A 260px column on a
 *            390pt phone would leave the chart unreadable.
 *
 * Prev/next is the other half of element 10 and lives in `ReaderFooter`; this
 * is the "skip the closing song, they cut it" case.
 */
export default function SetlistRail({ open, onClose, wide, title, items, idx, onSelect, locked = false }) {
  // Nothing until asked, at every width. There is no resting state any more.
  if (!open) return null;

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
        width: 264,
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      {/* The toggle lives ON the rail, not in the top bar. The control that
          opens a panel belongs to the panel — and it keeps element 1's right
          edge for the ✕ alone, which is the one control whose position must
          never move because it is the one reached without looking. */}
      <div className="shrink-0 flex items-center gap-1 py-1.5 px-2">
        <span
          className="flex-1 min-w-0 truncate text-label-11 font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          {title || 'Setlist'}
        </span>
        <IconButton
          size="sm"
          className={BAR_BUTTON}
          aria-label="Collapse setlist"
          aria-expanded={open}
          // Inert while the song is being edited — opening the rail is one tap
          // from leaving the song with the change applied and Cancel out of
          // reach. Same reason the reader holds its ✕.
          disabled={locked}
          onClick={onClose}
        >
          <RailChevrons open={open} />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 pb-2">
        <SetlistList resolved={items} idx={idx} onSelect={onSelect} />
      </div>
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
