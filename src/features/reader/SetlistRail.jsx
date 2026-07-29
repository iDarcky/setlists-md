import BottomSheet from '@/ui/BottomSheet';
import { SetlistList } from '@/features/performance/PerformanceSetlistSheet';

/**
 * Jump anywhere in the service — the rail, back, and on a phone this time.
 *
 * ONE list (`SetlistList`, shared with the old player so numbering, break
 * dividers and key chips stay identical) in two containers, chosen by the room
 * rather than by a setting:
 *
 *   wide   — a column pinned beside the chart, open until you close it. There
 *            is horizontal room for it, and a leader glancing at what's coming
 *            shouldn't have to open anything.
 *   narrow — the existing drag-to-dismiss bottom sheet. A 260px column on a
 *            390pt phone would leave the chart unreadable.
 *
 * Prev/next is the other half of element 10 and lives in `ReaderFooter`; this
 * is the "skip the closing song, they cut it" case.
 */
export default function SetlistRail({ open, onClose, wide, title, items, idx, onSelect }) {
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
      className="shrink-0 w-[264px] h-full overflow-y-auto no-scrollbar border-l p-2"
      aria-label="Setlist"
      style={{
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'var(--chart-bg, var(--ds-background-100))',
      }}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          className="flex-1 min-w-0 truncate text-label-11 font-mono uppercase tracking-[0.14em]"
          style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          {title || 'Setlist'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close setlist"
          className="shrink-0 bg-transparent border-none cursor-pointer p-1 text-[13px] leading-none"
          style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          ✕
        </button>
      </div>
      <SetlistList resolved={items} idx={idx} onSelect={onSelect} />
    </aside>
  );
}
