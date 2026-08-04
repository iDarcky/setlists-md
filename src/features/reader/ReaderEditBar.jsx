import { IconButton } from '@/ui/IconButton';
import { BAR_BUTTON, EDIT_ACCENT } from './ReaderTopBar';

/**
 * Edit mode's own row — the only chrome the mode adds.
 *
 * The owner's shape for this element (2026-08-03): *"you press the edit and
 * then you get a couple of interactive fields? Something like that? Like the
 * whole view changes somehow?"* — so edit mode is **not a panel over the
 * chart**. The chart itself becomes editable: the tempo and time in the top bar
 * turn into fields, and each section grows a handle. This row carries only what
 * has nowhere else to live — undo, the two ways out, and the fork.
 *
 * That is also the strongest form of the reader's panel rule (`docs/READER.md`:
 * *a panel never covers what it changes*). The limit of that rule is not having
 * a panel at all.
 *
 * It sits in the BOTTOM sticky block beside the practice row and the nav, for
 * the reason element 12 already established: two bars at the bottom edge, never
 * three, and one sticky block rather than several fighting over the safe-area
 * inset.
 *
 * ## Everything here is small on purpose
 *
 * Round 1 used full `Button`s and an "Editing" label. The owner: *"I don't
 * really like the done button, is too big and doesn't fit the screen,
 * especially on mobile."* Four actions cannot be four full-size buttons on a
 * 390px row. So:
 *
 *  - **Only undo is an icon**, because the curved arrow is universal.
 *  - **Everything else is text.** "Which one discards my work" and "what is an
 *    arrangement" are both questions no 16px glyph answers.
 *  - **The "Editing" label is gone.** The bar is orange; saying it again in
 *    words was the row's widest element and told nobody anything new.
 */
export default function ReaderEditBar({
  onDone, onCancel, onUndo, canUndo = false, onSaveAsArrangement, dirty,
}) {
  return (
    <div className="flex items-center gap-1.5">
      <IconButton
        size="sm"
        className={BAR_BUTTON}
        aria-label="Undo the last change"
        title="Undo"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <UndoIcon />
      </IconButton>

      {/* Option (a), the owner's pick: a button you press when you want it, NOT
          a prompt on the first edit. "Is this a correction or a new
          arrangement?" is the hardest question in the app (PLAN.md §7 #12) and
          asking it the moment someone nudges a tempo puts it at the worst
          possible time. Only offered once something has actually changed —
          forking an untouched song makes a duplicate, not an arrangement.

          WORDS, not a glyph (owner, 2026-08-04: "the branch icon is not
          something that someone would understand"). Right — a git fork means
          nothing to a worship leader, and "make this a second version of the
          song instead of changing this one" is not a concept any 16px symbol
          carries. It is also the only irreversible-feeling action in the row,
          so it is the last one that should be guessed at. */}
      {onSaveAsArrangement && dirty && (
        <TextAction onClick={onSaveAsArrangement} label="New version" />
      )}

      <span className="flex-1 min-w-0" />

      {/* Cancel exists because edit mode snapshots on entry — the same snapshot
          the fork uses to put the original back. Without it, "changes the song
          immediately" would have no way out of a mistake bigger than the undo
          stack. */}
      <TextAction onClick={onCancel} label="Cancel" />
      <TextAction onClick={onDone} label="Done" primary />
    </div>
  );
}

/**
 * A small text action. NOT `Button` — `Button`'s own padding plus the global
 * `button { min-height: 44px }` on phones is exactly what made Done too big for
 * the row. `min-h-0` and a 26px box put four controls on a 390px screen.
 */
function TextAction({ onClick, label, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-0 h-[26px] shrink-0 px-2.5 rounded-lg border text-label-11 font-semibold cursor-pointer"
      style={primary
        ? { background: EDIT_ACCENT, borderColor: EDIT_ACCENT, color: '#1a1004' }
        : {
          background: 'transparent',
          borderColor: 'var(--chart-rule, var(--ds-gray-400))',
          color: 'var(--chart-subtle, var(--ds-gray-700))',
        }}
    >
      {label}
    </button>
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

/**
 * The conventional undo arrow — a full curved arrow bending back on itself, the
 * one every app draws. The first cut was a partial arc that read as "refresh"
 * (owner, 2026-08-04: "the undo icon is not the normal one"). An undo control
 * is the one thing in edit mode nobody should have to think about.
 */
function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 14 4 9 9 4" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}
