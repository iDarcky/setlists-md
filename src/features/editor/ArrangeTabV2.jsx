import { useState, useEffect, useCallback, useMemo, useRef, memo, Fragment } from 'react';
import PopMenu, { MenuItem } from '@/ui/PopMenu';
import { parseSongMd, songToMd, placementToLine, parseTabBlock, parseSectionLines, splitMd, parseFrontmatterFields, serializeFrontmatterFields } from '@/parser';
import { sectionStyle, getNashvilleNumber, getSolfege } from '@/music';
import TabBlock from '@/features/chart/TabBlock';
import TabGridEditor from './TabGridEditorV2';
import KeyChangeDialog from './KeyChangeDialog';
import { TAB_INSTRUMENTS, instrumentForStrings } from './tabInstruments';
import { IconButton } from '@/ui/IconButton';
import { Button } from '@/ui/Button';
import { caretOffsetFromPoint, parsePlacementLine, sectionBaseType, serializeSectionLines, lyricsOnly, mergeLyrics } from './arrangeHelpers';
import { importChartText } from '@/lib/importChords';
import { loadRecents, saveRecents, pushRecent } from './chordRecents';
import ChordAutocomplete from './ChordAutocomplete';
import { showUndoToast } from '@/lib/undoToast';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];

// Next free "Tab N" name for the library.
function nextTabName(library = []) {
  const used = new Set((library || []).map(t => t.name));
  let n = (library || []).length + 1;
  while (used.has(`Tab ${n}`)) n++;
  return `Tab ${n}`;
}

// Build a clean tab object from the tab tool's saved string.
function tabObjectFromEditor(saved) {
  const lines = saved.split('\n');
  const tm = saved.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const time = tm && tm[1] ? tm[1].trim() : null;
  const stringLines = lines.map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const tab = parseTabBlock(stringLines);
  tab.time = time;
  return tab;
}

// "Verse 1" -> "V1", "Pre Chorus 2" -> "PC2" — compact code for sequence chips.
function shortCode(type) {
  const base = type.replace(/\s*\d+$/, '');
  const num = (type.match(/(\d+)\s*:?\s*$/) || [])[1] || '';
  const initials = base.split(/\s+/).map(w => w[0] || '').join('').toUpperCase();
  return initials + num;
}

// Display a chord in the chosen notation (reading aid; data stays as chords).
function formatChord(chord, notation, key) {
  if (notation === 'nashville') return getNashvilleNumber(chord, key);
  if (notation === 'solfege') return getSolfege(chord);
  return chord;
}

// ─── InteractiveLine (single-phase) ──────────────────────────────────
// Clicking anywhere on the lyric opens the chord autocomplete at that caret;
// tapping an existing chord opens it pre-filled to edit/move/remove. A hover
// caret shows where a chord will land.
const InteractiveLine = memo(function InteractiveLine({
  plainText, chords, secIdx, lineIdx, editingChordIdx,
  notation, songKey, lyricSize = 16, chordSize = 12,
  onPlace, onChordTap, onMoveChord,
}) {
  // A line with no chords reserves no chord row above it — that empty band was
  // the main source of vertical white-space on lyrics-only verses.
  const hasChords = (chords || []).length > 0;
  const downRef = useRef(null);
  const rootRef = useRef(null);
  const dragChordRef = useRef(null);         // origIdx of the chord being dragged
  const [draggingChord, setDraggingChord] = useState(null);

  // Resolve a lyric caret position (char offset in plainText) from a screen
  // point — used when a dragged chord chip is dropped over the lyric.
  const posFromPoint = useCallback((clientX, clientY) => {
    const span = document.elementFromPoint(clientX, clientY)?.closest?.('[data-tok-start]');
    if (!span || !rootRef.current?.contains(span)) return null;
    const start = parseInt(span.dataset.tokStart, 10);
    const within = caretOffsetFromPoint(clientX, clientY, span);
    return start + (within != null ? within : 0);
  }, []);

  // Touch drag of a chord chip → move it (HTML5 drag covers mouse; React touch
  // events are passive so we attach native non-passive listeners instead).
  const beginChordTouch = useCallback((origIdx) => {
    dragChordRef.current = origIdx;
    setDraggingChord(origIdx);
    let last = null;
    const onMove = (e) => { const t = e.touches[0]; if (!t) return; e.preventDefault(); last = { x: t.clientX, y: t.clientY }; };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      document.body.style.userSelect = '';
      const ci = dragChordRef.current;
      dragChordRef.current = null;
      setDraggingChord(null);
      if (ci != null && last) { const pos = posFromPoint(last.x, last.y); if (pos != null) onMoveChord?.(secIdx, lineIdx, ci, pos); }
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [posFromPoint, onMoveChord, secIdx, lineIdx]);

  // Flow-based layout: split the line into word tokens that wrap naturally.
  // Each chord starts a token, and that token gets a min-width equal to the
  // chord chip — so a chord ALWAYS pushes the lyric apart and two chords placed
  // next to each other stay readable instead of overlapping.
  const tokens = useMemo(() => {
    const text = plainText || '';
    const sorted = (chords || [])
      .map((c, i) => ({ chord: c.chord, pos: Math.max(0, Math.min(c.pos, text.length)), origIdx: i }))
      .sort((a, b) => a.pos - b.pos);
    const bounds = [];
    if (sorted.length === 0 || sorted[0].pos > 0) bounds.push({ pos: 0, chord: null, origIdx: null });
    for (const c of sorted) bounds.push({ pos: c.pos, chord: c.chord, origIdx: c.origIdx });
    const out = [];
    for (let i = 0; i < bounds.length; i++) {
      const start = bounds[i].pos;
      const end = i + 1 < bounds.length ? bounds[i + 1].pos : text.length;
      const slice = text.slice(start, end);
      const chunks = slice.length ? (slice.match(/\S+\s*|\s+/g) || [slice]) : [''];
      let offset = start;
      chunks.forEach((chunk, ci) => {
        out.push({
          chord: ci === 0 ? bounds[i].chord : null,
          origIdx: ci === 0 ? bounds[i].origIdx : null,
          text: chunk,
          start: offset,
        });
        offset += chunk.length;
      });
    }
    return out;
  }, [plainText, chords]);



  // Tap (add a chord) vs scroll/drag: ignore a pointerup that moved >8px.
  const onTextDown = (e) => { downRef.current = { x: e.clientX, y: e.clientY, moved: false }; };
  const onTextMove = (e) => { const d = downRef.current; if (d && (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8)) d.moved = true; };
  const onTextClick = (tok, e) => {
    const d = downRef.current; downRef.current = null;
    if (d && d.moved) return;
    const within = caretOffsetFromPoint(e.clientX, e.clientY, e.currentTarget);
    const pos = tok.start + (within != null ? within : (tok.text ? tok.text.length : 0));
    onPlace(secIdx, lineIdx, pos, e.clientX, e.clientY);
  };

  return (
    <div ref={rootRef} className="flex flex-wrap items-end" style={{ touchAction: 'pan-y' }}>
      {tokens.map((tok, i) => {
        const selected = tok.origIdx != null && editingChordIdx === tok.origIdx;
        const label = tok.chord != null ? formatChord(tok.chord, notation, songKey) : '';
        const minW = tok.chord != null ? `${(label || '').length * 8 + 16}px` : undefined;
        return (
          <span key={i} className="inline-flex flex-col justify-end" style={{ minWidth: minW }}>
            {hasChords && (
            <span className="flex items-end" style={{ height: '1.4em' }}>
              {tok.chord != null && (
                <span
                  role="button"
                  draggable
                  onDragStart={(e) => { dragChordRef.current = tok.origIdx; setDraggingChord(tok.origIdx); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragChordRef.current = null; setDraggingChord(null); }}
                  onTouchStart={(e) => { e.stopPropagation(); beginChordTouch(tok.origIdx); }}
                  className="cursor-grab active:cursor-grabbing rounded-[6px] border font-mono font-bold leading-none mb-[2px] touch-none"
                  style={{
                    fontSize: chordSize, padding: '3px 5px', whiteSpace: 'nowrap',
                    color: selected ? 'var(--color-brand-text)' : 'var(--chord)',
                    borderColor: selected ? 'var(--color-brand)' : 'var(--border-1)',
                    background: selected ? 'var(--color-brand-soft)' : 'var(--ds-background-100)',
                    opacity: draggingChord === tok.origIdx ? 0.4 : 1,
                    WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  }}
                  title="Tap to edit · drag to move"
                  onClick={(e) => { e.stopPropagation(); onChordTap(secIdx, lineIdx, tok.origIdx, e.clientX, e.clientY); }}
                >
                  {label}
                </span>
              )}
            </span>
            )}
            <span
              data-tok-start={tok.start}
              className="text-[var(--text-1)] cursor-text"
              style={{ fontSize: lyricSize, lineHeight: 1.3, whiteSpace: 'pre' }}
              onPointerDown={onTextDown}
              onPointerMove={onTextMove}
              onClick={(e) => onTextClick(tok, e)}
              onDragOver={(e) => { if (dragChordRef.current != null) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const ci = dragChordRef.current;
                dragChordRef.current = null;
                setDraggingChord(null);
                if (ci == null) return;
                const within = caretOffsetFromPoint(e.clientX, e.clientY, e.currentTarget);
                onMoveChord?.(secIdx, lineIdx, ci, tok.start + (within != null ? within : 0));
              }}
            >
              {tok.text === '' ? '​' : tok.text}
            </span>
          </span>
        );
      })}
    </div>
  );
});

// ─── Popover menu ─────────────────────────────────────────────────
// The menu is rendered in a portal (fixed, anchored to the trigger) so it
// escapes the Arrange scroll container's `overflow-auto` clip and sits above
// the editor's sticky header — otherwise an upward-opening "+ Add" menu got
// cut off / hidden under the header.

// ─── Section-type menu items (shared) ─────────────────────────────
// One renderer for every "pick a section type" menu — the type picker, the
// play-order "+ Add", and the bottom "+ Add section". Each item wears its own
// section colour so the three menus read the same.
function SectionTypeMenuItems({ options, current, customSectionTypes, onPick }) {
  return options.map(t => {
    const st = sectionStyle(t, null, customSectionTypes);
    return (
      <button
        key={t}
        type="button"
        onClick={() => { if (t !== current) onPick(t); }}
        className="w-full text-left px-3 py-2 text-label-13 font-bold uppercase tracking-wider cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)]"
        style={{ color: st.b }}
      >
        {t}
      </button>
    );
  });
}

// ─── Section type picker ──────────────────────────────────────────
// Custom dropdown so each type carries its own section color and the number
// sits snug next to the label (a native <select> can't colour per-option or
// hug the value).
function SectionTypePicker({ value, num, options, customSectionTypes, onChange }) {
  const cur = sectionStyle(value, null, customSectionTypes);
  // Built on PopMenu so the list portals above everything (was `absolute`, which
  // let it open UNDER the cards below / get clipped by the scroll container) and
  // auto-flips near the bottom of the screen. `menuClassName` caps the width to a
  // narrow column with its own scroll so the long type list never spills off the
  // bottom of a short window.
  return (
    <PopMenu
      align="left"
      menuClassName="w-52 max-h-[50vh]"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer outline-none p-0 text-label-12 font-black uppercase tracking-[0.15em] leading-none"
          style={{ color: cur.b }}
        >
          <span>{value}</span>
          {num && <span className="font-black">{num}</span>}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-50"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      }
    >
      <SectionTypeMenuItems options={options} current={value} customSectionTypes={customSectionTypes} onPick={onChange} />
    </PopMenu>
  );
}

// ─── Inline lyric draft ───────────────────────────────────────────
// A blank lyric line can't survive the .md round-trip (trailing empties are
// stripped), so new lyric lines are typed here first and only committed once
// they have text. Enter keeps adding lines; empty Enter/blur closes.
function DraftLyricInput({ onCommit, onClose }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <input
      ref={ref}
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); if (text.trim()) { onCommit(text); setText(''); } else onClose(); }
        else if (e.key === 'Escape') onClose();
      }}
      onBlur={() => { if (text.trim()) onCommit(text); onClose(); }}
      placeholder="Type a lyric line, Enter for the next…"
      className="w-full bg-transparent border-b border-dashed border-[var(--ds-gray-400)] text-[var(--text-1)] outline-none py-1.5 px-1"
      style={{ fontSize: 16 }}
    />
  );
}

