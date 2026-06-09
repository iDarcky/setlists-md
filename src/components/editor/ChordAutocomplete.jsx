import { useState, useEffect, useRef, useMemo } from 'react';
import { getDiatonicChords } from '../../music';
import { isChordToken } from './chordRecents';
import ChordPicker from './ChordPicker';

// Single-phase chord entry popover. Anchored at the caret you clicked, it
// centers over that point and flips above/below to stay on screen. Type any
// valid chord (slash/extended included) or tap a suggestion chip; Enter
// commits, ←/→ move the highlight, Esc closes. "More…" opens the picker.
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
    return list.slice(0, 10);
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
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); commit(options[active] ?? value); }
  };

  // Center over the click, flip above when there's room (feels anchored to the
  // chord's landing spot). No measuring needed — keeps it snappy.
  const WIDTH = 244;
  const preferAbove = !!anchor && anchor.y > 240;
  const left = anchor ? Math.min(Math.max(anchor.x - WIDTH / 2, 8), window.innerWidth - WIDTH - 8) : 40;
  const top = anchor ? (preferAbove ? anchor.y - 10 : anchor.y + 18) : 40;
  const arrowLeft = anchor ? Math.min(Math.max(anchor.x - left, 14), WIDTH - 14) : WIDTH / 2;

  return (
    <div
      ref={rootRef}
      className="fixed z-[100] rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2 shadow-2xl"
      style={{ left, top, width: WIDTH, transform: preferAbove ? 'translateY(-100%)' : 'none', transformOrigin: preferAbove ? 'bottom center' : 'top center', animation: 'pop-in 120ms ease-out' }}
    >
      {/* pointer */}
      <span
        aria-hidden
        className="absolute w-2.5 h-2.5 rotate-45 bg-[var(--ds-background-100)] border-[var(--ds-gray-400)]"
        style={preferAbove
          ? { left: arrowLeft - 5, bottom: -5, borderRight: '1px solid', borderBottom: '1px solid' }
          : { left: arrowLeft - 5, top: -5, borderLeft: '1px solid', borderTop: '1px solid' }}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={e => { setValue(e.target.value); setActive(0); }}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="Type a chord…"
        className="w-full px-2 py-1.5 bg-[var(--ds-gray-100)] border border-[var(--chord)] rounded-md text-copy-13 font-mono text-[var(--ds-gray-1000)] outline-none"
        style={{ caretColor: 'var(--chord)' }}
      />
      <div className="flex flex-wrap gap-1 mt-1.5 max-h-[120px] overflow-y-auto">
        {options.map((c, i) => {
          const isCreate = canCreate && i === 0;
          return (
            <button
              key={c}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(c)}
              className={`px-2 py-1 rounded-md font-mono text-label-12 font-semibold cursor-pointer border transition-colors ${
                i === active
                  ? 'bg-[var(--chord)] text-black border-[var(--chord)]'
                  : isCreate
                    ? 'bg-transparent text-[var(--ds-gray-1000)] border-dashed border-[var(--ds-gray-500)]'
                    : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
              }`}
            >
              {c}{isCreate ? ' +' : ''}
            </button>
          );
        })}
        {options.length === 0 && (
          <span className="px-1 py-1 text-copy-12 text-[var(--ds-gray-600)] italic">No matches — keep typing.</span>
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
