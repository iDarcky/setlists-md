import { Button } from '../ui/Button';

// New-song canvas: one big area to paste a chord sheet into.
//
// The bar across the top is `+ Add section`, NOT import/browse/blank. Those
// three re-asked a question the user already answered in the Add-a-song panel,
// and none of them told anyone how this editor works. "Add section" does: it
// says sections exist, which is the thing a first-time user can't otherwise
// guess from an empty page.
//
// Controlled: `value`/`onChange` live in the editor so the preview pane can
// render a live parse of the draft as you type.
export default function EditorEmptyState({
  value,
  onChange,
  onApply,
  onDismiss,
  onAddSection,
  metaReady = true,
}) {
  const hasText = (value || '').trim().length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-4 pt-3 pb-4 gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-copy-13 text-[var(--ds-gray-600)] m-0">
          Paste the song here — or start by adding a section.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="secondary" size="sm" onClick={onAddSection ?? onDismiss}>
            + Add section
          </Button>
        </div>
      </div>

      {/* The empty space: a full-height paste area. */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden">
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && hasText) { e.preventDefault(); onApply(); } }}
          placeholder={'Paste the song here…'}
          spellCheck={false}
          className="flex-1 min-h-[220px] w-full bg-transparent p-4 text-copy-14 leading-relaxed text-[var(--ds-gray-1000)] resize-none outline-none font-mono whitespace-pre-wrap break-words"
        />
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--ds-gray-300)]">
          <span className="text-label-11 text-[var(--ds-gray-500)]">
            {hasText
              ? `${(value || '').split('\n').length} lines · chords land where you tap, after this`
              : 'ChordPro, Ultimate-Guitar, OpenSong or plain lyrics'}
          </span>
          {/* Converting is NOT gated on title/key any more. The paste usually
              contains both, and blocking it was how lyrics got lost: people
              typed the details, hit Save, and the text here was discarded. */}
          <Button variant="brand" size="sm" disabled={!hasText} onClick={onApply} title="⌘/Ctrl + Enter">
            Turn into chart
          </Button>
        </div>
      </div>

      {!metaReady && hasText && (
        <p className="text-label-11 text-[var(--ds-gray-500)] m-0">
          You'll need a title and key before saving — we'll fill in whatever the
          pasted sheet already says.
        </p>
      )}
    </div>
  );
}
