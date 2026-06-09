import { useState, useEffect, useRef, useMemo } from 'react';
import { getDiatonicChords } from '../../music';
import { isChordToken } from './chordRecents';
import ChordPicker from './ChordPicker';

// Single-phase chord entry popover. Anchored at a screen point (the caret you
// clicked), it offers a text field with autocomplete (diatonic + recents) and
// accepts any valid chord you type — slash/extended chords included. Enter
// commits; ↑/↓ move the highlight; Esc closes. "More…" opens the structured
// ChordPicker for discovery/touch.
export default function ChordAutocomplete({
  anchor, initial = '', songKey = 'C', recents = [],
  onCommit, onRemove, onClose,
}) {
  const [value, setValue] = useState(initial);
  const [active, setActive] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    // Attach on the next frame so the same click that opened the popover
    // (a discrete pointerdown React may flush synchronously) doesn't get
    // caught here and close it instantly — the bug that broke desktop/mouse.
    const onPointer = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) onClose(); };
    const raf = requestAnimationFrame(() => document.addEventListener('pointerdown', onPointer));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointerdown', onPointer); };
  }, [onClose]);

  const base = useMemo(() => {
    const out = [];
    for (const c of getDiatonicChords(songKey)) if (!out.includes(c)) out.push(c);
    for (const c of recents) if (!out.includes(c)) out.push(c);
    return out;
  }, [songKey, recents]);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? base.filter(c => c.toLowerCase().startsWith(q)) : base;
    return list.slice(0, 8);
  }, [base, value]);

  const canCreate = value.trim() && isChordToken(value.trim()) && !suggestions.includes(value.trim());
  const options = canCreate ? [value.trim(), ...suggestions] : suggestions;

  const commit = (chord) => {
    const c = (chord ?? '').trim();
    if (!c || !isChordToken(c)) return;
    onCommit(c);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(options[active] ?? value);
    }
  };

  const left = anchor ? Math.min(anchor.x, window.innerWidth - 260) : 40;
  const top = anchor ? Math.min(anchor.y + 8, window.innerHeight - 240) : 40;

  return (
    <div
      ref={rootRef}
      className="fixed z-[100] w-[240px] rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2 shadow-2xl"
      style={{ left, top }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={e => { setValue(e.target.value); setActive(0); }}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="Type a chord…"
        className="w-full px-2 py-1.5 mb-1.5 bg-[var(--ds-gray-100)] border border-[var(--chord)] rounded-md text-copy-13 font-mono text-[var(--ds-gray-1000)] outline-none"
        style={{ caretColor: 'var(--chord)' }}
      />
      <div className="max-h-[180px] overflow-y-auto flex flex-col">
        {options.map((c, i) => (
          <button
            key={c}
            type="button"
            onMouseEnter={() => setActive(i)}
            onClick={() => commit(c)}
            className={`flex items-center justify-between text-left px-2.5 py-1.5 rounded-md cursor-pointer border-none font-mono text-label-13 ${
              i === active ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]' : 'bg-transparent text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)]'
            }`}
          >
            <span className="font-semibold">{c}</span>
            {canCreate && i === 0 && <span className="text-label-10 opacity-60">create</span>}
          </button>
        ))}
        {options.length === 0 && (
          <span className="px-2.5 py-2 text-copy-12 text-[var(--ds-gray-600)] italic">No matches — keep typing.</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-[var(--ds-gray-200)]">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="text-label-11 font-semibold text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer px-1"
        >
          More…
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={() => { onRemove(); onClose(); }}
            className="ml-auto text-label-11 font-semibold text-[var(--ds-error-600)] hover:text-[var(--ds-error-900)] bg-transparent border-none cursor-pointer px-1"
          >
            Remove
          </button>
        )}
      </div>

      {showPicker && (
        <ChordPicker
          onSelect={(c) => { setShowPicker(false); commit(c); }}
          onClose={() => setShowPicker(false)}
          anchorRect={anchor ? { bottom: top, left } : null}
          recentChords={recents}
        />
      )}
    </div>
  );
}
