import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import {
  availableColumns,
  resolveVisibleColumns,
  toggleColumn,
  defaultVisibleColumns,
  orderedVisibleColumns,
  reorderColumns,
} from '../../lib/tableColumns';

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
const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />
  </svg>
);

/**
 * Shared "Columns" popover for the list tables. Lets the user show/hide the
 * optional columns of a table; the Name/Title column is always present. When
 * `orderable`, visible columns can be dragged to reorder (persisted in the same
 * settings.tableColumns id array). State lives in the parent; this component
 * reads the saved value, resolves visibility/order, and emits the next id array.
 */
export default function ColumnsMenu({ table, context = {}, saved, onChange, orderable = false }) {
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
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

  const orderedVisible = orderedVisibleColumns(table, saved, context);
  const hidden = columns.filter(c => !visible.has(c.id));
  const canReorder = orderable && orderedVisible.length > 1;

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const ids = orderedVisible.map(c => c.id);
    const toIndex = ids.indexOf(targetId);
    onChange(reorderColumns(table, saved, context, dragId, toIndex));
    setDragId(null);
    setDragOverId(null);
  };

  return (
    <div ref={ref} className="relative">
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
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[240px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden flex flex-col">
          <div className="py-1 max-h-[340px] overflow-y-auto">
            {canReorder && (
              <div className="px-4 pt-1.5 pb-1 text-label-11 uppercase tracking-wider text-[var(--text-2)]">Shown · drag to reorder</div>
            )}
            {(canReorder ? orderedVisible : columns).map(col => {
              const isVisible = visible.has(col.id);
              return (
                <div
                  key={col.id}
                  draggable={canReorder && isVisible}
                  onDragStart={() => canReorder && setDragId(col.id)}
                  onDragOver={(e) => { if (canReorder && dragId) { e.preventDefault(); if (dragOverId !== col.id) setDragOverId(col.id); } }}
                  onDrop={() => canReorder && onDrop(col.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-2)] transition-colors relative',
                    dragId === col.id && 'opacity-40',
                    canReorder && dragId && dragOverId === col.id && dragId !== col.id && 'before:content-[""] before:absolute before:left-2 before:right-2 before:top-0 before:h-0.5 before:rounded-full before:bg-[var(--color-brand)]',
                  )}
                >
                  {canReorder && (
                    <span className="text-[var(--text-2)] cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder"><GripIcon /></span>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => onChange(toggleColumn(table, saved, context, col.id))}
                      className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer shrink-0"
                    />
                    <span className="text-copy-14 text-[var(--text-1)] truncate">{col.label}</span>
                  </label>
                </div>
              );
            })}
            {canReorder && hidden.length > 0 && (
              <>
                <div className="px-4 pt-2 pb-1 text-label-11 uppercase tracking-wider text-[var(--text-2)]">Hidden</div>
                {hidden.map(col => (
                  <label key={col.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--bg-2)] transition-colors">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onChange(toggleColumn(table, saved, context, col.id))}
                      className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer shrink-0"
                    />
                    <span className="text-copy-14 text-[var(--text-1)] truncate">{col.label}</span>
                  </label>
                ))}
              </>
            )}
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
