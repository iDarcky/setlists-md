import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, memo } from 'react';
import { parseSongMd, songToMd, placementToLine } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import SectionDrawer from './SectionDrawer';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { caretOffsetFromPoint, parsePlacementLine, sectionBaseType } from './arrangeHelpers';
import { loadRecents, saveRecents, pushRecent } from './chordRecents';
import ChordAutocomplete from './ChordAutocomplete';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];
const TEMPLATE_TYPES = ['Verse', 'Chorus', 'Bridge', 'Pre Chorus', 'Intro', 'Tag', 'Instrumental'];

// ─── InteractiveLine (single-phase) ──────────────────────────────────
// Clicking anywhere on the lyric opens the chord autocomplete at that caret;
// tapping an existing chord opens it pre-filled to edit/move/remove. A hover
// caret shows where a chord will land.
const InteractiveLine = memo(function InteractiveLine({
  plainText, chords, secIdx, lineIdx, editingChordIdx,
  onPlace, onChordTap, onEditText,
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [chips, setChips] = useState([]);
  const [caret, setCaret] = useState(null);
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
  }, [plainText, indexedChords, hoverPos, tick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick(t => t + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handlePointerMove = (e) => {
    const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
    if (pos != null) setHoverPos(pos);
  };
  const handlePointerLeave = () => setHoverPos(null);
  const handlePointerDown = (e) => {
    const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
    onPlace(secIdx, lineIdx, pos == null ? (plainText?.length || 0) : pos, e.clientX, e.clientY);
  };

  return (
    <div className="group/line flex items-start gap-1">
      <IconButton
        variant="ghost"
        size="xs"
        aria-label="Edit lyrics"
        title="Edit lyrics"
        onPointerDown={(e) => { e.stopPropagation(); onEditText(secIdx, lineIdx); }}
        className="mt-[1.1em] opacity-40 hover:!opacity-100 shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </IconButton>
      <div
        ref={containerRef}
        className="relative font-mono flex-1 min-w-0"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        style={{ cursor: 'text', fontSize: 16, lineHeight: 2.0, paddingTop: '1.1em' }}
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
              }}
              onPointerDown={(e) => { e.stopPropagation(); onChordTap(secIdx, lineIdx, c.origIdx, e.clientX, e.clientY); }}
            >
              {c.chord}
            </span>
          );
        })}
        {caret && (
          <span className="absolute pointer-events-none" style={{ left: caret.left, top: caret.top, width: 2, height: '1.2em', background: 'var(--chord)', opacity: 0.6 }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
});

// ─── InlineEditor ─────────────────────────────────────────────────
function InlineEditor({ initialValue, onSave, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) { ref.current.focus(); ref.current.selectionStart = ref.current.value.length; }
  }, []);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSave(value); }
    if (e.key === 'Escape') onCancel();
  };
  return (
    <input
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(value)}
      spellCheck={false}
      className="w-full px-2 py-1 bg-[var(--ds-gray-100)] border border-[var(--chord)] rounded text-copy-13 text-[var(--ds-gray-1000)] outline-none font-mono"
      style={{ caretColor: 'var(--chord)' }}
    />
  );
}

