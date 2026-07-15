import { Button } from '../ui/Button';
import PasteTab from '../newSong/PasteTab';

// New-song mode for the editor: a big paste area up front. Paste a chord sheet
// and "Create song" transforms it into the cards (via the smart importer);
// Import/Browse hand off to the New-Song modal; "Start blank" drops straight
// into an empty chart.
export default function EditorEmptyState({ onApplyMd, onDismiss, onImport, onBrowse }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-heading-18 font-bold text-[var(--ds-gray-1000)] m-0">Start your song</h2>
            <p className="text-copy-13 text-[var(--ds-gray-600)] mt-0.5 mb-0">
              Paste a chord sheet below and it auto-formats into the editor — or start from a blank chart.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onImport && <Button variant="secondary" size="sm" onClick={onImport}>Import file</Button>}
            {onBrowse && <Button variant="secondary" size="sm" onClick={onBrowse}>Browse</Button>}
            <Button variant="ghost" size="sm" onClick={onDismiss}>Start blank</Button>
          </div>
        </div>

        {/* The paste surface — smart importer with a live .md preview. "Create
            song" applies the converted markdown, which builds the cards. */}
        <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden">
          <PasteTab onSubmit={onApplyMd} />
        </div>
      </div>
    </div>
  );
}
