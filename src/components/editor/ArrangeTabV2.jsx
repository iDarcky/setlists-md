import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, memo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { parseSongMd, songToMd, placementToLine, parseTabBlock, parseSectionLines } from '../../parser';
import { sectionStyle, getNashvilleNumber, getSolfege } from '../../music';
import TabBlock from '../TabBlock';
import TabGridEditor from './TabGridEditorV2';
import KeyChangeDialog from './KeyChangeDialog';
import { TAB_INSTRUMENTS, instrumentForStrings } from './tabInstruments';
import SectionDrawer from './SectionDrawer';
import StructureControl from './StructureControl';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { caretOffsetFromPoint, parsePlacementLine, sectionBaseType } from './arrangeHelpers';
import { loadRecents, saveRecents, pushRecent } from './chordRecents';
import ChordAutocomplete from './ChordAutocomplete';
import { useConfirm } from '../ui/useConfirmHook';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];
const TEMPLATE_TYPES = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus', 'Intro', 'Tag', 'Instrumental'];

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
  plainText, chords, secIdx, lineIdx, editingChordIdx, armedCharPos,
  notation, songKey,
  onPlace, onChordTap,
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const downRef = useRef(null);
  const [chips, setChips] = useState([]);
  const [caret, setCaret] = useState(null);
  const [armedCaret, setArmedCaret] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [tick, setTick] = useState(0);

  const indexedChords = useMemo(
    () => (chords || []).map((c, i) => ({ chord: c.chord, pos: c.pos, origIdx: i })),
    [chords],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;
    const textNode = textEl.firstChild;
    const len = textNode && textNode.nodeType === 3 ? textNode.length : 0;
    const cRect = container.getBoundingClientRect();
    const measure = (pos) => {
      if (!textNode || len === 0) {
        const r = textEl.getBoundingClientRect();
        return { left: r.left - cRect.left, top: r.top - cRect.top };
      }
      const atEnd = pos >= len;
      const i = atEnd ? len - 1 : Math.max(0, pos);
      const range = document.createRange();
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const r = range.getClientRects()[0];
      if (!r) return null;
      return { left: (atEnd ? r.right : r.left) - cRect.left, top: r.top - cRect.top };
    };
    const next = [];
    for (const c of indexedChords) {
      const m = measure(c.pos);
      if (m) next.push({ chord: c.chord, origIdx: c.origIdx, left: m.left, top: m.top });
    }
    next.sort((a, b) => a.top - b.top || a.left - b.left);
    const CHAR_W = 7.8;
    for (let i = 1; i < next.length; i++) {
      const prev = next[i - 1];
      if (Math.abs(next[i].top - prev.top) < 4) {
        const prevRight = prev.left + prev.chord.length * CHAR_W + 4;
        if (next[i].left < prevRight) next[i].left = prevRight;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChips(next);
    setCaret(hoverPos != null ? measure(hoverPos) : null);
    setArmedCaret(armedCharPos != null ? measure(armedCharPos) : null);
  }, [plainText, indexedChords, hoverPos, armedCharPos, tick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick(t => t + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Distinguish a tap (place a chord) from a scroll/drag. Mouse hovers show a
  // guide caret; touch never opens on the initial press — only on a clean
  // pointerup that didn't move, so swiping to scroll won't fire the popover.
  const handlePointerMove = (e) => {
    if (downRef.current) {
      const d = downRef.current;
      if (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8) { d.moved = true; setHoverPos(null); }
      return;
    }
    if (e.pointerType !== 'touch') {
      const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
      if (pos != null) setHoverPos(pos);
    }
  };
  const handlePointerLeave = () => setHoverPos(null);
  const handlePointerDown = (e) => {
    downRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const handlePointerUp = (e) => {
    const d = downRef.current;
    downRef.current = null;
    if (!d || d.moved) return;
    const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
    onPlace(secIdx, lineIdx, pos == null ? (plainText?.length || 0) : pos, e.clientX, e.clientY);
  };

  return (
      <div
        ref={containerRef}
        className="relative font-mono min-w-0"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { downRef.current = null; setHoverPos(null); }}
        style={{ cursor: 'text', fontSize: 16, lineHeight: 2.0, paddingTop: '1.1em', touchAction: 'pan-y' }}
      >
        <div ref={textRef} className="whitespace-pre-wrap text-[var(--text-1)]">
          {plainText ? plainText : ' '}
        </div>
        {chips.map((c) => {
          const selected = editingChordIdx === c.origIdx;
          return (
            <span
              key={c.origIdx}
              className="absolute font-bold cursor-pointer"
              style={{
                left: c.left, top: c.top, transform: 'translateY(-100%)', lineHeight: 1, fontSize: 13,
                color: selected ? 'var(--color-brand)' : 'var(--chord)',
                borderBottom: selected ? '2px solid var(--color-brand)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                padding: '6px 8px 2px 0',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onChordTap(secIdx, lineIdx, c.origIdx, e.clientX, e.clientY); }}
            >
              {formatChord(c.chord, notation, songKey)}
            </span>
          );
        })}
        {caret && (
          <span className="absolute pointer-events-none" style={{ left: caret.left, top: caret.top, width: 2, height: '1.2em', background: 'var(--chord)', opacity: 0.6 }} aria-hidden="true" />
        )}
        {armedCaret && (
          <span className="absolute pointer-events-none" style={{ left: armedCaret.left - 1, top: armedCaret.top, width: 2.5, height: '1.2em', background: 'var(--color-brand)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-brand) 25%, transparent)' }} aria-hidden="true" />
        )}
      </div>
  );
});

// ─── Popover menu ─────────────────────────────────────────────────
// The menu is rendered in a portal (fixed, anchored to the trigger) so it
// escapes the Arrange scroll container's `overflow-auto` clip and sits above
// the editor's sticky header — otherwise an upward-opening "+ Add" menu got
// cut off / hidden under the header.
function PopMenu({ trigger, align = 'right', up = false, children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Measure the trigger and open. Coords are computed at toggle time (not in an
  // effect) so the fixed-positioned portal lands without a cascading render.
  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (wasOpen) return false;
      const el = triggerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setCoords({
          left: align === 'right' ? null : r.left,
          right: align === 'right' ? window.innerWidth - r.right : null,
          top: up ? null : r.bottom + 4,
          bottom: up ? window.innerHeight - r.top + 4 : null,
        });
      }
      return true;
    });
  }, [align, up]);

  useEffect(() => {
    if (!open) return;
    const inside = (t) => triggerRef.current?.contains(t) || menuRef.current?.contains(t);
    const onPointer = (e) => { if (!inside(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // Close when an ancestor scrolls (the menu is fixed, so it would detach).
    // Ignore scrolling inside the menu's own overflow.
    const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative inline-block">
      <span onClick={toggle}>{trigger}</span>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            left: coords.left != null ? coords.left : undefined,
            right: coords.right != null ? coords.right : undefined,
            top: coords.top != null ? coords.top : undefined,
            bottom: coords.bottom != null ? coords.bottom : undefined,
          }}
          className="z-[80] min-w-[180px] max-h-[60vh] overflow-y-auto rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1"
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
function MenuItem({ onClick, children, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left px-3 py-2.5 text-copy-13 cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)] ${danger ? 'text-[var(--ds-red-700)] font-semibold' : 'text-[var(--ds-gray-1000)]'}`}>
      {children}
    </button>
  );
}

// ─── Section type picker ──────────────────────────────────────────
// Custom dropdown so each type carries its own section color and the number
// sits snug next to the label (a native <select> can't colour per-option or
// hug the value).
function SectionTypePicker({ value, num, options, customSectionTypes, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const cur = sectionStyle(value, null, customSectionTypes);
  return (
    <div ref={ref} className="relative inline-flex items-baseline">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-baseline gap-1 bg-transparent border-none cursor-pointer outline-none p-0 text-label-14 font-black uppercase tracking-[0.15em]"
        style={{ color: cur.b }}
      >
        <span>{value}</span>
        {num && <span className="font-black">{num}</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-50 self-center"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute z-50 left-0 top-full mt-1 min-w-[170px] max-h-[60vh] overflow-y-auto rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl py-1">
          {options.map(t => {
            const st = sectionStyle(t, null, customSectionTypes);
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setOpen(false); if (t !== value) onChange(t); }}
                className="w-full text-left px-3 py-2 text-label-13 font-bold uppercase tracking-wider cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)]"
                style={{ color: st.b }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
      className="w-full bg-transparent border-b border-dashed border-[var(--ds-gray-400)] text-[var(--text-1)] font-mono outline-none py-1.5 px-1"
      style={{ fontSize: 16 }}
    />
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
export default function ArrangeTabV2({ md, onChange, customSectionTypes }) {
  const sectionTypes = useMemo(() => {
    const custom = (customSectionTypes || []).map(t => t?.name?.trim()).filter(Boolean);
    return [...SECTION_TYPES, ...custom];
  }, [customSectionTypes]);

  const [drawerTarget, setDrawerTarget] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  // Chord entry target: null, or { secIdx, lineIdx, charPos, chordIdx, initial }.
  // A full-width bottom bar handles entry on every device.
  const [entry, setEntry] = useState(null);
  // Reading-aid notation for chord labels: 'chords' | 'nashville' | 'solfege'.
  const [notation, setNotation] = useState('chords');
  // Tab tool target: { mode:'new', secIdx, idx } | { mode:'editLib', name, tab } | null
  const [tabEditorTarget, setTabEditorTarget] = useState(null);
  const [draftTarget, setDraftTarget] = useState(null); // { secIdx, idx } open inline lyric draft
  const [keyChangeTarget, setKeyChangeTarget] = useState(null); // { secIdx, idx } key-change dialog
  const confirm = useConfirm();
  const sectionRefs = useRef({});
  const jumpTo = useCallback((idx) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  const emitSong = useCallback((updatedSong) => onChange(songToMd(updatedSong)), [onChange]);

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
  const openAddChord = useCallback((secIdx, lineIdx, charPos) => {
    setEntry({ secIdx, lineIdx, charPos, chordIdx: null, initial: '' });
  }, []);
  const openEditChord = useCallback((secIdx, lineIdx, chordIdx) => {
    const cur = placements[secIdx]?.lines[lineIdx]?.chords?.[chordIdx]?.chord || '';
    setEntry({ secIdx, lineIdx, charPos: null, chordIdx, initial: cur });
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

  const appendChord = useCallback((secIdx, lineIdx) => {
    const line = placements[secIdx]?.lines[lineIdx];
    const pos = ((line?.chords?.length) || 0) * 4;
    // ensure text is padded so the chord round-trips
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((ln, li) => (li === lineIdx && ln.plainText !== undefined)
        ? { ...ln, plainText: ' '.repeat(pos + 1) }
        : ln),
    })));
    setEntry({ secIdx, lineIdx, chordIdx: null, charPos: pos, initial: '' });
  }, [placements, applyMutation]);

  // ─── Section operations ───
  const labelFor = useCallback((base, count) => `${base} ${count + 1}`, []);

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
    const count = song.sections.filter(s => sectionBaseType(s.type) === base).length;
    emitSections([...song.sections, { type: labelFor(base, count), note: '', lines: [''] }]);
  }, [song, emitSections, labelFor]);

  const duplicateSection = useCallback((idx) => {
    if (!song) return;
    const src = song.sections[idx];
    const base = sectionBaseType(src.type);
    const count = song.sections.filter(s => sectionBaseType(s.type) === base).length;
    const copy = { ...src, type: labelFor(base, count), lines: [...src.lines] };
    emitSections([...song.sections.slice(0, idx + 1), copy, ...song.sections.slice(idx + 1)]);
  }, [song, emitSections, labelFor]);

  const removeSection = useCallback(async (idx) => {
    if (!song) return;
    const ok = await confirm({
      title: 'Delete this section?',
      description: 'This removes the section and everything in it from the song.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    emitSections(song.sections.filter((_, i) => i !== idx));
  }, [song, emitSections, confirm]);

  const moveSection = useCallback((idx, dir) => {
    if (!song) return;
    const j = idx + dir;
    if (j < 0 || j >= song.sections.length) return;
    const arr = [...song.sections];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    emitSections(arr);
  }, [song, emitSections]);

  const changeSectionType = useCallback((idx, base) => {
    if (!song) return;
    const count = song.sections.filter((s, i) => i < idx && sectionBaseType(s.type) === base).length;
    emitSections(song.sections.map((s, i) => i === idx ? { ...s, type: labelFor(base, count) } : s));
  }, [song, emitSections, labelFor]);

  const updateSectionNote = useCallback((idx, note) => {
    if (!song) return;
    emitSong({ ...song, sections: song.sections.map((s, i) => i === idx ? { ...s, note } : s) });
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

  // Text is edited a whole section at a time (the bottom-sheet drawer) — robust
  // on mobile where a per-line inline input gets hidden under the keyboard.
  const handleEditText = useCallback((secIdx) => {
    setEntry(null);
    setDrawerTarget(secIdx);
  }, []);

  const handleDrawerSave = useCallback((sectionIndex, rawText) => {
    if (!song) return;
    // Re-parse the edited text so tab/modulate/tabref blocks are reconstructed
    // as objects. A naive rawText.split('\n') flattened `{tab}` blocks into
    // plain strings, so the tab disappeared on the next parse cycle.
    const lines = parseSectionLines(rawText);
    const sections = song.sections.map((sec, i) => i !== sectionIndex ? sec : ({ ...sec, lines }));
    emitSong({ ...song, sections });
    setDrawerTarget(null);
  }, [song, emitSong]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setEntry(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
    <div key={`ins-${idx}`} className="group/ins relative h-2 flex items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent group-hover/ins:bg-[var(--ds-gray-300)]" />
      <PopMenu
        align="left"
        trigger={
          <button type="button" aria-label="Insert here" className="relative z-[1] w-5 h-5 rounded-full flex items-center justify-center bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] opacity-0 group-hover/ins:opacity-100 hover:text-[var(--color-brand)] hover:border-[var(--color-brand-border)] cursor-pointer text-[13px] leading-none transition-opacity">+</button>
        }
      >
        {renderAddItems(secIdx, idx)}
      </PopMenu>
    </div>
  );

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start typing in the Advanced tab to use Arrange mode</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* The song's official structure (slide order). A checkbox toggles a custom
          slide order; chips show the play order (tap to jump). A Customize popover
          sits on the right. Shared with the Advanced tab so the two always match. */}
      <div className="shrink-0 flex items-center gap-2 pl-3 pr-6 py-1.5 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-200)]">
        <StructureControl
          mode={song.structureMode}
          value={(song.structure || []).join(', ')}
          sections={placements.map(p => p.type)}
          customSectionTypes={customSectionTypes}
          onToggleMode={setStructureMode}
          onChangeValue={onStructureChange}
          onJump={(name) => { const i = placements.findIndex(p => p.type === name); if (i >= 0) jumpTo(i); }}
        />
        <PopMenu
          trigger={
            <IconButton variant="ghost" size="sm" aria-label="Customize" title="Customize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
            </IconButton>
          }
        >
          <div className="px-3 py-2" onClick={e => e.stopPropagation()}>
            <div className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)] mb-1.5">Notation</div>
            <div className="flex gap-1">
              {[{ id: 'chords', label: 'ABC' }, { id: 'nashville', label: '123' }, { id: 'solfege', label: 'Do' }].map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setNotation(o.id)}
                  className={`px-2.5 py-1 rounded-md text-label-11 font-semibold cursor-pointer border ${
                    notation === o.id ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]' : 'bg-transparent text-[var(--ds-gray-600)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-100)]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </PopMenu>
      </div>

      <div className="flex-1 overflow-auto pl-3 pr-6 pt-3 pb-8">
        {placements.map((sec, secIdx) => {
          const s = sectionStyle(sec.type, null, customSectionTypes);
          const base = sectionBaseType(sec.type);
          const num = (sec.type.match(/(\d+)\s*:?\s*$/) || [])[1] || '';
          const typeOptions = !base || sectionTypes.includes(base) ? sectionTypes : [base, ...sectionTypes];
          const isCollapsed = !!collapsed[secIdx];
          return (
            <div key={secIdx} className="mb-6" ref={el => { sectionRefs.current[secIdx] = el; }}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
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
                <IconButton variant="ghost" size="sm" aria-label="Move section up" title="Move up" disabled={secIdx === 0} onClick={() => moveSection(secIdx, -1)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                </IconButton>
                <IconButton variant="ghost" size="sm" aria-label="Move section down" title="Move down" disabled={secIdx === placements.length - 1} onClick={() => moveSection(secIdx, 1)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </IconButton>
                <IconButton variant="ghost" size="sm" aria-label="Edit lyrics" title="Edit lyrics" onClick={() => handleEditText(secIdx)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </IconButton>
                <PopMenu
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

              {/* Lines */}
              {!isCollapsed && (
                <div>
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
                          <span className="text-label-10 font-black uppercase tracking-[0.2em] px-3 py-1 bg-[var(--color-brand)] text-white rounded-full shadow-sm">
                            Key Change: {line.semitones > 0 ? '+' : ''}{line.semitones}
                          </span>
                          <button type="button" onClick={() => removeLine(secIdx, lineIdx)} aria-label="Remove key change" className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[var(--ds-gray-600)] hover:text-[var(--ds-red-700)] hover:bg-[var(--ds-gray-alpha-100)] bg-transparent border-none cursor-pointer leading-none">✕</button>
                          <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                        </div>
                      );
                    } else if (line.plainText !== undefined) {
                      if ((line.plainText || '').trim() === '' && (line.chords?.length > 0)) {
                        el = <div className="mb-2 last:mb-0"><ChordOnlyLine chords={line.chords} secIdx={secIdx} lineIdx={lineIdx} onEditChord={openEditChord} onAppend={appendChord} onRemoveChord={removeChordAt} /></div>;
                      } else if ((line.plainText || '').trim() === '' && (!line.chords || line.chords.length === 0)) {
                        el = (
                          <div className="mb-2 last:mb-0">
                            <button type="button" onClick={() => handleEditText(secIdx, lineIdx)} className="text-copy-13 italic text-[var(--ds-gray-500)] bg-transparent border-none cursor-text px-1 py-1">
                              Tap to add lyrics…
                            </button>
                          </div>
                        );
                      } else {
                        el = (
                          <div className="mb-2 last:mb-0">
                            <InteractiveLine
                              plainText={line.plainText}
                              chords={line.chords}
                              secIdx={secIdx}
                              lineIdx={lineIdx}
                              editingChordIdx={entry && entry.secIdx === secIdx && entry.lineIdx === lineIdx ? entry.chordIdx : null}
                              armedCharPos={entry && entry.secIdx === secIdx && entry.lineIdx === lineIdx && entry.charPos != null ? entry.charPos : null}
                              notation={notation}
                              songKey={song.key}
                              onPlace={openAddChord}
                              onChordTap={openEditChord}
                            />
                            {line.inlineNote && (
                              <span className="text-[var(--text-2)] italic text-[0.8em]">{' ---- '}{line.inlineNote}</span>
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

                  {/* Per-section add menu (append) */}
                  <div className="mt-1">
                    <PopMenu
                      align="left"
                      up
                      trigger={<button type="button" className="text-label-11 font-semibold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer px-1 py-1">+ Add</button>}
                    >
                      {renderAddItems(secIdx, null)}
                    </PopMenu>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Section templates + add */}
        <div className="mt-4 mb-8 flex flex-wrap items-center gap-1.5">
          <span className="text-label-11 text-[var(--ds-gray-600)] mr-1">Add section:</span>
          {TEMPLATE_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => addSection(t)}
              className="px-2.5 py-1 rounded-full text-label-12 font-medium bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] cursor-pointer"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      {/* Full-width chord entry bar (all devices) */}
      {entry && (
        <ChordAutocomplete
          initial={entry.initial}
          editing={entry.chordIdx != null}
          songKey={song.key}
          recents={recentChords}
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

      {/* Section drawer (bulk lyric edit) */}
      {drawerTarget !== null && song.sections[drawerTarget] && (
        <SectionDrawer
          section={song.sections[drawerTarget]}
          sectionIndex={drawerTarget}
          onSave={handleDrawerSave}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>
  );
}
