import React, { useState, useEffect, useRef } from 'react';
import { FACETS } from '../../lib/songFacets';

const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// A single toggle chip for a facet value.
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
 * Unified library filter popover: tag chips (AND) + faceted metadata filters
 * (Key / Tempo / Theme / Language / Year / Scripture / Moment — OR within a
 * facet, AND across facets). State is owned by the parent (Library); this is a
 * controlled, self-opening popover.
 */
export default function LibraryFilters({
  facetOptions,
  selected,
  onToggleFacet,
  allTags = [],
  selectedTags = [],
  onToggleTag,
  activeCount = 0,
  onClearAll,
  // songsLibraryPlus: data-quality "issues" filters folded into the popover.
  issues = null,        // { active: string[], defs }
  onToggleIssue,
}) {
  const [open, setOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
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

  const activeFacets = FACETS.filter(f => facetOptions?.[f.key]?.length);
  const tq = tagQuery.toLowerCase();
  const visibleTags = (() => {
    const filtered = allTags.filter(t => t.toLowerCase().includes(tq));
    const sel = filtered.filter(t => selectedTags.includes(t));
    const unsel = filtered.filter(t => !selectedTags.includes(t));
    return { sel, unsel, total: filtered.length };
  })();

  const hasAnything = activeFacets.length > 0 || allTags.length > 0 || !!issues;
  if (!hasAnything) return null;

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
        <div className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-[300px] top-full mt-2 rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {issues && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider text-[var(--text-2)]">Issues</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(issues.defs || {}).map(([key, def]) => (
                    <Chip key={key} active={(issues.active || []).includes(key)} onClick={() => onToggleIssue?.(key)}>
                      {def.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {activeFacets.map(facet => (
              <div key={facet.key} className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider text-[var(--text-2)]">{facet.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {facetOptions[facet.key].map(({ value, count }) => (
                    <Chip
                      key={value}
                      active={(selected[facet.key] || []).includes(value)}
                      onClick={() => onToggleFacet(facet.key, value)}
                    >
                      {value}<span className="opacity-50">{count}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            ))}

            {allTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-label-11 uppercase tracking-wider text-[var(--text-2)]">Tags</span>
                {allTags.length > 8 && (
                  <input
                    type="text"
                    placeholder="Search tags…"
                    value={tagQuery}
                    onChange={e => setTagQuery(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-2)] text-copy-13 text-[var(--text-1)] placeholder:text-[var(--text-2)] outline-none focus:border-[var(--border-3)] transition-colors"
                  />
                )}
                <div className="flex flex-wrap gap-1.5">
                  {[...visibleTags.sel, ...visibleTags.unsel].slice(0, 24).map(tag => (
                    <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)}>
                      {tag}
                    </Chip>
                  ))}
                  {visibleTags.total === 0 && (
                    <span className="text-copy-13 text-[var(--text-2)]">No tags found</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => { onClearAll(); setTagQuery(''); }}
              className="shrink-0 border-t border-[var(--border-1)] px-4 py-2.5 text-copy-14 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--ds-gray-alpha-100)] transition-colors cursor-pointer bg-transparent text-center"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
