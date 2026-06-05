import { useEffect, useMemo, useRef } from 'react';

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

// A touch-first structure editor for `structure: [...]`.
//
// No drag-and-drop (it's unreliable inside an installed PWA on tablets).
// Instead: tap a section in the "Add" row to append it to the order, and
// reorder / remove each item in place with ‹ › ✕ buttons. This merges the
// "tap-to-build" and "stepper" approaches into one tap-only interaction.
//
// value          — current comma-separated string from form fields
// availableSections — list of section labels found in the song body
// onChange(next) — fires with the next comma-separated string
// autoSeed       — when true (default) and the order is empty, populate it
//                  from document order on first paint. The always-visible
//                  ribbon passes false so opening a song doesn't dirty it.
export default function StructureEditor({ value, availableSections, onChange, autoSeed = true }) {
  const items = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const seedRef = useRef(false);

  useEffect(() => {
    if (!autoSeed) return;
    if (seedRef.current) return;
    seedRef.current = true;
    if (items.length === 0 && availableSections.length > 0) {
      onChange(availableSections.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next) => onChange(next.join(', '));
  const handleAdd = (name) => commit([...items, name]);
  const handleRemove = (idx) => commit(items.filter((_, i) => i !== idx));
  const handleMove = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };
  const handleReset = () => commit(availableSections);
  const handleClear = () => commit([]);

  return (
    <div className="flex flex-col gap-1.5">
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

      {/* Current order — reorder/remove in place, no drag */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-[40px] rounded-md border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">
        {items.length === 0 && (
          <span className="text-copy-12 text-[var(--ds-gray-600)] italic px-1 py-0.5">
            No order set — sections play in the order they appear in the song.
          </span>
        )}
        {items.map((name, idx) => (
          <span
            key={`${name}-${idx}`}
            title={name}
            className="inline-flex items-center rounded-md text-label-12 font-mono bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] overflow-hidden"
          >
            <span className="font-bold pl-2 pr-1.5 py-1">{shortCode(name)}</span>
            <StepBtn label="‹" title="Move left" onClick={() => handleMove(idx, -1)} disabled={idx === 0} />
            <StepBtn label="›" title="Move right" onClick={() => handleMove(idx, 1)} disabled={idx === items.length - 1} />
            <StepBtn label="✕" title={`Remove ${name}`} onClick={() => handleRemove(idx)} />
          </span>
        ))}
      </div>

      {/* Add a section by tapping it */}
      {availableSections.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-label-10 font-semibold uppercase tracking-wider text-[var(--ds-gray-500)] pr-0.5">
            Add
          </span>
          {availableSections.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleAdd(name)}
              title={name}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-12 font-mono cursor-pointer bg-transparent border border-dashed border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)]"
            >
              + {shortCode(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepBtn({ label, title, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className="px-1.5 py-1 leading-none bg-transparent border-none border-l border-[var(--color-brand-border)] text-[var(--color-brand-text)] cursor-pointer hover:bg-[var(--color-brand)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ borderLeft: '1px solid var(--color-brand-border)' }}
    >
      {label}
    </button>
  );
}
