import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FACETS } from '../../lib/songFacets';
import { useMediaQuery } from '../../lib/useMediaQuery';

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

// A collapsible filter group (chevron header) — keeps long value lists (e.g. 20
// years) tucked away until opened. `count` shows active selections.
function Section({ label, count = 0, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-1.5 cursor-pointer bg-transparent border-none text-left"
      >
        <span className="text-label-11 uppercase tracking-wider text-[var(--text-2)] flex items-center gap-1.5">
          {label}
          {count > 0 && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold">{count}</span>}
        </span>
        <span className="text-[var(--text-2)]"><ChevronDown open={open} /></span>
      </button>
      {open && <div className="pb-1 pt-1">{children}</div>}
    </div>
  );
}

/**
 * Unified library filter popover: data-quality "issues" + faceted metadata +
 * tags. Groups are collapsible (so a 20-value Year list doesn't dominate), and
 * on phones the whole thing opens as a bottom sheet instead of a cramped
 * dropdown. Controlled by the parent (Library owns the state).
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
  issues = null,        // { active: string[], defs }
  onToggleIssue,
}) {
  const [open, setOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const ref = useRef(null);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    if (!open) return;
    // On desktop the dropdown is anchored to the button; close on outside click.
    // On mobile it's a portaled sheet with its own scrim, so only wire Escape.
    const onDown = (e) => { if (isDesktop && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isDesktop]);

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

  const facetCount = (key) => (selected[key] || []).length;

  const sections = (
    <>
      {issues && (
        <Section label="Issues" count={(issues.active || []).length} defaultOpen={(issues.active || []).length > 0}>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(issues.defs || {}).map(([key, def]) => (
              <Chip key={key} active={(issues.active || []).includes(key)} onClick={() => onToggleIssue?.(key)}>{def.label}</Chip>
            ))}
          </div>
        </Section>
      )}
      {activeFacets.map(facet => {
        const opts = facetOptions[facet.key];
        return (
          <Section key={facet.key} label={facet.label} count={facetCount(facet.key)} defaultOpen={facetCount(facet.key) > 0 || opts.length <= 6}>
            <div className="flex flex-wrap gap-1.5">
              {opts.map(({ value, count }) => (
                <Chip key={value} active={(selected[facet.key] || []).includes(value)} onClick={() => onToggleFacet(facet.key, value)}>
                  {value}<span className="opacity-50">{count}</span>
                </Chip>
              ))}
            </div>
          </Section>
        );
      })}
      {allTags.length > 0 && (
        <Section label="Tags" count={selectedTags.length} defaultOpen={selectedTags.length > 0 || allTags.length <= 8}>
          {allTags.length > 8 && (
            <input
              type="text"
              placeholder="Search tags…"
              value={tagQuery}
              onChange={e => setTagQuery(e.target.value)}
              className="w-full h-8 px-3 mb-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-2)] text-copy-13 text-[var(--text-1)] placeholder:text-[var(--text-2)] outline-none focus:border-[var(--border-3)] transition-colors"
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {[...visibleTags.sel, ...visibleTags.unsel].slice(0, 40).map(tag => (
              <Chip key={tag} active={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)}>{tag}</Chip>
            ))}
            {visibleTags.total === 0 && <span className="text-copy-13 text-[var(--text-2)]">No tags found</span>}
          </div>
        </Section>
      )}
    </>
  );

  const clearBtn = activeCount > 0 ? (
    <button
      onClick={() => { onClearAll(); setTagQuery(''); }}
      className="shrink-0 border-t border-[var(--border-1)] px-4 py-3 text-copy-14 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--ds-gray-alpha-100)] transition-colors cursor-pointer bg-transparent text-center"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      Clear all filters
    </button>
  ) : null;

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

      {/* Desktop: anchored dropdown. */}
      {open && isDesktop && (
        <div className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-xl overflow-hidden flex flex-col max-h-[70vh] z-50">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col divide-y divide-[var(--modes-border)]">{sections}</div>
          {clearBtn}
        </div>
      )}

      {/* Mobile: bottom sheet portaled above the app chrome (nav is z-130). */}
      {open && !isDesktop && createPortal(
        <div className="sm:hidden">
          <div className="fixed inset-0 z-[150] bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed z-[151] left-0 right-0 bottom-0 rounded-t-2xl border-t border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--modes-border)]">
              <span className="text-copy-15 font-semibold text-[var(--text-1)]">Filters</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--text-2)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col divide-y divide-[var(--modes-border)]">{sections}</div>
            {clearBtn}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
