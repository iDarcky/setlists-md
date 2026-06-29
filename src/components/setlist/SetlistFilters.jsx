import React, { useState, useEffect, useRef } from 'react';

const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-label-12 border cursor-pointer transition-colors ${
        active
          ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--modes-surface)]'
          : 'border-[var(--modes-border)] text-[var(--modes-text)] bg-transparent hover:bg-[var(--modes-surface)]'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Unified Setlists filter popover (Service + Tags) — mirrors the Songs
 * LibraryFilters. Service is church-only (gated by `showService`); tags are a
 * multi-select. Controlled by the parent (Setlists owns the state); this is a
 * self-opening popover that works on mobile and desktop.
 */
export default function SetlistFilters({
  showService = false,
  serviceOptions = [],
  serviceFilter = 'all',
  onSetService,
  allTags = [],
  selectedTags = [],
  onToggleTag,
  onClearTags,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasService = showService && serviceOptions.length > 0;
  if (!hasService && allTags.length === 0) return null;

  const activeCount = (serviceFilter !== 'all' ? 1 : 0) + selectedTags.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`h-9 px-4 rounded-lg border cursor-pointer flex items-center gap-2 text-label-14 transition-all duration-150 ${
          activeCount > 0
            ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--modes-surface)]'
            : 'border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)]'
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {hasService && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider text-[var(--modes-text-dim)]">Service</span>
                <div className="flex flex-wrap gap-1.5">
                  {[['all', 'All'], ...serviceOptions.map(s => [s, s])].map(([val, label]) => (
                    <Chip key={val} active={serviceFilter === val} onClick={() => onSetService(val)}>{label}</Chip>
                  ))}
                </div>
              </div>
            )}

            {allTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider text-[var(--modes-text-dim)]">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map(tag => (
                    <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)}>{tag}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => { onSetService('all'); onClearTags(); }}
              className="shrink-0 border-t border-[var(--modes-border)] px-4 py-2.5 text-copy-14 text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] hover:bg-[var(--modes-surface)] transition-colors cursor-pointer bg-transparent text-center"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
