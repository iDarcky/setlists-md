import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getDiatonicChords } from '../../music';
import { isChordToken } from './chordRecents';

const ROOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SUFFIXES = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', 'dim', 'aug'];

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
  const [pickRoot, setPickRoot] = useState(null);
  const [pickAcc, setPickAcc] = useState('');
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

  // Position after layout so the popover always stays fully on screen: prefer
  // above the clicked caret, fall back below, then clamp. On phones it docks to
  // the left edge (wider, easier to reach) instead of centering on the tap.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const M = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = isMobile ? M : (anchor ? anchor.x - w / 2 : M);
    left = Math.max(M, Math.min(left, vw - w - M));
    let top = anchor ? anchor.y - h - 12 : M;        // prefer above the line
    if (top < M) top = anchor ? anchor.y + 20 : M;   // not enough room → below
    top = Math.max(M, Math.min(top, vh - h - M));    // final clamp
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  });

  return createPortal((
    <div
      ref={rootRef}
      className="fixed z-[100] rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2 shadow-2xl"
      style={{ left: 8, top: 8, width: 244, maxHeight: '80vh', overflowY: 'auto', visibility: 'hidden', animation: 'pop-in 120ms ease-out' }}
    >
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
      {!showPicker ? (
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
      ) : (
        /* Inline structured picker — stays inside the popover. */
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {ROOTS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setPickRoot(r)}
                className={`flex-1 min-w-[26px] px-1 py-1 rounded-md font-mono text-label-12 font-semibold cursor-pointer border ${
                  pickRoot === r ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
                }`}
              >
                {r}
              </button>
            ))}
            {['#', 'b'].map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setPickAcc(v => v === a ? '' : a)}
                className={`w-7 px-1 py-1 rounded-md font-mono text-label-12 font-semibold cursor-pointer border ${
                  pickAcc === a ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)]'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {SUFFIXES.map(suf => (
              <button
                key={suf || 'maj'}
                type="button"
                disabled={!pickRoot}
                onClick={() => commit(pickRoot + pickAcc + suf)}
                className={`px-2 py-1 rounded-md font-mono text-label-11 font-semibold border ${
                  pickRoot ? 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)] cursor-pointer' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-500)] border-[var(--ds-gray-300)] opacity-40 cursor-not-allowed'
                }`}
              >
                {suf || 'maj'}
              </button>
            ))}
          </div>
          {pickRoot && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-label-10 text-[var(--ds-gray-500)]">/</span>
              {ROOTS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => commit(pickRoot + pickAcc + '/' + r)}
                  className="px-1.5 py-0.5 rounded-md font-mono text-label-10 font-semibold bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)] cursor-pointer"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-[var(--ds-gray-200)]">
        <button
          type="button"
          onClick={() => { setShowPicker(v => !v); setPickRoot(null); setPickAcc(''); }}
          className="text-label-11 font-semibold text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer px-1"
        >
          {showPicker ? '‹ Suggestions' : 'More…'}
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
    </div>
  ), document.body);
}
