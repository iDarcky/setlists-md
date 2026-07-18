import React, { useState, useEffect, useRef } from 'react';
import { CARD_FIELDS, resolveCardFields, toggleCardField, defaultCardFields } from '../../lib/cardFields';

const SlidersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);
const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * "Card fields" popover — pick which details appear on the Card/Compact list
 * cards. Mirrors ColumnsMenu but for the card views. State is owned by the
 * parent (a per-device localStorage array); this reads it, resolves visibility,
 * and emits the next id array on change.
 */
export default function CardFieldsMenu({ kind, saved, onChange, label = 'Card' }) {
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

  const fields = CARD_FIELDS[kind] || [];
  if (fields.length === 0) return null;
  const visible = resolveCardFields(kind, saved);
  const isCustomized = Array.isArray(saved);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-4 rounded-lg border border-[var(--modes-border)] text-[var(--modes-text)] bg-[var(--modes-surface)] hover:bg-[var(--modes-surface-strong)] cursor-pointer flex items-center gap-2 text-label-14 transition-all duration-150"
        aria-haspopup="true"
        aria-expanded={open}
        title="Choose what shows on cards"
      >
        <SlidersIcon />
        {label}
        <ChevronDown open={open} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-[240px] top-full mt-2 rounded-xl border border-[var(--modes-border)] bg-[var(--ds-background-100)] shadow-lg z-50 overflow-hidden flex flex-col">
          <div className="py-1 max-h-[320px] overflow-y-auto">
            {fields.map(f => (
              <label key={f.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--bg-2)] transition-colors">
                <input
                  type="checkbox"
                  checked={visible.has(f.id)}
                  onChange={() => onChange(toggleCardField(kind, saved, f.id))}
                  className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer"
                />
                <span className="text-copy-14 text-[var(--text-1)]">{f.label}</span>
              </label>
            ))}
          </div>
          {isCustomized && (
            <button
              onClick={() => onChange(defaultCardFields(kind))}
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
