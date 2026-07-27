import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/ui/IconButton';

export default function ExportSetlistDialog({ onClose, onExportZip, onExportPdfOverview, onExportPdfFull }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal((
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--ds-background-200)] rounded-2xl border border-[var(--ds-gray-400)] w-full max-w-[520px] flex flex-col"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--ds-gray-300)]">
          <div className="flex-1">
            <div className="text-heading-16 text-[var(--ds-gray-1000)]">Export setlist</div>
            <div className="text-copy-12 text-[var(--ds-gray-600)] mt-0.5">
              Choose what to include in the export.
            </div>
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 p-4">
          <ExportOption
            title="PDF — Set order only"
            description="One-page running order with key, capo, tempo, and notes. Great as a runner sheet."
            badge="PDF"
            onClick={onExportPdfOverview}
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            )}
          />

          <ExportOption
            title="PDF — Full chord charts"
            description="Cover page plus every song as a full chord chart, one song per page break. Uses each song's per-setlist transpose."
            badge="PDF"
            onClick={onExportPdfFull}
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="15" y2="17" />
              </svg>
            )}
          />

          <ExportOption
            title="ZIP — Editable .md bundle"
            description="Setlist manifest plus each song as a .md file. Re-import on another device to round-trip."
            badge="ZIP"
            onClick={onExportZip}
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
              </svg>
            )}
          />
        </div>
      </div>
    </div>
  ), document.body);
}

function ExportOption({ title, description, badge, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left p-4 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] hover:border-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] transition-colors cursor-pointer"
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex items-center justify-center text-[var(--ds-gray-900)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-heading-14 text-[var(--ds-gray-1000)]">{title}</span>
          {badge && (
            <span className="text-label-10 uppercase tracking-widest text-[var(--ds-gray-700)] border border-[var(--ds-gray-400)] rounded px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </div>
        <p className="text-copy-12 text-[var(--ds-gray-700)] m-0 mt-1">{description}</p>
      </div>
    </button>
  );
}
