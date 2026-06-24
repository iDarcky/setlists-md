import React, { useState, useEffect, useRef } from 'react';
import { availableColumns, resolveVisibleColumns, toggleColumn, defaultVisibleColumns } from '../../lib/tableColumns';

const ColumnsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Shared "Columns" popover for the list tables. Lets the user show/hide the
 * optional columns of a table; the Name/Title column is always present. State
 * lives in the parent (settings.tableColumns); this component reads the saved
 * value, resolves visibility, and emits the next id array on change.
 */
export default function ColumnsMenu({ table, context = {}, saved, onChange }) {
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

  const columns = availableColumns(table, context);
  if (columns.length === 0) return null;
  const visible = resolveVisibleColumns(table, saved, context);
  const isCustomized = saved && Array.isArray(saved[table]);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-4 rounded-lg border border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)] cursor-pointer flex items-center gap-2 text-label-14 transition-all duration-150"
        aria-haspopup="true"
        aria-expanded={open}
        title="Customize columns"
      >
        <ColumnsIcon />
        Columns
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[230px] rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden flex flex-col">
          <div className="py-1 max-h-[320px] overflow-y-auto">
            {columns.map(col => (
              <label key={col.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--bg-2)] transition-colors">
                <input
                  type="checkbox"
                  checked={visible.has(col.id)}
                  onChange={() => onChange(toggleColumn(table, saved, context, col.id))}
                  className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer"
                />
                <span className="text-copy-14 text-[var(--text-1)]">{col.label}</span>
              </label>
            ))}
          </div>
          {isCustomized && (
            <button
              onClick={() => onChange(defaultVisibleColumns(table, context))}
              className="border-t border-[var(--border-1)] px-4 py-2.5 text-copy-14 text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--ds-gray-alpha-100)] transition-colors cursor-pointer bg-transparent text-center"
            >
              Reset to default
            </button>
          )}
        </div>
      )}
    </div>
  );
}
