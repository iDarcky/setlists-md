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

function Section({ label, count = 0, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full py-1.5 cursor-pointer bg-transparent border-none text-left">
        <span className="text-label-11 uppercase tracking-wider text-[var(--modes-text-dim)] flex items-center gap-1.5">
          {label}
          {count > 0 && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold">{count}</span>}
        </span>
        <span className="text-[var(--modes-text-dim)]"><ChevronDown open={open} /></span>
      </button>
      {open && <div className="pb-1 pt-1">{children}</div>}
    </div>
  );
}

/**
 * Setlists filter popover (Service + Tags, plus Status / When / Group-by when
 * setlistsLibraryPlus). Collapsible groups + a mobile bottom sheet, matching the
 * Songs LibraryFilters. Controlled by the parent (Setlists owns the state).
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
  plus = false,
  statusFilter = 'all', onSetStatus,
  dateFilter = 'all', onSetDate,
  groupBy = null, onSetGroup, groupOptions = [],
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
  if (!hasService && allTags.length === 0 && !plus) return null;

  const activeCount = (serviceFilter !== 'all' ? 1 : 0) + selectedTags.length
    + (plus && statusFilter !== 'all' ? 1 : 0) + (plus && dateFilter !== 'all' ? 1 : 0);

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
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />
          <div className="fixed z-50 left-0 right-0 bottom-0 rounded-t-2xl sm:absolute sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-2 sm:w-[260px] sm:rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--modes-border)] sm:hidden">
              <span className="text-copy-15 font-semibold text-[var(--modes-text)]">Filters</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--modes-text-muted)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col divide-y divide-[var(--modes-border)]">
              {plus && (
                <Section label="Status" count={statusFilter !== 'all' ? 1 : 0} defaultOpen>
                  <div className="flex flex-wrap gap-1.5">
                    {[['all', 'All'], ['ready', 'Ready'], ['draft', 'Draft']].map(([val, label]) => (
                      <Chip key={val} active={statusFilter === val} onClick={() => onSetStatus?.(val)}>{label}</Chip>
                    ))}
                  </div>
                </Section>
              )}
              {plus && (
                <Section label="When" count={dateFilter !== 'all' ? 1 : 0} defaultOpen>
                  <div className="flex flex-wrap gap-1.5">
                    {[['all', 'Any time'], ['week', 'This week'], ['month', 'This month']].map(([val, label]) => (
                      <Chip key={val} active={dateFilter === val} onClick={() => onSetDate?.(val)}>{label}</Chip>
                    ))}
                  </div>
                </Section>
              )}
              {plus && groupOptions.length > 0 && (
                <Section label="Group by" defaultOpen={false}>
                  <div className="flex flex-wrap gap-1.5">
                    {groupOptions.map(([val, label]) => (
                      <Chip key={label} active={(groupBy ?? null) === val} onClick={() => onSetGroup?.(val)}>{label}</Chip>
                    ))}
                  </div>
                </Section>
              )}
              {hasService && (
                <Section label="Service" count={serviceFilter !== 'all' ? 1 : 0} defaultOpen={serviceFilter !== 'all' || serviceOptions.length <= 6}>
                  <div className="flex flex-wrap gap-1.5">
                    {[['all', 'All'], ...serviceOptions.map(s => [s, s])].map(([val, label]) => (
                      <Chip key={val} active={serviceFilter === val} onClick={() => onSetService(val)}>{label}</Chip>
                    ))}
                  </div>
                </Section>
              )}
              {allTags.length > 0 && (
                <Section label="Tags" count={selectedTags.length} defaultOpen={selectedTags.length > 0 || allTags.length <= 8}>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => (
                      <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)}>{tag}</Chip>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            {activeCount > 0 && (
              <button
                onClick={() => { onSetService('all'); onClearTags(); if (plus) { onSetStatus?.('all'); onSetDate?.('all'); } }}
                className="shrink-0 border-t border-[var(--modes-border)] px-4 py-3 text-copy-14 text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] hover:bg-[var(--modes-surface)] transition-colors cursor-pointer bg-transparent text-center"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