// ─── Inline per-line comment ──────────────────────────────────────
// A tiny input to set/edit a line's `{!note}` annotation. Enter/blur commits
// (empty clears the note); Escape cancels. Seeded with any existing note.
function InlineNoteInput({ initial, onCommit, onClose }) {
  const [text, setText] = useState(initial || '');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(text); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      }}
      onBlur={() => onCommit(text)}
      placeholder="Add a comment…"
      className="mt-1 w-full max-w-[24rem] bg-transparent border-b border-dashed border-[var(--ds-gray-400)] text-[var(--text-2)] italic outline-none py-0.5 px-1 text-[0.85em]"
      style={{ fontSize: 15 }}
    />
  );
}

// ─── Play-order editor (custom sequence) ──────────────────────────
// The custom play order edited inline as draggable chips — drag to reorder,
// × to remove, "+ Add" to append (repeats welcome). Replaces the old modal.
// Desktop uses HTML5 drag; touch uses native non-passive listeners (React's are
// passive, so text selection would kick in otherwise).
function PlayOrderEditor({ order, availableTypes, customSectionTypes, onChange, onJump, vertical = false }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const commit = useCallback(() => {
    setDragIdx(from => {
      setOverIdx(to => {
        if (from != null && to != null && from !== to) {
          const a = [...order];
          const [m] = a.splice(from, 1);
          a.splice(to, 0, m);
          onChange(a);
        }
        return null;
      });
      return null;
    });
  }, [order, onChange]);
  const beginTouch = useCallback((i) => {
    setDragIdx(i);
    const onMove = (e) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-chip-idx]');
      if (el) setOverIdx(parseInt(el.dataset.chipIdx, 10));
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      document.body.style.userSelect = '';
      commit();
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [commit]);
  return (
    <div className={vertical ? 'flex flex-col gap-1' : 'flex flex-wrap items-center gap-1.5'}>
      {order.map((name, i) => {
        const st = sectionStyle(name, null, customSectionTypes);
        const isDrag = dragIdx === i;
        const isOver = dragIdx != null && dragIdx !== i && overIdx === i;
        return (
          <span
            key={i}
            data-chip-idx={i}
            draggable
            onDragStart={(e) => { setDragIdx(i); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnter={() => { if (dragIdx != null) setOverIdx(i); }}
            onDragOver={(e) => { if (dragIdx != null) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); commit(); }}
            onDragEnd={commit}
            onTouchStart={() => beginTouch(i)}
            onClick={() => onJump?.(name)}
            title={`${name} — tap to jump, drag to reorder`}
            className={
              vertical
                ? `group/po flex items-center gap-2 w-full pl-1.5 pr-1 py-1.5 rounded-lg border text-label-12 font-semibold cursor-grab active:cursor-grabbing touch-none select-none bg-[var(--ds-background-100)] ${isOver ? 'border-[var(--color-brand)]' : 'border-[var(--border-1)]'} ${isDrag ? 'opacity-40' : ''}`
                : `inline-flex items-center gap-1 pl-1 pr-0.5 py-0.5 rounded-[6px] border text-[10px] font-bold font-mono cursor-grab active:cursor-grabbing touch-none select-none bg-[var(--ds-background-100)] ${isOver ? 'border-[var(--color-brand)]' : 'border-[var(--border-1)]'} ${isDrag ? 'opacity-40' : ''}`
            }
            style={{ color: st.b, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <svg width="6" height="12" viewBox="0 0 6 12" fill="currentColor" className="opacity-40 shrink-0" aria-hidden="true"><circle cx="1.5" cy="2" r="1" /><circle cx="4.5" cy="2" r="1" /><circle cx="1.5" cy="6" r="1" /><circle cx="4.5" cy="6" r="1" /><circle cx="1.5" cy="10" r="1" /><circle cx="4.5" cy="10" r="1" /></svg>
            {/* The rail has room for the real name; the strip does not. "PC"
                for Pre-Chorus is unreadable, and worse in Romanian. */}
            <span className={vertical ? 'flex-1 min-w-0 truncate' : ''}>{vertical ? name : shortCode(name)}</span>
            {vertical && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([...order.slice(0, i + 1), name, ...order.slice(i + 1)]); }}
                aria-label={`Play ${name} again`}
                title={`Play ${name} again`}
                className="w-6 h-6 grid place-items-center rounded text-[var(--ds-gray-500)] hover:text-[var(--color-brand)] bg-transparent border-none cursor-pointer leading-none text-[14px] opacity-0 group-hover/po:opacity-100 focus:opacity-100 transition-opacity"
              >
                +
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(order.filter((_, j) => j !== i)); }}
              aria-label={`Remove ${name} from play order`}
              className={
                vertical
                  ? 'w-6 h-6 grid place-items-center rounded text-[var(--ds-gray-500)] hover:text-[var(--ds-red-700)] bg-transparent border-none cursor-pointer leading-none text-[14px] opacity-0 group-hover/po:opacity-100 focus:opacity-100 transition-opacity'
                  : 'ml-0.5 w-4 h-4 grid place-items-center rounded text-[var(--ds-gray-500)] hover:text-[var(--ds-red-700)] bg-transparent border-none cursor-pointer leading-none text-[12px]'
              }
            >
              ×
            </button>
          </span>
        );
      })}
      <PopMenu
        align="left"
        menuClassName="w-52 max-h-[50vh]"
        trigger={
          <button
            type="button"
            className={
              vertical
                ? 'w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-[var(--ds-gray-400)] text-label-12 font-semibold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)] cursor-pointer bg-transparent'
                : 'inline-flex items-center px-1.5 py-1 rounded-[6px] border border-dashed border-[var(--ds-gray-400)] text-[10px] font-bold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)] cursor-pointer bg-transparent'
            }
          >
            + Add
          </button>
        }
      >
        {availableTypes.length === 0 && <div className="px-3 py-2 text-copy-12 text-[var(--ds-gray-500)]">No sections yet</div>}
        <SectionTypeMenuItems options={availableTypes} customSectionTypes={customSectionTypes} onPick={(t) => onChange([...order, t])} />
      </PopMenu>
    </div>
  );
}

