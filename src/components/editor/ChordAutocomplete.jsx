import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getDiatonicChords } from '../../music';
import { isChordToken } from './chordRecents';

const ROOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SUFFIXES = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', 'dim', 'aug'];

// Full-width chord-entry bar, docked to the bottom of the viewport on every
// device. Shown when a lyric position (or an existing chord) is "armed". Type
// any valid chord (slash/extended included), tap a suggestion chip, or open the
// inline picker. Enter commits, ←/→ move the chip highlight, Esc closes.
export default function ChordAutocomplete({
  initial = '', songKey = 'C', recents = [],
  editing = false, dock = 'bottom', onCommit, onRemove, onClose,
}) {
  const [value, setValue] = useState(initial);
  const [active, setActive] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [pickRoot, setPickRoot] = useState(null);
  const [pickAcc, setPickAcc] = useState('');
  const inputRef = useRef(null);

  // Focus the input for typing on pointer-fine devices only; on touch we leave
  // it unfocused so the keyboard doesn't cover the bar — tap chips instead.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const base = useMemo(() => {
    const out = [];
    for (const c of getDiatonicChords(songKey)) if (!out.includes(c)) out.push(c);
    for (const c of recents) if (!out.includes(c)) out.push(c);
    return out;
  }, [songKey, recents]);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    return (q ? base.filter(c => c.toLowerCase().startsWith(q)) : base).slice(0, 14);
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
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); commit(options[active] ?? value); }
  };

  const top = dock === 'top';
  return createPortal((
    <div
      className={`fixed left-0 right-0 z-[120] bg-[var(--ds-background-100)] ${top ? 'top-0 border-b border-[var(--ds-gray-300)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]' : 'bottom-0 border-t border-[var(--ds-gray-300)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]'}`}
      style={{ ...(top ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }), animation: 'pop-in 120ms ease-out' }}
    >
      {/* Title + actions */}
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-label-11 font-semibold text-[var(--ds-gray-600)]">
          {editing ? 'Replace chord' : 'Add chord'}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setShowPicker(v => !v); setPickRoot(null); setPickAcc(''); }} className="text-label-11 font-semibold text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer">
            {showPicker ? 'Hide picker' : 'Picker'}
          </button>
          {onRemove && (
            <button type="button" onClick={() => { onRemove(); onClose(); }} className="text-label-11 font-semibold text-[var(--ds-error-600)] bg-transparent border-none cursor-pointer">Remove</button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chord bar"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Inline structured picker (optional) */}
      {showPicker && (
        <div className="px-3 pt-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {ROOTS.map(r => (
              <button key={r} type="button" onClick={() => setPickRoot(r)} className={`px-2.5 py-1.5 rounded-md font-mono text-label-12 font-semibold cursor-pointer border ${pickRoot === r ? 'bg-[var(--chord)] text-black border-[var(--chord)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)]'}`}>{r}</button>
            ))}
            {['#', 'b'].map(a => (
              <button key={a} type="button" onClick={() => setPickAcc(v => v === a ? '' : a)} className={`w-8 py-1.5 rounded-md font-mono text-label-12 font-semibold cursor-pointer border ${pickAcc === a ? 'bg-[var(--chord)] text-black border-[var(--chord)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)]'}`}>{a}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {SUFFIXES.map(suf => (
              <button key={suf || 'maj'} type="button" disabled={!pickRoot} onClick={() => commit(pickRoot + pickAcc + suf)} className={`px-2.5 py-1.5 rounded-md font-mono text-label-11 font-semibold border ${pickRoot ? 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] cursor-pointer' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-500)] border-[var(--ds-gray-300)] opacity-40 cursor-not-allowed'}`}>{suf || 'maj'}</button>
            ))}
          </div>
          {pickRoot && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-label-10 text-[var(--ds-gray-500)]">/</span>
              {ROOTS.map(r => (
                <button key={r} type="button" onClick={() => commit(pickRoot + pickAcc + '/' + r)} className="px-1.5 py-1 rounded-md font-mono text-label-10 font-semibold bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border border-[var(--ds-gray-400)] cursor-pointer">{r}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input + suggestion chips */}
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setActive(0); }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="Type…"
          className="shrink-0 w-[92px] px-2 py-2 bg-[var(--ds-gray-100)] border border-[var(--chord)] rounded-md text-copy-13 font-mono text-[var(--ds-gray-1000)] outline-none"
          style={{ caretColor: 'var(--chord)' }}
        />
        {options.map((c, i) => {
          const isCreate = canCreate && i === 0;
          return (
            <button
              key={c}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(c)}
              className={`shrink-0 px-3 py-2 rounded-lg font-mono text-label-13 font-bold cursor-pointer border ${
                i === active
                  ? 'bg-[var(--chord)] text-black border-[var(--chord)]'
                  : isCreate
                    ? 'bg-transparent text-[var(--ds-gray-1000)] border-dashed border-[var(--ds-gray-500)]'
                    : 'bg-[var(--ds-gray-100)] text-[var(--chord)] border-[var(--ds-gray-400)]'
              }`}
            >
              {c}{isCreate ? ' +' : ''}
            </button>
          );
        })}
      </div>
    </div>
  ), document.body);
}
