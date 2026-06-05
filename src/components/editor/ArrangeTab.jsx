import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, memo } from 'react';
import { parseSongMd, songToMd, lineToPlacement, placementToLine, extractInlineNotes } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import ChordPalette from './ChordPalette';
import SectionDrawer from './SectionDrawer';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];

// ─── Helpers ──────────────────────────────────────────────────────

// Map a screen point to a character offset within a line's lyric text node.
// Uses the native caret APIs (Blink/WebKit: caretRangeFromPoint; Firefox:
// caretPositionFromPoint) so placement stays accurate even when the line
// wraps onto multiple visual rows.
function caretOffsetFromPoint(x, y, textEl) {
  if (!textEl) return null;
  const textNode = textEl.firstChild;
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const cp = document.caretPositionFromPoint(x, y);
    if (cp) { node = cp.offsetNode; offset = cp.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (node && textNode && node === textNode) return offset;
  if (node === textEl) return 0;
  return null;
}

function parsePlacementLine(line) {
  const { clean } = extractInlineNotes(line);
  const noteMatch = line.match(/\{!(.*?)\}/);
  const inlineNote = noteMatch ? noteMatch[1] : null;
  const placement = lineToPlacement(clean);
  return { ...placement, inlineNote };
}

// ─── InteractiveLine ──────────────────────────────────────────────
//
// Renders the lyric as a single wrapping text node and overlays chords as
// absolutely-positioned chips, measured against the rendered text so each chip
// sits over the right character on whichever visual row it wraps to. This keeps
// the DOM at O(chords) nodes per line instead of O(characters), and (paired
// with the line-specific props below) lets a pointer-move re-render only the
// one line it's over rather than every line in the song.

const InteractiveLine = memo(function InteractiveLine({
  plainText, chords, secIdx, lineIdx,
  activeChord, hasSelection, guideCharPos, selectedChordIdx,
  onPlace, onChordTap, onGuideUpdate, onGuideClear, onLineClick,
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [chips, setChips] = useState([]);
  const [caret, setCaret] = useState(null);
  const [tick, setTick] = useState(0);

  const isChordMode = !!(activeChord || hasSelection);
  const showGuide = guideCharPos != null;

  const indexedChords = useMemo(
    () => (chords || []).map((c, i) => ({ chord: c.chord, pos: c.pos, origIdx: i })),
    [chords],
  );

  // Measure chord anchor positions (and the guide caret) after layout. Re-runs
  // when the text/chords change or the container resizes (wrapping changes).
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
    // Positioning overlays from measured layout is the canonical use of
    // useLayoutEffect (it runs synchronously before paint, so no flicker).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChips(next);
    setCaret(showGuide ? measure(guideCharPos) : null);
  }, [plainText, indexedChords, showGuide, guideCharPos, tick]);

  // Remeasure on width changes (preview toggled, window resized, …).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick(t => t + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handlePointerMove = (e) => {
    if (!isChordMode) return;
    const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
    if (pos != null) onGuideUpdate({ secIdx, lineIdx, charPos: pos });
  };
  const handlePointerLeave = () => onGuideClear();
  const handlePointerDown = (e) => {
    if (isChordMode) {
      const pos = caretOffsetFromPoint(e.clientX, e.clientY, textRef.current);
      onPlace(secIdx, lineIdx, pos == null ? (plainText?.length || 0) : pos);
    } else {
      onLineClick(secIdx, lineIdx);
    }
  };

  if (!plainText && (!chords || chords.length === 0)) {
    return <div className="min-h-[1.3em]" onPointerDown={() => onLineClick(secIdx, lineIdx)} />;
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none font-mono"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      style={{ cursor: isChordMode ? 'crosshair' : 'pointer', fontSize: 16, lineHeight: 2.0, paddingTop: '1.1em' }}
    >
      <div ref={textRef} className="whitespace-pre-wrap break-words text-[var(--text-1)]">
        {plainText ? plainText : '\u00A0'}
      </div>
      {chips.map((c) => {
        const selected = selectedChordIdx === c.origIdx;
        return (
          <span
            key={c.origIdx}
            className="absolute font-bold cursor-pointer"
            style={{
              left: c.left,
              top: c.top,
              transform: 'translateY(-100%)',
              lineHeight: 1,
              fontSize: 13,
              color: selected ? 'var(--color-brand)' : 'var(--chord)',
              borderBottom: selected ? '2px solid var(--color-brand)' : '2px solid transparent',
              whiteSpace: 'nowrap',
              animation: selected ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
            onPointerDown={(e) => { e.stopPropagation(); onChordTap(secIdx, lineIdx, c.origIdx); }}
          >
            {c.chord}
          </span>
        );
      })}
      {showGuide && caret && (
        <span
          className="absolute pointer-events-none"
          style={{ left: caret.left, top: caret.top, width: 2, height: '1.2em', background: 'var(--chord)' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

// ─── InlineEditor ─────────────────────────────────────────────────

function InlineEditor({ initialValue, onSave, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.selectionStart = ref.current.value.length;
    }
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

// ─── ArrangeTab ───────────────────────────────────────────────────

export default function ArrangeTab({ md, onChange, customSectionTypes }) {
  const sectionTypes = useMemo(() => {
    const custom = (customSectionTypes || [])
      .map(t => t?.name?.trim())
      .filter(Boolean);
    return [...SECTION_TYPES, ...custom];
  }, [customSectionTypes]);
  const [activeChord, setActiveChord] = useState(null);
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [guidePos, setGuidePos] = useState(null);
  const [recentChords, setRecentChords] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [drawerTarget, setDrawerTarget] = useState(null);
  const isInternalUpdate = useRef(false);

  // Derive song and placements from md
  const song = useMemo(() => {
    try { return parseSongMd(md); }
    catch { return null; }
  }, [md]);

  const placements = useMemo(() => {
    if (!song) return [];
    return song.sections.map(sec => ({
      type: sec.type,
      note: sec.note,
      lines: sec.lines.map(line => {
        if (typeof line !== 'string') return line;
        return parsePlacementLine(line);
      }),
    }));
  }, [song]);

  // Collect unique chords for recent suggestions
  const songChords = useMemo(() => {
    const set = new Set();
    for (const sec of placements) {
      for (const line of sec.lines) {
        if (line.chords) {
          for (const c of line.chords) set.add(c.chord);
        }
      }
    }
    return [...set];
  }, [placements]);

  const effectiveRecent = useMemo(() => {
    const merged = [...recentChords];
    for (const c of songChords) {
      if (!merged.includes(c)) merged.push(c);
    }
    return merged.slice(0, 12);
  }, [recentChords, songChords]);

  // ─── Song mutation helper ───
  const emitSong = useCallback((updatedSong) => {
    isInternalUpdate.current = true;
    onChange(songToMd(updatedSong));
  }, [onChange]);

  // ─── Chord placement mutations ───
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

  const addRecent = useCallback((chord) => {
    setRecentChords(prev => {
      const next = [chord, ...prev.filter(c => c !== chord)];
      return next.slice(0, 8);
    });
  }, []);

  const clearGuide = useCallback(() => setGuidePos(null), []);

  const handlePlace = useCallback((secIdx, lineIdx, charPos) => {
    if (selectedExisting) {
      const { secIdx: fromSec, lineIdx: fromLine, chordIdx } = selectedExisting;
      applyMutation(prev => prev.map((sec, si) => ({
        ...sec,
        lines: sec.lines.map((line, li) => {
          if (line.plainText === undefined) return line;
          if (si === fromSec && li === fromLine) {
            const movedChord = line.chords[chordIdx];
            const newChords = line.chords.filter((_, ci) => ci !== chordIdx);
            if (si === secIdx && li === lineIdx) {
              const filtered = newChords.filter(c => c.pos !== charPos);
              return { ...line, chords: [...filtered, { chord: movedChord.chord, pos: charPos }].sort((a, b) => a.pos - b.pos) };
            }
            return { ...line, chords: newChords };
          }
          if (si === secIdx && li === lineIdx && !(si === fromSec && li === fromLine)) {
            const movedChord = prev[fromSec].lines[fromLine].chords[chordIdx];
            const filtered = line.chords.filter(c => c.pos !== charPos);
            return { ...line, chords: [...filtered, { chord: movedChord.chord, pos: charPos }].sort((a, b) => a.pos - b.pos) };
          }
          return line;
        }),
      })));
      setSelectedExisting(null);
      setGuidePos(null);
      return;
    }

    if (!activeChord) return;
    applyMutation(prev => prev.map((sec, si) => ({
      ...sec,
      lines: sec.lines.map((line, li) => {
        if (si !== secIdx || li !== lineIdx) return line;
        if (line.plainText === undefined) return line;
        const filtered = line.chords.filter(c => c.pos !== charPos);
        return { ...line, chords: [...filtered, { chord: activeChord, pos: charPos }].sort((a, b) => a.pos - b.pos) };
      }),
    })));
    addRecent(activeChord);
    setGuidePos(null);
  }, [activeChord, selectedExisting, applyMutation, addRecent]);

  const handleChordTap = useCallback((secIdx, lineIdx, chordIdx, action) => {
    if (action === 'remove') {
      applyMutation(prev => prev.map((sec, si) => ({
        ...sec,
        lines: sec.lines.map((line, li) => {
          if (si !== secIdx || li !== lineIdx) return line;
          if (line.plainText === undefined) return line;
          return { ...line, chords: line.chords.filter((_, ci) => ci !== chordIdx) };
        }),
      })));
      setSelectedExisting(null);
      return;
    }
    if (selectedExisting && selectedExisting.secIdx === secIdx && selectedExisting.lineIdx === lineIdx && selectedExisting.chordIdx === chordIdx) {
      setSelectedExisting(null);
    } else {
      setSelectedExisting({ secIdx, lineIdx, chordIdx });
      setActiveChord(null);
    }
  }, [selectedExisting, applyMutation]);

  // ─── Section operations ───
  const addSection = useCallback(() => {
    if (!song) return;
    const typeCounts = {};
    song.sections.forEach(s => {
      const base = s.type.replace(/\s*\d+$/, '');
      typeCounts[base] = (typeCounts[base] || 0) + 1;
    });
    const type = song.sections.length === 0 ? 'Verse 1' : 'Verse ' + ((typeCounts['Verse'] || 0) + 1);
    emitSong({ ...song, sections: [...song.sections, { type, note: '', lines: [''] }] });
  }, [song, emitSong]);

  const removeSection = useCallback((idx) => {
    if (!song) return;
    emitSong({ ...song, sections: song.sections.filter((_, i) => i !== idx) });
  }, [song, emitSong]);

  const moveSection = useCallback((idx, dir) => {
    if (!song) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= song.sections.length) return;
    const arr = [...song.sections];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    emitSong({ ...song, sections: arr });
  }, [song, emitSong]);

  const changeSectionType = useCallback((idx, baseType) => {
    if (!song) return;
    const count = song.sections.filter((s, i) => i < idx && s.type.replace(/\s*\d+$/, '') === baseType).length;
    const needsNumber = ['Verse', 'Pre Chorus', 'Chorus', 'Bridge'].includes(baseType);
    const label = needsNumber ? `${baseType} ${count + 1}` : baseType;
    const sections = song.sections.map((s, i) => i === idx ? { ...s, type: label } : s);
    emitSong({ ...song, sections });
  }, [song, emitSong]);

  const updateSectionNote = useCallback((idx, note) => {
    if (!song) return;
    const sections = song.sections.map((s, i) => i === idx ? { ...s, note } : s);
    emitSong({ ...song, sections });
  }, [song, emitSong]);

  // ─── Inline editing ───
  const handleLineClick = useCallback((secIdx, lineIdx) => {
    if (activeChord || selectedExisting) return;
    setEditingLine({ secIdx, lineIdx });
  }, [activeChord, selectedExisting]);

  const handleInlineSave = useCallback((secIdx, lineIdx, newText) => {
    if (!song) return;
    const sections = song.sections.map((sec, si) => {
      if (si !== secIdx) return sec;
      const lines = sec.lines.map((line, li) => {
        if (li !== lineIdx) return line;
        return newText;
      });
      return { ...sec, lines };
    });
    emitSong({ ...song, sections });
    setEditingLine(null);
  }, [song, emitSong]);

  // ─── Section drawer ───
  const handleDrawerSave = useCallback((sectionIndex, rawText) => {
    if (!song) return;
    const newLines = rawText.split('\n');
    const sections = song.sections.map((sec, i) => {
      if (i !== sectionIndex) return sec;
      return { ...sec, lines: newLines };
    });
    emitSong({ ...song, sections });
    setDrawerTarget(null);
    setActiveChord(null);
    setSelectedExisting(null);
  }, [song, emitSong]);

  // ─── Escape to deselect ───
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setSelectedExisting(null);
        setActiveChord(null);
        setGuidePos(null);
        setEditingLine(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!song) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">
        Start typing in the Write tab to use Arrange mode
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Chord Palette — top */}
      <ChordPalette
        activeChord={activeChord}
        onSelect={(chord) => { setActiveChord(chord); setSelectedExisting(null); setEditingLine(null); }}
        onClear={() => { setActiveChord(null); setSelectedExisting(null); }}
        songKey={song.key}
        recentChords={effectiveRecent}
        selectedChord={selectedExisting ? (() => {
          const sec = placements[selectedExisting.secIdx];
          const line = sec?.lines[selectedExisting.lineIdx];
          return line?.chords?.[selectedExisting.chordIdx]?.chord || null;
        })() : null}
        onRemoveSelected={selectedExisting ? () => {
          const { secIdx, lineIdx, chordIdx } = selectedExisting;
          handleChordTap(secIdx, lineIdx, chordIdx, 'remove');
        } : null}
      />

      {/* Scrollable sections */}
      <div className="flex-1 overflow-auto px-4 pt-2 pb-8">
        {placements.map((sec, secIdx) => {
          const s = sectionStyle(sec.type, null, customSectionTypes);
          const baseType = sec.type.replace(/\s*\d+$/, '');

          return (
            <div key={secIdx} className="mb-6">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={baseType}
                  onChange={e => changeSectionType(secIdx, e.target.value)}
                  className="bg-transparent border-none text-label-14 font-black uppercase tracking-[0.15em] cursor-pointer outline-none"
                  style={{ color: s.b }}
                >
                  {sectionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <input
                  value={sec.note || ''}
                  onChange={e => updateSectionNote(secIdx, e.target.value)}
                  placeholder="cue..."
                  className="flex-1 bg-transparent border-none text-label-11 italic text-[var(--text-2)] outline-none min-w-0 px-1"
                  style={{ borderLeft: sec.note ? `2px solid ${s.br}` : 'none' }}
                />

                <Button
                  variant="ghost" size="xs"
                  onClick={() => setDrawerTarget(secIdx)}
                  title="Edit section lyrics"
                >
                  Edit
                </Button>
                <IconButton variant="ghost" size="xs" onClick={() => moveSection(secIdx, -1)} aria-label="Move up">↑</IconButton>
                <IconButton variant="ghost" size="xs" onClick={() => moveSection(secIdx, 1)} aria-label="Move down">↓</IconButton>
                <IconButton variant="ghost" size="xs" onClick={() => removeSection(secIdx)} aria-label="Remove section">×</IconButton>
              </div>

              {/* Lines */}
              <div>
                {sec.lines.map((line, lineIdx) => {
                  if (typeof line === 'object' && line.type === 'tab') {
                    return <TabBlock key={lineIdx} data={line} />;
                  }
                  if (typeof line === 'object' && line.type === 'modulate') {
                    return (
                      <div key={lineIdx} className="my-4 flex items-center gap-4">
                        <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                        <span className="text-label-10 font-black uppercase tracking-[0.2em] px-3 py-1 bg-[var(--color-brand)] text-white rounded-full shadow-sm">
                          Key Change: {line.semitones > 0 ? '+' : ''}{line.semitones}
                        </span>
                        <div className="h-[1px] flex-1 bg-[var(--color-brand-border)]" />
                      </div>
                    );
                  }
                  if (line.plainText !== undefined) {
                    // Inline editing mode
                    if (editingLine && editingLine.secIdx === secIdx && editingLine.lineIdx === lineIdx) {
                      let rawLine = placementToLine({ plainText: line.plainText, chords: line.chords });
                      if (line.inlineNote) rawLine += ` {!${line.inlineNote}}`;
                      return (
                        <div key={lineIdx} className="mb-2">
                          <InlineEditor
                            initialValue={rawLine}
                            onSave={(val) => handleInlineSave(secIdx, lineIdx, val)}
                            onCancel={() => setEditingLine(null)}
                          />
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
                          activeChord={activeChord}
                          hasSelection={!!selectedExisting}
                          guideCharPos={guidePos && guidePos.secIdx === secIdx && guidePos.lineIdx === lineIdx ? guidePos.charPos : null}
                          selectedChordIdx={selectedExisting && selectedExisting.secIdx === secIdx && selectedExisting.lineIdx === lineIdx ? selectedExisting.chordIdx : null}
                          onPlace={handlePlace}
                          onChordTap={handleChordTap}
                          onGuideUpdate={setGuidePos}
                          onGuideClear={clearGuide}
                          onLineClick={handleLineClick}
                        />
                        {line.inlineNote && (
                          <span className="text-[var(--text-2)] italic text-[0.8em]">
                            {' ---- '}{line.inlineNote}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}

        {/* Add section button */}
        <div className="mt-4 mb-8">
          <Button variant="secondary" size="sm" onClick={addSection}>
            + Add Section
          </Button>
        </div>
      </div>

      {/* Section Drawer */}
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