// ─── Chord-only (instrumental) line ───────────────────────────────
function ChordOnlyLine({ chords, secIdx, lineIdx, onEditChord, onAppend, onRemoveChord }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5">
      {chords.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)]">
          <button type="button" onClick={(e) => onEditChord(secIdx, lineIdx, i, e.clientX, e.clientY)} className="font-bold font-mono text-[var(--chord)] text-label-13 bg-transparent border-none cursor-pointer p-0">{c.chord}</button>
          <button type="button" onClick={() => onRemoveChord(secIdx, lineIdx, i)} aria-label={`Remove ${c.chord}`} className="opacity-50 hover:opacity-100 text-[var(--color-brand-text)] bg-transparent border-none cursor-pointer leading-none px-1">✕</button>
        </span>
      ))}
      <button type="button" onClick={(e) => onAppend(secIdx, lineIdx, e.clientX, e.clientY)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)] text-label-12 cursor-pointer bg-transparent">
        + chord
      </button>
    </div>
  );
}

// ─── ArrangeTabV2 ─────────────────────────────────────────────────
// Inline raw-markdown editor for one section (the </> "Source" toggle). Seeded
// once from the section's serialized lines (keyed per section so it remounts);
// commits on blur via onCommit → the section re-parses into visual cards.
// Fast lyric entry for an empty section — type or paste directly (no modal).
// A paste of a chords-over-lyrics chart (Ultimate-Guitar / ChordPro) is converted
// on commit; multi-section pastes expand into real sections.
const InlineLyricComposer = memo(function InlineLyricComposer({ onCommit, onCancel }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="mb-1">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text.trim()) onCommit(text); else onCancel(); }}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
        placeholder="Type lyrics, or paste a chord sheet (chords above lyrics)…"
        rows={Math.max(3, text.split('\n').length + 1)}
        spellCheck={false}
        className="w-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-3 text-copy-14 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none"
        style={{ caretColor: 'var(--chord)' }}
      />
      <p className="text-copy-11 text-[var(--ds-gray-500)] mt-1 mb-0">
        Paste from Ultimate-Guitar / ChordPro and it converts automatically. Tap out to apply.
      </p>
    </div>
  );
});

const SectionSourceEditor = memo(function SectionSourceEditor({ initial, onCommit }) {
  const [text, setText] = useState(initial);
  return (
    <div className="mb-1">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text !== initial) onCommit(text); }}
        spellCheck={false}
        rows={Math.max(3, text.split('\n').length + 1)}
        className="w-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-3 text-copy-13 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none font-mono"
        style={{ caretColor: 'var(--chord)' }}
      />
      <p className="text-copy-11 text-[var(--ds-gray-500)] mt-1 mb-0">
        Raw format — [C]inline chords, {'{tab}…{/tab}'}, {'{modulate: +N}'}. Tap out to apply.
      </p>
    </div>
  );
});

// Inline "Edit lyrics" surface — a words-only textarea that swaps into the
// section card body (same in-place pattern as SectionSourceEditor), so editing
// the words never leaves the canvas. Chords stay attached (nudged to fit) on
// commit via mergeLyrics.
const InlineSectionLyricEditor = memo(function InlineSectionLyricEditor({ initial, onCommit }) {
  const [text, setText] = useState(initial);
  return (
    <div className="mb-1">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text !== initial) onCommit(text); }}
        spellCheck
        rows={Math.max(3, text.split('\n').length + 1)}
        placeholder="Just the words — chords stay where they are."
        className="w-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-3 text-copy-14 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none"
        style={{ caretColor: 'var(--chord)' }}
      />
      <p className="text-copy-11 text-[var(--ds-gray-500)] mt-1 mb-0">
        Editing words keeps your chords attached (nudged to fit). Use “Edit source” for full control. Tap out to apply.
      </p>
    </div>
  );
});

