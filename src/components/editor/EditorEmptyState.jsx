import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import PasteTab from '../newSong/PasteTab';

function Action({ title, desc, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left p-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] hover:bg-[var(--ds-gray-100)] hover:border-[var(--ds-gray-500)] transition-colors cursor-pointer"
    >
      <span className="shrink-0 mt-0.5 text-[var(--color-brand-text)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-label-14 font-semibold text-[var(--ds-gray-1000)]">{title}</span>
        <span className="block text-copy-12 text-[var(--ds-gray-600)]">{desc}</span>
      </span>
    </button>
  );
}

// Editor empty-state for a blank song: a small chooser that brings the
// New-Song modal's power inside the editor. Paste runs the smart importer
// in-place; Import/Browse hand off to the existing modal flow.
export default function EditorEmptyState({ onApplyMd, onDismiss, onImport, onBrowse }) {
  const [showPaste, setShowPaste] = useState(false);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-heading-20 font-bold text-[var(--ds-gray-1000)] m-0">Start your song</h2>
          <p className="text-copy-13 text-[var(--ds-gray-600)] mt-1 mb-0">Paste a chord sheet to auto-format it, or start from scratch.</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Action
            title="Paste a chord sheet"
            desc="ChordPro, Ultimate-Guitar, OpenSong or plain lyrics — auto-converted."
            onClick={() => setShowPaste(true)}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>}
          />
          {onImport && (
            <Action
              title="Import a file"
              desc="Bring in .md, ChordPro or other chart files."
              onClick={onImport}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
            />
          )}
          {onBrowse && (
            <Action
              title="Browse the library"
              desc="Start from a public-domain song."
              onClick={onBrowse}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
            />
          )}
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onDismiss}>Start blank instead</Button>
        </div>
      </div>

      {showPaste && (
        <Dialog open onClose={() => setShowPaste(false)} size="xl" ariaLabel="Paste a chord sheet">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ds-gray-300)]">
            <h3 className="text-heading-16 font-semibold text-[var(--ds-gray-1000)] m-0">Paste a chord sheet</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowPaste(false)}>Cancel</Button>
          </div>
          <PasteTab onSubmit={(md) => { setShowPaste(false); onApplyMd(md); }} />
        </Dialog>
      )}
    </div>
  );
}
