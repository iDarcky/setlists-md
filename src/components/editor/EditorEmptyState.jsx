import { Button } from '../ui/Button';

// New-song canvas — shown in place of the Arrange structure + section cards for a
// fresh blank song. A big empty space to paste a chord sheet into (auto-formats
// into the cards, with a live preview alongside), or start blank and build
// sections by hand. Controlled: `value`/`onChange` live in the editor so the
// preview pane can render the draft as you type.
export default function EditorEmptyState({ value, onChange, onApply, onDismiss, onImport, onBrowse, metaReady = true }) {
  const canApply = (value || '').trim().length > 0 && metaReady;

  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-4 pt-3 pb-4 gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-copy-13 text-[var(--ds-gray-600)] m-0">
          {metaReady
            ? 'Paste a chord sheet to auto-format it — or start blank and add sections.'
            : 'Add a title and key above first, then paste a chord sheet to auto-format it.'}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {onImport && <Button variant="secondary" size="sm" onClick={onImport}>Import file</Button>}
          {onBrowse && <Button variant="secondary" size="sm" onClick={onBrowse}>Browse</Button>}
          <Button variant="ghost" size="sm" onClick={onDismiss}>Start blank</Button>
        </div>
      </div>

      {/* The empty space: a full-height paste area. */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden">
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={'Paste your song here…\n\n[Verse 1]\nG        D          Em       C\nAmazing grace, how sweet the sound'}
          spellCheck={false}
          className="flex-1 min-h-[220px] w-full bg-transparent p-4 text-copy-14 leading-relaxed text-[var(--ds-gray-1000)] resize-none outline-none font-mono whitespace-pre"
        />
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--ds-gray-300)]">
          <span className="text-label-11 text-[var(--ds-gray-500)]">
            {!metaReady
              ? 'Set a title and key above to continue'
              : (value || '').trim()
                ? `${(value || '').split('\n').length} lines`
                : 'ChordPro, Ultimate-Guitar, OpenSong or plain lyrics'}
          </span>
          <Button variant="brand" size="sm" disabled={!canApply} onClick={onApply}>
            Turn into chart
          </Button>
        </div>
      </div>
    </div>
  );
}
