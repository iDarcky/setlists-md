import { useEffect, useMemo, useRef, useState } from 'react';

// Compact label for a section name. "Verse 1" -> "V1", "Pre Chorus 2"
// -> "PC2", "Chorus" -> "C". Keep trailing numbers but strip the words.
function shortCode(name) {
  if (!name) return '';
  const m = name.match(/^(.*?)\s*(\d+)?$/);
  const base = (m?.[1] || name).trim();
  const num = m?.[2] || '';
  const initials = base
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return initials + num;
}

// A draggable, Proclaim-style chip editor for `structure: [...]`.
//
// value          — current comma-separated string from form fields
// availableSections — list of section labels found in the song body
// onChange(next) — fires with the next comma-separated string
//
// When `value` is empty and the editor has not been touched, hitting
// "Edit order" auto-populates the list from document order so the user
// has a real starting point rather than a blank canvas.
export default function StructureEditor({ value, availableSections, onChange }) {
  const items = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const [adding, setAdding] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const seedRef = useRef(false);

  // Auto-populate from document order on first paint when empty.
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    if (items.length === 0 && availableSections.length > 0) {
      onChange(availableSections.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next) => onChange(next.join(', '));

  const handleRemove = (idx) => {
    const next = items.slice();
    next.splice(idx, 1);
    commit(next);
  };

  const handleAdd = (name) => {
    if (!name) return;
    commit([...items, name]);
    setAdding(false);
  };

  const handleReset = () => {
    commit(availableSections);
  };

  const handleClear = () => commit([]);

  const handleDragStart = (idx) => () => setDraggingIdx(idx);
  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === idx) return;
    const next = items.slice();
    const [moved] = next.splice(draggingIdx, 1);
    next.splice(idx, 0, moved);
    setDraggingIdx(idx);
    commit(next);
  };
  const handleDragEnd = () => setDraggingIdx(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-label-10 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">
          Structure
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0"
          >
            Reset to song order
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-md border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]"
        onDragOver={(e) => e.preventDefault()}
      >
        {items.length === 0 && !adding && (
          <span className="text-copy-12 text-[var(--ds-gray-600)] italic px-1 py-1">
            No order set — sections will play in the order they appear in the song.
          </span>
        )}
        {items.map((name, idx) => (
          <span
            key={`${name}-${idx}`}
            draggable
            onDragStart={handleDragStart(idx)}
            onDragOver={handleDragOver(idx)}
            onDragEnd={handleDragEnd}
            title={name}
            className={
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-12 font-mono cursor-grab active:cursor-grabbing select-none ' +
              'bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] ' +
              (draggingIdx === idx ? 'opacity-50' : '')
            }
          >
            <span className="font-bold">{shortCode(name)}</span>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              aria-label={`Remove ${name}`}
              className="bg-transparent border-none text-[var(--color-brand-text)] opacity-70 hover:opacity-100 cursor-pointer p-0 leading-none"
              style={{ fontSize: '12px' }}
            >
              ✕
            </button>
          </span>
        ))}

        {adding ? (
          <select
            autoFocus
            value=""
            onChange={(e) => handleAdd(e.target.value)}
            onBlur={() => setAdding(false)}
            className="bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-md px-2 py-1 text-label-12 font-mono text-[var(--ds-gray-1000)] outline-none"
          >
            <option value="" disabled>Pick a section…</option>
            {availableSections.map((name) => (
              <option key={name} value={name}>{shortCode(name)} — {name}</option>
            ))}
          </select>
        ) : (
          availableSections.length > 0 && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-12 font-mono cursor-pointer bg-transparent border border-dashed border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)]"
            >
              + Add
            </button>
          )
        )}
      </div>
    </div>
  );
}