// ─── Popover menu ─────────────────────────────────────────────────
function PopMenu({ trigger, align = 'right', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={() => setOpen(v => !v)}>{trigger}</span>
      {open && (
        <div role="menu" onClick={() => setOpen(false)} className={`absolute z-40 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} min-w-[180px] rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl overflow-hidden py-1`}>
          {children}
        </div>
      )}
    </div>
  );
}
function MenuItem({ onClick, children, danger = false }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left px-3 py-2.5 text-copy-13 cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)] ${danger ? 'text-[var(--ds-error-600)]' : 'text-[var(--ds-gray-1000)]'}`}>
      {children}
    </button>
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

  const [editingLine, setEditingLine] = useState(null);
  const [drawerTarget, setDrawerTarget] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [autocomplete, setAutocomplete] = useState(null);

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
          if (typeof line === 'object' && (line.type === 'tab' || line.type === 'modulate')) return line;
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

  // ─── Single-phase chord entry ───
  const openAddChord = useCallback((secIdx, lineIdx, charPos, x, y) => {
    setEditingLine(null);
    setAutocomplete({ secIdx, lineIdx, chordIdx: null, charPos, anchor: { x, y }, initial: '' });
  }, []);
  const openEditChord = useCallback((secIdx, lineIdx, chordIdx, x, y) => {
    const cur = placements[secIdx]?.lines[lineIdx]?.chords?.[chordIdx]?.chord || '';
    setAutocomplete({ secIdx, lineIdx, chordIdx, charPos: null, anchor: { x, y }, initial: cur });
  }, [placements]);

  const commitChord = useCallback((chord) => {
    if (!autocomplete) return;
    const { secIdx, lineIdx, chordIdx, charPos } = autocomplete;
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => {
        if (li !== lineIdx || line.plainText === undefined) return line;
        if (chordIdx != null) {
          // edit existing in place
          return { ...line, chords: line.chords.map((c, ci) => ci === chordIdx ? { ...c, chord } : c) };
        }
        const filtered = line.chords.filter(c => c.pos !== charPos);
        return { ...line, chords: [...filtered, { chord, pos: charPos }].sort((a, b) => a.pos - b.pos) };
      }),
    })));
    addRecent(chord);
  }, [autocomplete, applyMutation, addRecent]);

  const removeChordAt = useCallback((secIdx, lineIdx, chordIdx) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((line, li) => (li === lineIdx && line.plainText !== undefined)
        ? { ...line, chords: line.chords.filter((_, ci) => ci !== chordIdx) }
        : line),
    })));
  }, [applyMutation]);

  const appendChord = useCallback((secIdx, lineIdx, x, y) => {
    const line = placements[secIdx]?.lines[lineIdx];
    const pos = ((line?.chords?.length) || 0) * 4;
    // ensure text is padded so the chord round-trips
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({
      ...sec,
      lines: sec.lines.map((ln, li) => (li === lineIdx && ln.plainText !== undefined)
        ? { ...ln, plainText: ' '.repeat(pos + 1) }
        : ln),
    })));
    setAutocomplete({ secIdx, lineIdx, chordIdx: null, charPos: pos, anchor: { x, y }, initial: '' });
  }, [placements, applyMutation]);

  // ─── Section operations ───
  const labelFor = useCallback((base, count) => `${base} ${count + 1}`, []);

  const addSection = useCallback((base = 'Verse') => {
    if (!song) return;
    const count = song.sections.filter(s => sectionBaseType(s.type) === base).length;
    emitSong({ ...song, sections: [...song.sections, { type: labelFor(base, count), note: '', lines: [''] }] });
  }, [song, emitSong, labelFor]);

  const duplicateSection = useCallback((idx) => {
    if (!song) return;
    const src = song.sections[idx];
    const base = sectionBaseType(src.type);
    const count = song.sections.filter(s => sectionBaseType(s.type) === base).length;
    const copy = { ...src, type: labelFor(base, count), lines: [...src.lines] };
    const sections = [...song.sections.slice(0, idx + 1), copy, ...song.sections.slice(idx + 1)];
    emitSong({ ...song, sections });
  }, [song, emitSong, labelFor]);

  const removeSection = useCallback((idx) => {
    if (!song) return;
    emitSong({ ...song, sections: song.sections.filter((_, i) => i !== idx) });
  }, [song, emitSong]);

  const moveSection = useCallback((idx, dir) => {
    if (!song) return;
    const j = idx + dir;
    if (j < 0 || j >= song.sections.length) return;
    const arr = [...song.sections];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    emitSong({ ...song, sections: arr });
  }, [song, emitSong]);

  const changeSectionType = useCallback((idx, base) => {
    if (!song) return;
    const count = song.sections.filter((s, i) => i < idx && sectionBaseType(s.type) === base).length;
    const sections = song.sections.map((s, i) => i === idx ? { ...s, type: labelFor(base, count) } : s);
    emitSong({ ...song, sections });
  }, [song, emitSong, labelFor]);

  const updateSectionNote = useCallback((idx, note) => {
    if (!song) return;
    emitSong({ ...song, sections: song.sections.map((s, i) => i === idx ? { ...s, note } : s) });
  }, [song, emitSong]);

  // ─── Line operations ───
  const addLine = useCallback((secIdx) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: [...sec.lines, { plainText: '', chords: [], inlineNote: null }] })));
  }, [applyMutation]);
  const addChordLine = useCallback((secIdx, x, y) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: [...sec.lines, { plainText: ' ', chords: [], inlineNote: null }] })));
    const newLineIdx = (placements[secIdx]?.lines.length) || 0;
    setAutocomplete({ secIdx, lineIdx: newLineIdx, chordIdx: null, charPos: 0, anchor: { x, y }, initial: '' });
  }, [applyMutation, placements]);
  const addModulate = useCallback((secIdx, semitones) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: [...sec.lines, { type: 'modulate', semitones }] })));
  }, [applyMutation]);
  const removeLine = useCallback((secIdx, lineIdx) => {
    applyMutation(prev => prev.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: sec.lines.filter((_, li) => li !== lineIdx) })));
  }, [applyMutation]);

  const handleEditText = useCallback((secIdx, lineIdx) => {
    setAutocomplete(null);
    setEditingLine({ secIdx, lineIdx });
  }, []);
  const handleInlineSave = useCallback((secIdx, lineIdx, newText) => {
    if (!song) return;
    const sections = song.sections.map((sec, si) => si !== secIdx ? sec : ({ ...sec, lines: sec.lines.map((line, li) => li === lineIdx ? newText : line) }));
    emitSong({ ...song, sections });
    setEditingLine(null);
  }, [song, emitSong]);

  const handleDrawerSave = useCallback((sectionIndex, rawText) => {
    if (!song) return;
    const sections = song.sections.map((sec, i) => i !== sectionIndex ? sec : ({ ...sec, lines: rawText.split('\n') }));
    emitSong({ ...song, sections });
    setDrawerTarget(null);
  }, [song, emitSong]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setEditingLine(null); setAutocomplete(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start typing in the Advanced tab to use Arrange mode</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex-1 overflow-auto px-4 pt-3 pb-8">
        {placements.map((sec, secIdx) => {
          const s = sectionStyle(sec.type, null, customSectionTypes);
          const base = sectionBaseType(sec.type);
          const num = sec.type.slice(base.length).trim();
          const isCollapsed = !!collapsed[secIdx];
          return (
            <div key={secIdx} className="mb-6">
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
                <select
                  value={base}
                  onChange={e => changeSectionType(secIdx, e.target.value)}
                  className="bg-transparent border-none text-label-14 font-black uppercase tracking-[0.15em] cursor-pointer outline-none"
                  style={{ color: s.b }}
                >
                  {sectionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {num && <span className="text-label-14 font-black -ml-1" style={{ color: s.b }}>{num}</span>}
                <input
                  value={sec.note || ''}
                  onChange={e => updateSectionNote(secIdx, e.target.value)}
                  placeholder="cue..."
                  className="flex-1 bg-transparent border-none text-label-11 italic text-[var(--text-2)] outline-none min-w-0 px-1"
                  style={{ borderLeft: sec.note ? `2px solid ${s.br}` : 'none' }}
                />
                <PopMenu
                  trigger={
                    <IconButton variant="ghost" size="sm" aria-label="Section options" title="Section options">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                    </IconButton>
                  }
                >
                  <MenuItem onClick={() => setDrawerTarget(secIdx)}>Edit lyrics…</MenuItem>
                  <MenuItem onClick={() => duplicateSection(secIdx)}>Duplicate section</MenuItem>
                  <MenuItem onClick={() => moveSection(secIdx, -1)}>Move up</MenuItem>
                  <MenuItem onClick={() => moveSection(secIdx, 1)}>Move down</MenuItem>
                  <MenuItem danger onClick={() => removeSection(secIdx)}>Delete section</MenuItem>
                </PopMenu>
              </div>

              {/* Lines */}
              {!isCollapsed && (
                <div>
                  {sec.lines.map((line, lineIdx) => {
                    if (typeof line === 'object' && line.type === 'tab') {
                      return <TabBlock key={lineIdx} data={line} />;
                    }
                    if (typeof line === 'object' && line.type === 'modulate') {
                      return (
                        <div key={lineIdx} className="my-4 flex items-center gap-3">
                          <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                          <span className="text-label-10 font-black uppercase tracking-[0.2em] px-3 py-1 bg-[var(--color-brand)] text-white rounded-full shadow-sm">
                            Key Change: {line.semitones > 0 ? '+' : ''}{line.semitones}
                          </span>
                          <button type="button" onClick={() => removeLine(secIdx, lineIdx)} aria-label="Remove key change" className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[var(--ds-gray-600)] hover:text-[var(--ds-error-600)] hover:bg-[var(--ds-gray-alpha-100)] bg-transparent border-none cursor-pointer leading-none">✕</button>
                          <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                        </div>
                      );
                    }
                    if (line.plainText !== undefined) {
                      if (editingLine && editingLine.secIdx === secIdx && editingLine.lineIdx === lineIdx) {
                        let rawLine = placementToLine({ plainText: line.plainText, chords: line.chords });
                        if (line.inlineNote) rawLine += ` {!${line.inlineNote}}`;
                        return (
                          <div key={lineIdx} className="mb-2">
                            <InlineEditor initialValue={rawLine} onSave={(val) => handleInlineSave(secIdx, lineIdx, val)} onCancel={() => setEditingLine(null)} />
                          </div>
                        );
                      }
                      if ((line.plainText || '').trim() === '' && (line.chords?.length > 0)) {
                        return (
                          <div key={lineIdx} className="mb-2 last:mb-0">
                            <ChordOnlyLine chords={line.chords} secIdx={secIdx} lineIdx={lineIdx} onEditChord={openEditChord} onAppend={appendChord} onRemoveChord={removeChordAt} />
                          </div>
                        );
                      }
                      if ((line.plainText || '').trim() === '' && (!line.chords || line.chords.length === 0)) {
                        return (
                          <div key={lineIdx} className="mb-2 last:mb-0">
                            <button type="button" onClick={() => handleEditText(secIdx, lineIdx)} className="text-copy-13 italic text-[var(--ds-gray-500)] bg-transparent border-none cursor-text px-1 py-1">
                              Tap to add lyrics…
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={lineIdx} className="mb-2 last:mb-0">
                          <InteractiveLine
                            plainText={line.plainText}
                            chords={line.chords}
                            secIdx={secIdx}
                            lineIdx={lineIdx}
                            editingChordIdx={autocomplete && autocomplete.secIdx === secIdx && autocomplete.lineIdx === lineIdx ? autocomplete.chordIdx : null}
                            onPlace={openAddChord}
                            onChordTap={openEditChord}
                            onEditText={handleEditText}
                          />
                          {line.inlineNote && (
                            <span className="text-[var(--text-2)] italic text-[0.8em]">{' ---- '}{line.inlineNote}</span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}

                  {/* Per-section add menu */}
                  <div className="mt-1">
                    <PopMenu
                      align="left"
                      trigger={<button type="button" className="text-label-11 font-semibold text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer px-1 py-1">+ Add</button>}
                    >
                      <MenuItem onClick={() => addLine(secIdx)}>Lyric line</MenuItem>
                      <MenuItem onClick={(e) => addChordLine(secIdx, e.clientX, e.clientY)}>Chord line (instrumental)</MenuItem>
                      <MenuItem onClick={() => addModulate(secIdx, 1)}>Key change +1</MenuItem>
                      <MenuItem onClick={() => addModulate(secIdx, 2)}>Key change +2</MenuItem>
                      <MenuItem onClick={() => addModulate(secIdx, -1)}>Key change −1</MenuItem>
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

      {/* Chord autocomplete (single-phase) */}
      {autocomplete && (
        <ChordAutocomplete
          anchor={autocomplete.anchor}
          initial={autocomplete.initial}
          songKey={song.key}
          recents={recentChords}
          onCommit={commitChord}
          onRemove={autocomplete.chordIdx != null ? () => removeChordAt(autocomplete.secIdx, autocomplete.lineIdx, autocomplete.chordIdx) : null}
          onClose={() => setAutocomplete(null)}
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