export default function ArrangeTabV2({ md, onChange, customSectionTypes, notation = 'letters', lyricSize = 16, chordSize = 12, onPasteChart }) {
  const sectionTypes = useMemo(() => {
    const custom = (customSectionTypes || []).map(t => t?.name?.trim()).filter(Boolean);
    return [...SECTION_TYPES, ...custom];
  }, [customSectionTypes]);

  const [collapsed, setCollapsed] = useState({});
  // Chord entry target: null, or { secIdx, lineIdx, charPos, chordIdx, initial }.
  // A full-width bottom bar handles entry on every device.
  const [entry, setEntry] = useState(null);
  // Reading-aid notation for chord labels comes from the global display setting
  // ('letters' | 'nashville' | 'solfege'), driven by the editor's Aa menu.
  // Tab tool target: { mode:'new', secIdx, idx } | { mode:'editLib', name, tab } | null
  const [tabEditorTarget, setTabEditorTarget] = useState(null);
  const [draftTarget, setDraftTarget] = useState(null); // { secIdx, idx } open inline lyric draft
  const [keyChangeTarget, setKeyChangeTarget] = useState(null); // { secIdx, idx } key-change dialog
  const [noteTarget, setNoteTarget] = useState(null); // { secIdx, lineIdx } open per-line comment input
  // Per-section raw "Source" editing: secIdx -> true. A </> toggle flips one
  // section card into a raw-markdown textarea and back.
  const [sourceMode, setSourceMode] = useState({});
  // Per-section inline "Edit lyrics" (words-only) editing: secIdx -> true. Same
  // in-place swap as Source, but a plain-words textarea.
  const [lyricMode, setLyricMode] = useState({});
  // Which empty section (secIdx) has its inline lyric composer open.
  const [lyricComposer, setLyricComposer] = useState(null);
  const toggleSource = useCallback((idx) => {
    setSourceMode(m => ({ ...m, [idx]: !m[idx] }));
    setLyricMode(m => (m[idx] ? { ...m, [idx]: false } : m)); // one editor at a time
    setCollapsed(c => ({ ...c, [idx]: false })); // source implies expanded
  }, []);
  const toggleLyric = useCallback((idx) => {
    setLyricMode(m => ({ ...m, [idx]: !m[idx] }));
    setSourceMode(m => (m[idx] ? { ...m, [idx]: false } : m)); // one editor at a time
    setCollapsed(c => ({ ...c, [idx]: false })); // editing implies expanded
  }, []);
  // Section drag-to-reorder (grip handle only, so the card's inner fields stay
  // interactive). Desktop uses HTML5 drag; touch uses pointer math via native
  // non-passive listeners (React's touch handlers are passive, so preventDefault
  // there can't stop the browser's scroll/text-selection).
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const sectionRefs = useRef({});
  const scrollRef = useRef(null);      // canvas scroll container (edge autoscroll)
  const autoScrollRef = useRef({ raf: 0, v: 0 });
  const listEndRef = useRef(null);     // sentinel scrolled into view on add-section
  const scrollPendingRef = useRef(false);
  const openComposerPendingRef = useRef(false); // open the new section's lyric composer post-mount

  const song = useMemo(() => { try { return parseSongMd(md); } catch { return null; } }, [md]);

  const [recentChords, setRecentChords] = useState(() => loadRecents(song?.key || 'C'));
  const addRecent = useCallback((chord) => {
    setRecentChords(prev => {
      const next = pushRecent(prev, chord);
      saveRecents(song?.key || 'C', next);
      return next;
    });
  }, [song?.key]);

  const placements = useMemo(() => {
    if (!song) return [];
    return song.sections.map(sec => ({
      type: sec.type,
      note: sec.note,
      lines: sec.lines.map(line => (typeof line !== 'string' ? line : parsePlacementLine(line))),
    }));
  }, [song]);

  // This canvas owns the BODY and the play order — nothing else. Round-tripping
  // through songToMd used to rewrite the whole frontmatter, and parseSongMd
  // defaults a blank title to "Untitled" and a blank key to "C" — so merely
  // reordering the play order or adding a section stamped those defaults onto a
  // song the user hadn't named yet. Keep the frontmatter the user left, and take
  // only structure/structureMode from the regenerated copy.
  const emitSong = useCallback((updatedSong) => {
    const generated = songToMd(updatedSong);
    const { body } = splitMd(generated);
    const genFm = parseFrontmatterFields(splitMd(generated).frontmatter);
    const curFm = parseFrontmatterFields(splitMd(md).frontmatter);
    const fm = serializeFrontmatterFields({
      ...curFm,
      structure: genFm.structure,
      structuremode: genFm.structuremode,
    });
    onChange(fm ? `---\n${fm}\n---\n${body}` : body);
  }, [md, onChange]);

  const applyMutation = useCallback((mutator) => {
    if (!song) return;
    const newPlacements = mutator(placements);
    const updatedSong = {
      ...song,
      sections: newPlacements.map(sec => ({
        type: sec.type,
        note: sec.note,
        lines: sec.lines.map(line => {
          if (typeof line === 'object' && (line.type === 'tab' || line.type === 'tabref' || line.type === 'modulate')) return line;
          if (line.plainText !== undefined) {
            let mdLine = placementToLine({ plainText: line.plainText, chords: line.chords });
            if (line.inlineNote) mdLine += ` {!${line.inlineNote}}`;
            return mdLine;
          }
          return '';
        }),
      })),
    };
    emitSong(updatedSong);
  }, [song, placements, emitSong]);

  // ─── Chord entry ─── Tap a lyric position (or a chord) to arm it; the
  // full-width bottom bar handles entry on every device.
  const openAddChord = useCallback((secIdx, lineIdx, charPos, clientX, clientY) => {
    setEntry({ secIdx, lineIdx, charPos, chordIdx: null, initial: '', anchor: clientX != null ? { x: clientX, y: clientY } : null });
  }, []);
  const openEditChord = useCallback((secIdx, lineIdx, chordIdx, clientX, clientY) => {
    const cur = placements[secIdx]?.lines[lineIdx]?.chords?.[chordIdx]?.chord || '';
    setEntry({ secIdx, lineIdx, charPos: null, chordIdx, initial: cur, anchor: clientX != null ? { x: clientX, y: clientY } : null });
  }, [placements]);

  const placeChordAt = useCallback((target, chord) => {
    if (!target) return;
    const { secIdx, lineIdx, chordIdx, charPos, newLine } = target;
    // Deferred chord line: create the line only once it has a chord, so it
    // survives the .md round-trip (an empty line would be stripped).
    if (newLine === 'chord') {
      const insertIdx = target.insertIdx;
      applyMutation(prev => prev.map((sec, si) => {
        if (si !== secIdx) return sec;
        const lines = [...sec.lines];
        lines.splice(insertIdx == null ? lines.length : insertIdx, 0, { plainText: ' ', chords: [{ chord, pos: 0 }], inlineNote: null });
        return { ...sec, lines };
      }));
      addRecent(chord);
      setEntry(null);
      return;
    }
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => {
        if (li !== lineIdx || line.plainText === undefined) return line;
        if (chordIdx != null) {
          return { ...line, chords: line.chords.map((c, ci) => ci === chordIdx ? { ...c, chord } : c) };
        }
        const filtered = line.chords.filter(c => c.pos !== charPos);
        return { ...line, chords: [...filtered, { chord, pos: charPos }].sort((a, b) => a.pos - b.pos) };
      }),
    })));
    addRecent(chord);
  }, [applyMutation, addRecent]);

  const commitChord = useCallback((chord) => { placeChordAt(entry, chord); }, [entry, placeChordAt]);

  const removeChordAt = useCallback((secIdx, lineIdx, chordIdx) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => (li === lineIdx && line.plainText !== undefined)
        ? { ...line, chords: line.chords.filter((_, ci) => ci !== chordIdx) }
        : line),
    })));
  }, [applyMutation]);

  // Move an existing chord to a new character position on the same line (drag).
  const moveChordTo = useCallback((secIdx, lineIdx, chordIdx, newPos) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => {
        if (li !== lineIdx || line.plainText === undefined) return line;
        const pos = Math.max(0, Math.min(newPos, (line.plainText || '').length));
        return { ...line, chords: line.chords.map((c, ci) => ci === chordIdx ? { ...c, pos } : c).sort((a, b) => a.pos - b.pos) };
      }),
    })));
  }, [applyMutation]);

  const appendChord = useCallback((secIdx, lineIdx, clientX, clientY) => {
    const line = placements[secIdx]?.lines[lineIdx];
    const pos = ((line?.chords?.length) || 0) * 4;
    // ensure text is padded so the chord round-trips
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((ln, li) => (li === lineIdx && ln.plainText !== undefined)
        ? { ...ln, plainText: ' '.repeat(pos + 1) }
        : ln),
    })));
    setEntry({ secIdx, lineIdx, chordIdx: null, charPos: pos, initial: '', anchor: clientX != null ? { x: clientX, y: clientY } : null });
  }, [placements, applyMutation]);

  // ─── Section operations ───
  // Lowest free "Base N" label not already taken by another section, so adding,
  // duplicating, or relabelling a section can never collide (two "Chorus 1"s
  // used to break the song map + structure, since type names act as ids).
  const nextSectionLabel = useCallback((base, excludeIdx = -1) => {
    const used = new Set(
      (song?.sections || [])
        .filter((s, i) => i !== excludeIdx && sectionBaseType(s.type) === base)
        .map(s => s.type)
    );
    let n = 1;
    while (used.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }, [song]);

  // Emit a new section list. In "auto" mode we keep `structure` mirroring
  // section order, so the chart/performance views reflect Arrange edits. In
  // "custom" mode the user owns the slide order, so we leave `structure` alone
  // but reconcile it: drop entries whose section type no longer exists (a
  // deleted section can't dangle in the play order).
  const emitSections = useCallback((sections) => {
    if (!song) return;
    if (song.structureMode === 'custom') {
      const live = new Set(sections.map(s => s.type));
      const structure = (song.structure || []).filter(name => live.has(name));
      emitSong({ ...song, sections, structure });
    } else {
      emitSong({ ...song, sections, structure: sections.map(s => s.type) });
    }
  }, [song, emitSong]);

  // ─── Structure (slide order) — the one official control lives here ───
  // Auto = follows section order; custom = a hand-tuned slide order. Toggling on
  // seeds the order from the current sections so the user starts from what they see.
  const setStructureMode = useCallback((custom) => {
    if (!song) return;
    const types = song.sections.map(s => s.type);
    emitSong({
      ...song,
      structureMode: custom ? 'custom' : 'auto',
      structure: custom ? (song.structure?.length ? song.structure : types) : types,
    });
  }, [song, emitSong]);
  const onStructureChange = useCallback((str) => {
    if (!song) return;
    const arr = str.split(',').map(s => s.trim()).filter(Boolean);
    emitSong({ ...song, structureMode: 'custom', structure: arr });
  }, [song, emitSong]);

  const addSection = useCallback((base = 'Verse') => {
    if (!song) return;
    // Defer both the scroll and the composer-open until the new (last) section
    // has mounted after the md round-trip — opening the composer synchronously
    // races the re-parse and the fresh textarea blurs itself closed.
    scrollPendingRef.current = true;
    openComposerPendingRef.current = true;
    emitSections([...song.sections, { type: nextSectionLabel(base), note: '', lines: [''] }]);
  }, [song, emitSections, nextSectionLabel]);

  const duplicateSection = useCallback((idx) => {
    if (!song) return;
    const src = song.sections[idx];
    const base = sectionBaseType(src.type);
    const copy = { ...src, type: nextSectionLabel(base), lines: [...src.lines] };
    emitSections([...song.sections.slice(0, idx + 1), copy, ...song.sections.slice(idx + 1)]);
  }, [song, emitSections, nextSectionLabel]);

  const removeSection = useCallback((idx) => {
    if (!song) return;
    const prevSong = song; // snapshot for a full restore on Undo
    const removed = song.sections[idx];
    emitSections(song.sections.filter((_, i) => i !== idx));
    showUndoToast({
      title: 'Section deleted',
      description: sectionBaseType(removed?.type) || 'Section',
      onUndo: () => emitSong(prevSong),
    });
  }, [song, emitSections, emitSong]);

  // Move a section from one index to another (drag-to-reorder commit).
  const reorderSection = useCallback((from, to) => {
    if (!song || from == null || to == null || from === to) return;
    const arr = [...song.sections];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    emitSections(arr);
  }, [song, emitSections]);

  // ── Edge autoscroll ── While dragging near the top/bottom of the canvas,
  // scroll it so long songs can be reordered without lifting the finger/mouse.
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current.raf) cancelAnimationFrame(autoScrollRef.current.raf);
    autoScrollRef.current = { raf: 0, v: 0 };
  }, []);
  const updateAutoScroll = useCallback((clientY) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const EDGE = 64, MAX = 16;
    let v = 0;
    if (clientY < r.top + EDGE) v = -Math.ceil(MAX * Math.min(1, (r.top + EDGE - clientY) / EDGE));
    else if (clientY > r.bottom - EDGE) v = Math.ceil(MAX * Math.min(1, (clientY - (r.bottom - EDGE)) / EDGE));
    autoScrollRef.current.v = v;
    if (v && !autoScrollRef.current.raf) {
      const tick = () => {
        const node = scrollRef.current;
        const vel = autoScrollRef.current.v;
        if (node && vel) { node.scrollTop += vel; autoScrollRef.current.raf = requestAnimationFrame(tick); }
        else autoScrollRef.current.raf = 0;
      };
      autoScrollRef.current.raf = requestAnimationFrame(tick);
    }
  }, []);

  // Resolve the section under a point and arm it as the drop target.
  const pointToDropTarget = useCallback((clientX, clientY) => {
    const row = document.elementFromPoint(clientX, clientY)?.closest('[data-drag-idx]');
    if (row) setDragOverIdx(parseInt(row.dataset.dragIdx, 10));
  }, []);

  // Commit whatever the drag landed on, then clear all drag state. Reads the
  // latest dragIdx/dragOverIdx via the state updaters so it works from both the
  // dragend and touchend paths without stale closures.
  const endDrag = useCallback(() => {
    setDragIdx(from => {
      setDragOverIdx(to => { reorderSection(from, to); return null; });
      return null;
    });
    stopAutoScroll();
  }, [reorderSection, stopAutoScroll]);

  // ── Touch drag (native, non-passive) ── React's onTouchMove is passive, so
  // preventDefault there can't stop the page scrolling or selecting text under
  // the finger. We attach our own listeners while a touch drag is live and
  // suppress text selection on <body> for the duration.
  const beginTouchDrag = useCallback((idx) => {
    setDragIdx(idx);
    const onMove = (e) => {
      if (!e.touches[0]) return;
      e.preventDefault(); // non-passive: stops scroll + text selection
      updateAutoScroll(e.touches[0].clientY);
      pointToDropTarget(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      endDrag();
    };
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [updateAutoScroll, pointToDropTarget, endDrag]);

  // Desktop HTML5 drag — the card itself is the drag image.
  const onGripDragStart = useCallback((idx, e) => {
    setDragIdx(idx);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* IE */ }
      const card = sectionRefs.current[idx];
      if (card) e.dataTransfer.setDragImage(card, 24, 16);
    }
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const changeSectionType = useCallback((idx, base) => {
    if (!song) return;
    emitSections(song.sections.map((s, i) => i === idx ? { ...s, type: nextSectionLabel(base, idx) } : s));
  }, [song, emitSections, nextSectionLabel]);

  const updateSectionNote = useCallback((idx, note) => {
    if (!song) return;
    emitSong({ ...song, sections: song.sections.map((s, i) => i === idx ? { ...s, note } : s) });
  }, [song, emitSong]);

  // Set/clear a per-line inline comment (`{!note}`). Empty text clears it.
  const setInlineNote = useCallback((secIdx, lineIdx, text) => {
    const note = (text || '').trim();
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => (li !== lineIdx || line.plainText === undefined)
        ? line
        : { ...line, inlineNote: note || null }),
    })));
  }, [applyMutation]);

  // Commit the inline lyric composer for an empty section. Runs the text through
  // the smart chart importer so a pasted chords-over-lyrics sheet converts; a
  // multi-section paste (has `## headers`) expands into real sections in place.
  const commitLyricComposer = useCallback((secIdx, rawText) => {
    if (!song) { setLyricComposer(null); return; }
    const { body } = importChartText(rawText);
    if (/^##\s/m.test(body)) {
      const parsed = parseSongMd(`---\n---\n\n${body}`);
      const secs = parsed?.sections?.length ? parsed.sections : null;
      if (secs) {
        emitSong({ ...song, sections: [...song.sections.slice(0, secIdx), ...secs, ...song.sections.slice(secIdx + 1)] });
      }
    } else {
      const lines = parseSectionLines(body);
      while (lines.length > 1 && (typeof lines[lines.length - 1] !== 'string' ? false : lines[lines.length - 1].trim() === '')) lines.pop();
      emitSong({ ...song, sections: song.sections.map((s, i) => i === secIdx ? { ...s, lines: lines.length ? lines : [''] } : s) });
    }
    setLyricComposer(null);
  }, [song, emitSong]);

  // ─── Line operations ───
  // Insert a line object at `idx` (null/undefined = append to the end).
  const insertLineAt = useCallback((secIdx, idx, lineObj) => {
    applyMutation(prev => prev.map((sec, si) => {
      if (si !== secIdx) return sec;
      const lines = [...sec.lines];
      lines.splice(idx == null ? lines.length : idx, 0, lineObj);
      return { ...sec, lines };
    }));
  }, [applyMutation]);
  // Lyric lines go through an inline draft (see DraftLyricInput) because blank
  // lines can't round-trip through the .md.
  const addLine = useCallback((secIdx, idx) => { setEntry(null); setDraftTarget({ secIdx, idx: idx == null ? null : idx }); }, []);
  const commitDraftLyric = useCallback((secIdx, idx, text) => {
    insertLineAt(secIdx, idx, { plainText: text, chords: [], inlineNote: null });
    // Advance the draft so successive Enters stack lines in order.
    if (idx != null) setDraftTarget({ secIdx, idx: idx + 1 });
  }, [insertLineAt]);
  // Chord line: defer creation until the first chord is committed.
  const addChordLine = useCallback((secIdx, idx) => {
    setDraftTarget(null);
    setEntry({ secIdx, lineIdx: null, chordIdx: null, charPos: 0, initial: '', newLine: 'chord', insertIdx: idx == null ? null : idx });
  }, []);
  const confirmKeyChange = useCallback((target, semitones, addChords) => {
    const { secIdx, idx } = target;
    insertLineAt(secIdx, idx, { type: 'modulate', semitones });
    setKeyChangeTarget(null);
    if (addChords) setEntry({ secIdx, lineIdx: null, chordIdx: null, charPos: 0, initial: '', newLine: 'chord', insertIdx: idx == null ? null : idx + 1 });
  }, [insertLineAt]);
  // Save handler for the tab tool — either create a new library tab + reference
  // it at the target index, or update an existing library block in place.
  const handleTabToolSave = useCallback((saved) => {
    if (!song || !tabEditorTarget) return;
    const tab = tabObjectFromEditor(saved);
    if (tabEditorTarget.mode === 'editLib') {
      // Preserve the block's instrument tag (set in the Tabs tab) on edit.
      if (tabEditorTarget.tab?.instrument) tab.instrument = tabEditorTarget.tab.instrument;
      emitSong({ ...song, tabLibrary: (song.tabLibrary || []).map(t => t.name === tabEditorTarget.name ? { ...t, tab } : t) });
    } else {
      const { secIdx, idx } = tabEditorTarget;
      const name = nextTabName(song.tabLibrary);
      emitSong({
        ...song,
        tabLibrary: [...(song.tabLibrary || []), { name, tab }],
        sections: song.sections.map((s, i) => {
          if (i !== secIdx) return s;
          const lines = [...s.lines];
          lines.splice(idx == null ? lines.length : idx, 0, { type: 'tabref', name });
          return { ...s, lines };
        }),
      });
    }
    setTabEditorTarget(null);
  }, [song, emitSong, tabEditorTarget]);
  // Drop a reference to an existing library tab into a section at `idx`.
  const insertTabRef = useCallback((secIdx, name, idx) => {
    insertLineAt(secIdx, idx, { type: 'tabref', name });
  }, [insertLineAt]);
  const removeLine = useCallback((secIdx, lineIdx) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: sec.lines.filter((_, li) => li !== lineIdx) })));
  }, [applyMutation]);
  // Nudge an existing key-change marker inline (±1 semitone), so tweaking it
  // doesn't need the KeyChangeDialog. Skips the no-op 0 and clamps to ±11.
  const stepModulate = useCallback((secIdx, lineIdx, current, dir) => {
    let next = current + dir;
    if (next === 0) next += dir;
    next = Math.max(-11, Math.min(11, next));
    if (next === current) return;
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => (li === lineIdx && typeof line === 'object' && line.type === 'modulate')
        ? { ...line, semitones: next }
        : line),
    })));
  }, [applyMutation]);

  // "Edit lyrics" swaps the section card body into an inline words-only textarea
  // (same in-place pattern as "Edit source"), so editing never leaves the canvas.
  const handleEditText = useCallback((secIdx) => {
    setEntry(null);
    toggleLyric(secIdx);
  }, [toggleLyric]);

  // Commit a raw .md block back to a section (from the Source editor) — re-parse
  // so tab/modulate/tabref blocks are reconstructed as objects (a naive
  // split('\n') flattened `{tab}` blocks into plain strings and lost the tab).
  const handleDrawerSave = useCallback((sectionIndex, rawText) => {
    if (!song) return;
    const lines = parseSectionLines(rawText);
    const sections = song.sections.map((sec, i) => i !== sectionIndex ? sec : ({ ...sec, lines }));
    emitSong({ ...song, sections });
  }, [song, emitSong]);

  // Commit words-only lyric edits — mergeLyrics re-attaches the section's chords
  // (clamped) and preserves tabs/modulate/inline notes, then re-parse as above.
  const handleLyricSave = useCallback((sectionIndex, lyricsText) => {
    if (!song) return;
    const raw = mergeLyrics(song.sections[sectionIndex]?.lines || [], lyricsText);
    const lines = parseSectionLines(raw);
    const sections = song.sections.map((sec, i) => i !== sectionIndex ? sec : ({ ...sec, lines }));
    emitSong({ ...song, sections });
    setLyricMode(m => ({ ...m, [sectionIndex]: false }));
  }, [song, emitSong]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setEntry(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Scroll a freshly added section into view once it has mounted. addSection
  // sets the flag; this effect (keyed on section count) does the scroll after
  // the new card renders — mirrors SetlistBuilder's deferred-scroll idiom.
  const sectionCount = song?.sections?.length ?? 0;
  useEffect(() => {
    if (scrollPendingRef.current) {
      scrollPendingRef.current = false;
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    if (openComposerPendingRef.current && sectionCount > 0) {
      openComposerPendingRef.current = false;
      const last = sectionCount - 1; // the freshly added (last) section
      // Defer a frame so the open isn't a synchronous setState in the effect
      // body (and the new card has painted before its composer focuses).
      const raf = requestAnimationFrame(() => setLyricComposer(last));
      return () => cancelAnimationFrame(raf);
    }
  }, [sectionCount]);

  // Shared add-menu body — used by the bottom "+ Add" and every inline insert
  // point. `idx` is the position to insert at (null = append).
  const renderAddItems = (secIdx, idx) => (
    <>
      <MenuItem onClick={() => addLine(secIdx, idx)}>Lyric line</MenuItem>
      <MenuItem onClick={() => addChordLine(secIdx, idx)}>Chord line (instrumental)</MenuItem>
      <MenuItem onClick={() => setKeyChangeTarget({ secIdx, idx })}>Key change…</MenuItem>
      <div className="my-1 border-t border-[var(--ds-gray-200)]" />
      {(song.tabLibrary || []).map(t => (
        <MenuItem key={t.name} onClick={() => insertTabRef(secIdx, t.name, idx)}>
          <span className="inline-flex items-center gap-2"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>{t.name}</span>
        </MenuItem>
      ))}
      <MenuItem onClick={() => setTabEditorTarget({ mode: 'new', secIdx, idx })}>+ New tab…</MenuItem>
    </>
  );

  // A subtle "+" between lines that opens the add menu, inserting at `idx`.
  const renderInsertPoint = (secIdx, idx) => (
    <div key={`ins-${idx}`} className="group/ins relative h-1.5 flex items-center">
      {/* A big target wearing a small mark. The whole strip is clickable, but
          all that shows at rest is a faint hairline with a "+" at the left —
          a row of circular buttons down the card was louder than the lyrics. */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--ds-gray-200)] opacity-0 group-hover/ins:opacity-100 transition-opacity" />
      <PopMenu
        align="left"
        trigger={
          <button
            type="button"
            aria-label="Add a line, chord, key change or tab here"
            title="Add a line, chord, key change or tab here"
            className="absolute inset-x-0 -top-1.5 -bottom-1.5 z-[1] flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[var(--ds-gray-600)] sm:text-[var(--ds-gray-500)] hover:text-[var(--color-brand)] text-left"
          >
            {/* Touch has no hover: the mark stays legible there and only fades
                back on devices that can actually reveal it. */}
            <span className="text-[15px] sm:text-[13px] leading-none opacity-100 sm:opacity-40 sm:group-hover/ins:opacity-100 transition-opacity">+</span>
            <span className="text-label-11 opacity-0 sm:group-hover/ins:opacity-100 transition-opacity">Add</span>
          </button>
        }
      >
        {renderAddItems(secIdx, idx)}
      </PopMenu>
    </div>
  );

  // ── Paste-into-the-chart (Labs: pasteIntoChart) ──────────────────────────
  // One rule: a paste fills the section it lands in, and expands into siblings
  // if the pasted text carries its own headers. A brand-new song is a single
  // empty section, so a whole-song paste into it becomes the whole song —
  // there is no separate "new song mode" doing that.
  //
  // A paste dropped on the canvas background (not on any section) replaces the
  // chart, which is what aiming at nothing in particular means.
  const handleCanvasPaste = useCallback((e) => {
    if (!onPasteChart) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    // Single-line pastes are word-level edits, not charts.
    if (!text.trim() || !text.includes('\n')) return;

    const el = e.target;
    const songIsEmpty = placements.every(p => (p.lines || []).every(l => !String(l.plainText ?? '').trim()));
    // Typing surfaces keep their own paste behaviour, except on an empty song
    // where filling it is unambiguously the point.
    if (el?.closest?.('input, textarea, [contenteditable="true"]') && !songIsEmpty) return;

    const card = el?.closest?.('[data-drag-idx]');
    const idx = card ? Number(card.getAttribute('data-drag-idx')) : NaN;
    e.preventDefault();
    onPasteChart(text, Number.isInteger(idx) ? idx : null);
  }, [onPasteChart, placements]);

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start typing in the Advanced tab to use Arrange mode</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full" onPaste={handleCanvasPaste}>
      {/* Structure — the song map. In Auto it follows the section cards below
          (compact jump chips); tap Customize to set a hand-made order with
          repeats, which then shows as draggable chips. Chord notation lives in
          the Aa display menu now, so this row stays calm. */}
      {placements.length > 0 && (() => {
        const isCustom = song.structureMode === 'custom';
        // The play order is ALWAYS the thing on screen. It used to exist only
        // after you found a "Customize" link — so a chorus sung three times was
        // invisible until then, even though the play order is the actual model
        // (one section, referenced three times). While it matches the sections
        // it's simply derived from them; the first edit makes it yours, because
        // onStructureChange already flips structureMode to custom.
        const playOrder = isCustom ? (song.structure || []) : placements.map(p => p.type);
        const uniqueTypes = [...new Set(placements.map(p => p.type))];
        const jumpTo = (name) => {
          const idx = placements.findIndex(p => p.type === name);
          if (idx >= 0) sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const toggleBtn = isCustom ? (
          <button type="button" onClick={() => setStructureMode(false)} title="Go back to following the sections below" className="shrink-0 text-label-11 font-semibold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer">Reset</button>
        ) : null;
        const chips = (
          <PlayOrderEditor
            order={playOrder}
            availableTypes={uniqueTypes}
            customSectionTypes={customSectionTypes}
            onJump={jumpTo}
            onChange={(next) => onStructureChange(next.join(', '))}
          />
        );
        return (
          // Below xl the play order is a strip above the chart. From xl up it
          // moves into the rail beside it (see below) — on a wide monitor the
          // sections don't want to be 1400px wide, so the space next to them
          // was dead. This puts the song map in it.
          <div className="shrink-0 border-b border-[var(--border-1)] px-3 sm:pr-6 py-1.5 xl:hidden">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span
                className="shrink-0 text-label-10 uppercase tracking-[0.12em] font-semibold text-[var(--ds-gray-500)] select-none"
                title="The order the song is played. Drag to reorder, + to repeat a section, × to drop one. Tap a chip to jump to it."
              >
                Play order
              </span>
              {/* Toggle: pinned right on mobile's first row; inline (after chips) on desktop. */}
              <div className="ml-auto sm:hidden shrink-0">{toggleBtn}</div>
              <div className="basis-full order-last sm:basis-auto sm:order-none min-w-0 flex items-center gap-1.5 overflow-x-auto sm:pl-1">
                {chips}
              </div>
              <div className="hidden sm:block shrink-0 ml-1">{toggleBtn}</div>
            </div>
          </div>
        );
      })()}

      <div className="flex-1 min-h-0 flex">
      {/* Play-order rail — xl and up only. Sits on the LEFT: it is the song
          map, and a map belongs before the thing it describes. */}
      {placements.length > 0 && (
        <aside className="hidden xl:flex w-60 shrink-0 flex-col border-r border-[var(--border-1)] overflow-y-auto px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-label-10 uppercase tracking-[0.12em] font-semibold text-[var(--ds-gray-500)] select-none"
              title="The order the song is played. Drag to reorder, + to play a section again, × to drop it. Click a row to jump to it."
            >
              Play order
            </span>
            {song.structureMode === 'custom' && (
              <button
                type="button"
                onClick={() => setStructureMode(false)}
                title="Go back to following the sections"
                className="ml-auto shrink-0 text-label-11 font-semibold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <PlayOrderEditor
            vertical
            order={song.structureMode === 'custom' ? (song.structure || []) : placements.map(p => p.type)}
            availableTypes={[...new Set(placements.map(p => p.type))]}
            customSectionTypes={customSectionTypes}
            onJump={(name) => {
              const idx = placements.findIndex(p => p.type === name);
              if (idx >= 0) sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onChange={(next) => onStructureChange(next.join(', '))}
          />
          <p className="mt-2 text-label-11 text-[var(--ds-gray-500)] leading-snug">
            {song.structureMode === 'custom'
              ? 'Your order. Reset to follow the sections again.'
              : 'Following the sections. Drag or + to make it yours.'}
          </p>
        </aside>
      )}
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 overflow-auto px-3 sm:pr-6 pt-3 pb-8"
        onDragOver={dragIdx != null ? (e) => updateAutoScroll(e.clientY) : undefined}
      >
        {placements.map((sec, secIdx) => {
          const s = sectionStyle(sec.type, null, customSectionTypes);
          const base = sectionBaseType(sec.type);
          const num = (sec.type.match(/(\d+)\s*:?\s*$/) || [])[1] || '';
          const typeOptions = !base || sectionTypes.includes(base) ? sectionTypes : [base, ...sectionTypes];
          const isCollapsed = !!collapsed[secIdx];
          const isReordering = dragIdx != null;
          const isDragging = dragIdx === secIdx;
          const isDropTarget = isReordering && dragIdx !== secIdx && dragOverIdx === secIdx;
          // While reordering, every card collapses to its header so the whole
          // song is a short, easy-to-aim stack (restores on drop — no mutation
          // of the real collapsed state).
          const showBody = !isCollapsed && !isReordering;
          return (
            <div
              key={secIdx}
              data-drag-idx={secIdx}
              onDragEnter={() => { if (dragIdx != null) setDragOverIdx(secIdx); }}
              onDragOver={(e) => { if (dragIdx != null) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); endDrag(); }}
              className={`group/sec relative mb-1 rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] px-3 pt-2 pb-3 transition-opacity ${isDragging ? 'opacity-40' : ''}`}
              ref={el => { sectionRefs.current[secIdx] = el; }}
            >
              {/* Drop insertion line — sits in the gap above/below the target. */}
              {isDropTarget && (
                <div
                  className="pointer-events-none absolute left-1 right-1 h-[3px] rounded-full bg-[var(--color-brand)] z-[1]"
                  style={{ [dragIdx > secIdx ? 'top' : 'bottom']: -10 }}
                />
              )}
              {/* Section header */}
              <div className="flex items-center gap-1.5 mb-2">
                {/* Drag handle — only the grip starts a drag, so the card's
                    inner fields (lyrics, chords, cue) stay fully interactive. */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Drag to reorder section"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => onGripDragStart(secIdx, e)}
                  onDragEnd={endDrag}
                  onTouchStart={() => beginTouchDrag(secIdx)}
                  style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                  className="shrink-0 w-4 h-6 grid place-items-center cursor-grab active:cursor-grabbing text-[var(--ds-gray-400)] hover:text-[var(--ds-gray-700)] touch-none transition-opacity sm:opacity-40 sm:group-hover/sec:opacity-100"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                    <circle cx="2.5" cy="3" r="1.3" /><circle cx="7.5" cy="3" r="1.3" />
                    <circle cx="2.5" cy="8" r="1.3" /><circle cx="7.5" cy="8" r="1.3" />
                    <circle cx="2.5" cy="13" r="1.3" /><circle cx="7.5" cy="13" r="1.3" />
                  </svg>
                </span>
                <button
                  type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [secIdx]: !c[secIdx] }))}
                  aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                  className="shrink-0 w-5 h-5 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--ds-gray-600)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <SectionTypePicker
                  value={base}
                  num={num}
                  options={typeOptions}
                  customSectionTypes={customSectionTypes}
                  onChange={(t) => changeSectionType(secIdx, t)}
                />
                <input
                  value={sec.note || ''}
                  onChange={e => updateSectionNote(secIdx, e.target.value)}
                  placeholder="cue..."
                  className="flex-1 bg-transparent border-none text-label-11 italic text-[var(--text-2)] outline-none min-w-0 px-1"
                  style={{ borderLeft: sec.note ? `2px solid ${s.br}` : 'none' }}
                />
                {/* Action cluster — edit lyrics / edit source. Always visible on
                    touch (their only home there); hover/focus-revealed on desktop
                    so the header stays calm. */}
                <div className="flex items-center shrink-0 transition-opacity sm:opacity-0 sm:group-hover/sec:opacity-100 sm:focus-within:opacity-100">
                  <IconButton variant={lyricMode[secIdx] ? 'active' : 'ghost'} size="sm" aria-label="Edit lyrics" title="Edit lyrics" onClick={() => handleEditText(secIdx)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </IconButton>
                  <IconButton variant={sourceMode[secIdx] ? 'active' : 'ghost'} size="sm" aria-label="Edit source" title="Edit raw source" onClick={() => toggleSource(secIdx)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                  </IconButton>
                </div>
                <PopMenu
                  menuClassName="w-44"
                  trigger={
                    <IconButton variant="ghost" size="sm" aria-label="Section options" title="Section options">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                    </IconButton>
                  }
                >
                  <MenuItem onClick={() => duplicateSection(secIdx)}>Duplicate section</MenuItem>
                  <MenuItem danger onClick={() => removeSection(secIdx)}>Delete section</MenuItem>
                </PopMenu>
              </div>

              {/* Lines (or the raw Source editor when toggled) */}
              {showBody && (sourceMode[secIdx] ? (
                <SectionSourceEditor
                  key={`src-${secIdx}`}
                  initial={serializeSectionLines(song.sections[secIdx]?.lines || [])}
                  onCommit={(text) => handleDrawerSave(secIdx, text)}
                />
              ) : lyricMode[secIdx] ? (
                <InlineSectionLyricEditor
                  key={`lyr-${secIdx}`}
                  initial={lyricsOnly(song.sections[secIdx]?.lines || [])}
                  onCommit={(text) => handleLyricSave(secIdx, text)}
                />
              ) : (
                <div>
                  {/* Truly empty section (no lines survive the .md round-trip) —
                      still offer the composer so a freshly added section (or one
                      cleared out) can be written into / pasted into. */}
                  {sec.lines.length === 0 && (
                    lyricComposer === secIdx ? (
                      <div className="mb-2">
                        <InlineLyricComposer
                          onCommit={(t) => commitLyricComposer(secIdx, t)}
                          onCancel={() => setLyricComposer(null)}
                        />
                      </div>
                    ) : (
                      <div className="mb-2">
                        <button type="button" onClick={() => setLyricComposer(secIdx)} className="text-copy-13 italic text-[var(--ds-gray-500)] bg-transparent border-none cursor-text px-1 py-1">
                          Tap to add lyrics or paste a chord sheet…
                        </button>
                      </div>
                    )
                  )}
                  {sec.lines.map((line, lineIdx) => {
                    let el = null;
                    if (typeof line === 'object' && (line.type === 'tab' || line.type === 'tabref')) {
                      const tabData = line.type === 'tabref' ? line.tab : line;
                      el = (
                        <div className="relative inline-flex flex-col max-w-full my-1.5 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] py-1.5 pl-2 pr-12">
                          <div className="absolute top-1 right-1 flex items-center gap-0.5">
                            {line.type === 'tabref' && line.tab && (
                              <button
                                type="button"
                                onClick={() => setTabEditorTarget({ mode: 'editLib', name: line.name, tab: line.tab })}
                                aria-label="Edit tab" title="Edit this tab"
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--ds-gray-500)] hover:text-[var(--color-brand)] hover:bg-[var(--ds-gray-alpha-100)] bg-transparent border-none cursor-pointer leading-none"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeLine(secIdx, lineIdx)}
                              aria-label="Remove tab"
                              title={line.type === 'tabref' ? 'Remove from this section (keeps the saved tab)' : 'Remove tab'}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--ds-gray-500)] hover:text-[var(--ds-red-700)] hover:bg-[var(--ds-gray-alpha-100)] bg-transparent border-none cursor-pointer leading-none"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                          {line.type === 'tabref' && (
                            <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)] mb-1 pl-0.5">{line.name}</span>
                          )}
                          {tabData
                            ? <TabBlock data={tabData} scale={0.8} />
                            : <span className="text-copy-12 italic text-[var(--ds-red-700)]">Missing tab “{line.name}”</span>}
                        </div>
                      );
                    } else if (typeof line === 'object' && line.type === 'modulate') {
                      el = (
                        <div className="my-4 flex items-center gap-3">
                          <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                          <span className="inline-flex items-center gap-0.5 pl-1 pr-1 py-0.5 bg-[var(--color-brand)] text-white rounded-full shadow-sm">
                            <button type="button" onClick={() => stepModulate(secIdx, lineIdx, line.semitones, -1)} aria-label="Lower key change" title="Lower key change" className="shrink-0 w-5 h-5 grid place-items-center rounded-full hover:bg-white/25 bg-transparent border-none cursor-pointer text-white leading-none">−</button>
                            <span className="text-label-10 font-black uppercase tracking-[0.15em] px-1.5 tabular-nums select-none">
                              Key Change: {line.semitones > 0 ? '+' : ''}{line.semitones}
                            </span>
                            <button type="button" onClick={() => stepModulate(secIdx, lineIdx, line.semitones, 1)} aria-label="Raise key change" title="Raise key change" className="shrink-0 w-5 h-5 grid place-items-center rounded-full hover:bg-white/25 bg-transparent border-none cursor-pointer text-white leading-none">+</button>
                          </span>
                          <button type="button" onClick={() => removeLine(secIdx, lineIdx)} aria-label="Remove key change" className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[var(--ds-gray-600)] hover:text-[var(--ds-red-700)] hover:bg-[var(--ds-gray-alpha-100)] bg-transparent border-none cursor-pointer leading-none">✕</button>
                          <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                        </div>
                      );
                    } else if (line.plainText !== undefined) {
                      if ((line.plainText || '').trim() === '' && (line.chords?.length > 0)) {
                        el = <div className="mb-1 last:mb-0"><ChordOnlyLine chords={line.chords} secIdx={secIdx} lineIdx={lineIdx} onEditChord={openEditChord} onAppend={appendChord} onRemoveChord={removeChordAt} /></div>;
                      } else if ((line.plainText || '').trim() === '' && (!line.chords || line.chords.length === 0)) {
                        el = lyricComposer === secIdx ? (
                          <div className="mb-2 last:mb-0">
                            <InlineLyricComposer
                              onCommit={(t) => commitLyricComposer(secIdx, t)}
                              onCancel={() => setLyricComposer(null)}
                            />
                          </div>
                        ) : (
                          <div className="mb-2 last:mb-0">
                            <button type="button" onClick={() => setLyricComposer(secIdx)} className="text-copy-13 italic text-[var(--ds-gray-500)] bg-transparent border-none cursor-text px-1 py-1">
                              Tap to add lyrics or paste a chord sheet…
                            </button>
                          </div>
                        );
                      } else {
                        const noteOpen = noteTarget && noteTarget.secIdx === secIdx && noteTarget.lineIdx === lineIdx;
                        el = (
                          <div className="group/line relative mb-1 last:mb-0 flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <InteractiveLine
                                plainText={line.plainText}
                                chords={line.chords}
                                secIdx={secIdx}
                                lineIdx={lineIdx}
                                editingChordIdx={entry && entry.secIdx === secIdx && entry.lineIdx === lineIdx ? entry.chordIdx : null}
                                armedCharPos={entry && entry.secIdx === secIdx && entry.lineIdx === lineIdx && entry.charPos != null ? entry.charPos : null}
                                notation={notation}
                                lyricSize={lyricSize}
                                chordSize={chordSize}
                                songKey={song.key}
                                onPlace={openAddChord}
                                onChordTap={openEditChord}
                                onMoveChord={moveChordTo}
                              />
                              {noteOpen ? (
                                <InlineNoteInput
                                  initial={line.inlineNote || ''}
                                  onCommit={(t) => { setInlineNote(secIdx, lineIdx, t); setNoteTarget(null); }}
                                  onClose={() => setNoteTarget(null)}
                                />
                              ) : line.inlineNote ? (
                                <button
                                  type="button"
                                  onClick={() => setNoteTarget({ secIdx, lineIdx })}
                                  title="Edit comment"
                                  className="text-[var(--text-2)] italic text-[0.8em] bg-transparent border-none cursor-text p-0 text-left"
                                >
                                  {' ---- '}{line.inlineNote}
                                </button>
                              ) : null}
                            </div>
                            {!noteOpen && !line.inlineNote && (
                              <button
                                type="button"
                                onClick={() => setNoteTarget({ secIdx, lineIdx })}
                                aria-label="Add comment"
                                title="Add a comment to this line"
                                className="shrink-0 mt-0.5 w-7 h-7 grid place-items-center rounded-md text-[var(--ds-gray-500)] hover:text-[var(--color-brand)] hover:bg-[var(--ds-gray-100)] bg-transparent border-none cursor-pointer opacity-45 group-hover/line:opacity-100 focus:opacity-100 transition-opacity"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                              </button>
                            )}
                          </div>
                        );
                      }
                    }
                    return (
                      <Fragment key={lineIdx}>
                        {renderInsertPoint(secIdx, lineIdx)}
                        {draftTarget && draftTarget.secIdx === secIdx && draftTarget.idx === lineIdx && (
                          <div className="mb-2"><DraftLyricInput onCommit={(t) => commitDraftLyric(secIdx, lineIdx, t)} onClose={() => setDraftTarget(null)} /></div>
                        )}
                        {el}
                      </Fragment>
                    );
                  })}

                  {/* Inline lyric draft appended at the end */}
                  {draftTarget && draftTarget.secIdx === secIdx && draftTarget.idx == null && (
                    <div className="mb-2">
                      <DraftLyricInput onCommit={(t) => commitDraftLyric(secIdx, null, t)} onClose={() => setDraftTarget(null)} />
                    </div>
                  )}

                  {/* Trailing add point — the same between-lines "+" affordance,
                      appended at the section end (the only per-section adder). */}
                  {renderInsertPoint(secIdx, sec.lines.length)}
                </div>
              ))}
            </div>
          );
        })}

        {/* One "+ Add section" button — a menu picks the section type. */}
        <div className="mt-4 mb-8">
          <PopMenu
            align="left"
            menuClassName="w-52 max-h-[50vh]"
            trigger={
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-label-12 font-semibold bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add section
              </button>
            }
          >
            <SectionTypeMenuItems options={sectionTypes} customSectionTypes={customSectionTypes} onPick={(t) => addSection(t)} />
          </PopMenu>
        </div>
        {/* Scroll sentinel — a freshly added section scrolls this into view
            (deferred via scrollPendingRef, same idiom as the setlist builder). */}
        <div ref={listEndRef} className="h-px" style={{ scrollMarginBottom: '6rem' }} />
      </div>

      </div>

      {/* Full-width chord entry bar (all devices) */}
      {entry && (
        <ChordAutocomplete
          initial={entry.initial}
          editing={entry.chordIdx != null}
          songKey={song.key}
          recents={recentChords}
          // On a fine pointer (mouse/trackpad) show the picker as a popup right at
          // the clicked chord/position; on touch keep the full-width bottom bar so
          // the on-screen keyboard doesn't cover it.
          anchorRect={(entry.anchor && typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)
            ? { left: entry.anchor.x, top: entry.anchor.y, bottom: entry.anchor.y }
            : null}
          onCommit={commitChord}
          onRemove={entry.chordIdx != null ? () => removeChordAt(entry.secIdx, entry.lineIdx, entry.chordIdx) : null}
          onClose={() => setEntry(null)}
        />
      )}

      {/* Tab tool — create a new library tab (and reference it) or edit an
          existing library block in place. */}
      {tabEditorTarget && (() => {
        const editing = tabEditorTarget.mode === 'editLib' ? tabEditorTarget.tab : null;
        const instr = editing ? instrumentForStrings(editing.strings?.length) : 'electric';
        return (
          <TabGridEditor
            initialTab={editing}
            time={editing?.time || song.time}
            strings={editing ? editing.strings.map(s => s.note) : TAB_INSTRUMENTS[instr].strings}
            tunings={TAB_INSTRUMENTS[instr].tunings}
            instrument={instr}
            counts={TAB_INSTRUMENTS[instr].counts}
            onSave={handleTabToolSave}
            onClose={() => setTabEditorTarget(null)}
          />
        );
      })()}

      {/* Key change dialog */}
      {keyChangeTarget && (
        <KeyChangeDialog
          onConfirm={(steps, addChords) => confirmKeyChange(keyChangeTarget, steps, addChords)}
          onClose={() => setKeyChangeTarget(null)}
        />
      )}
    </div>
  );
}
