import { Button } from '@/ui/Button';

/**
 * Edit mode's own row — the only chrome the mode adds.
 *
 * The owner's shape for this element (2026-08-03): *"you press the edit and
 * then you get a couple of interactive fields? Something like that? Like the
 * whole view changes somehow?"* — so edit mode is **not a panel over the
 * chart**. The chart itself becomes editable: the tempo and time in the top bar
 * turn into fields, and each section grows a handle. This row carries only the
 * two things that have nowhere else to live — the way out, and the fork.
 *
 * That is also the strongest form of the reader's panel rule (`docs/READER.md`:
 * *a panel never covers what it changes*). The limit of that rule is not having
 * a panel at all.
 *
 * It sits in the BOTTOM sticky block beside the practice row and the nav, for
 * the reason element 12 already established: two bars at the bottom edge, never
 * three, and one sticky block rather than several fighting over the safe-area
 * inset.
 */
export default function ReaderEditBar({ onDone, onSaveAsArrangement, dirty }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 text-label-11 font-mono uppercase tracking-[0.14em]"
        style={{ color: 'var(--color-brand)' }}
      >
        Editing
      </span>

      <span className="flex-1 min-w-0" />

      {/* Option (a), the owner's pick: a button you press when you want it, NOT
          a prompt on the first edit. "Is this a correction or a new
          arrangement?" is the hardest question in the app (PLAN.md §7 #12) and
          asking it the moment someone nudges a tempo puts it at the worst
          possible time. Only offered once something has actually changed —
          forking an untouched song makes a duplicate, not an arrangement. */}
      {onSaveAsArrangement && dirty && (
        <Button size="sm" variant="secondary" onClick={onSaveAsArrangement}>
          Save as new arrangement
        </Button>
      )}
      <Button size="sm" variant="brand" onClick={onDone}>Done</Button>
    </div>
  );
}

export function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
