import { useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '../ui/BottomSheet';
import { Button } from '../ui/Button';

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

// Structure editor: a compact, always-visible summary strip that opens a
// focused, touch-friendly bottom sheet for editing. No drag-and-drop (it's
// unreliable in an installed PWA on tablets) — the sheet uses tap-to-build
// (tap a section to append) plus tap-to-select + big move/remove controls.
//
// value          — current comma-separated string from form fields
// availableSections — section labels found in the song body
// onChange(next) — fires with the next comma-separated string
// autoSeed       — populate from document order on first paint when empty
export default function StructureEditor({ value, availableSections, onChange, autoSeed = true, variant = 'full' }) {
  const items = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const [open, setOpen] = useState(false);
  const [selIdx, setSelIdx] = useState(null);
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
  const append = (name) => commit([...items, name]);
  const remove = (idx) => { commit(items.filter((_, i) => i !== idx)); setSelIdx(null); };
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
    setSelIdx(j);
  };

  // 'link' renders only the Edit trigger + the editing sheet (no label, no inline
  // chip strip) — used where the structure is already shown elsewhere (e.g. the
  // Arrange tab's play-order chips).
  const trigger = variant === 'link' ? (
    <button
      type="button"
      onClick={() => { setSelIdx(null); setOpen(true); }}
      className="shrink-0 text-label-11 font-semibold text-[var(--color-brand-text)] hover:underline bg-transparent border-none cursor-pointer px-1 py-1"
    >
      Edit order
    </button>
  ) : (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-label-10 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)] shrink-0">
        Structure
      </span>
      <button
        type="button"
        onClick={() => { setSelIdx(null); setOpen(true); }}
        className="shrink-0 text-label-11 font-semibold text-[var(--color-brand-text)] hover:underline bg-transparent border-none cursor-pointer px-1 py-1"
      >
        Edit
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
        {items.length === 0 ? (
          <span className="text-copy-12 text-[var(--ds-gray-600)] italic whitespace-nowrap">
            No order set
          </span>
        ) : (
          items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              title={name}
              className="shrink-0 px-1.5 py-0.5 rounded text-label-11 font-mono font-bold bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]"
            >
              {shortCode(name)}
            </span>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Song structure">
        <div className="flex flex-col gap-5 pb-2">
          {/* Current order */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-label-12 font-semibold text-[var(--text-2)]">Play order</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { commit(availableSections); setSelIdx(null); }}
                  className="text-label-12 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0"
                >
                  Reset to song order
                </button>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { commit([]); setSelIdx(null); }}
                    className="text-label-12 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-2.5 min-h-[60px] rounded-xl border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">
              {items.length === 0 && (
                <span className="text-copy-13 text-[var(--ds-gray-600)] italic px-1 py-2">
                  Tap a section below to add it to the order.
                </span>
              )}
              {items.map((name, i) => {
                const selected = selIdx === i;
                return (
                  <button
                    key={`${name}-${i}`}
                    type="button"
                    onClick={() => setSelIdx(selected ? null : i)}
                    title={name}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-copy-13 font-mono cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[var(--color-brand)] text-white border border-[var(--color-brand)]'
                        : 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border border-[var(--color-brand-border)]'
                    }`}
                  >
                    <span className="font-bold">{shortCode(name)}</span>
                    <span className="opacity-70">{name}</span>
                  </button>
                );
              })}
            </div>

            {/* Controls for the selected item */}
            {selIdx !== null && items[selIdx] && (
              <div className="flex items-center gap-2 mt-3">
                <Button variant="secondary" size="md" onClick={() => move(selIdx, -1)} disabled={selIdx === 0}>
                  ← Move
                </Button>
                <Button variant="secondary" size="md" onClick={() => move(selIdx, 1)} disabled={selIdx === items.length - 1}>
                  Move →
                </Button>
                <Button variant="danger" size="md" onClick={() => remove(selIdx)} className="ml-auto">
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Add a section */}
          {availableSections.length > 0 && (
            <div>
              <span className="text-label-12 font-semibold text-[var(--text-2)] block mb-2">Add a section</span>
              <div className="flex flex-wrap gap-2">
                {availableSections.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => append(name)}
                    title={name}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-copy-13 font-mono cursor-pointer bg-transparent border border-dashed border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)]"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Done — explicit close so the order feels committed. */}
          <div className="pt-1">
            <Button variant="brand" size="lg" onClick={() => setOpen(false)} className="w-full justify-center">
              Done
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
