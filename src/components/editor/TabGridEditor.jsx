import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { stringsForCount } from './tabInstruments';

const DEFAULT_STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
const TECHNIQUES = ['h', 'p', 's', 'b', 'x', '~'];

// Grid resolution is "cells per beat" (cpb): 1 = beats only (1 2 3 4),
// 2 = eighths (1 & 2 &), 4 = sixteenths (1 e & a).
function slotsPerMeasure(timeSig, cpb) {
  const [num] = (timeSig || '4/4').split('/').map(Number);
  return num * cpb;
}

const DURATIONS = [
  { id: 'w',  label: '𝅝',  beats: 4,   title: 'Whole' },
  { id: 'h',  label: '𝅗𝅥',  beats: 2,   title: 'Half' },
  { id: 'q',  label: '♩',  beats: 1,   title: 'Quarter' },
  { id: 'e',  label: '♪',  beats: 0.5, title: '8th' },
  { id: 's',  label: '𝅘𝅥𝅯',  beats: 0.25, title: '16th' },
  { id: 'dq', label: '♩.',  beats: 1.5, title: 'Dotted Quarter' },
];

function beatLabels(timeSig, cpb) {
  const [num] = (timeSig || '4/4').split('/').map(Number);
  const sub = cpb === 4 ? ['', 'e', '&', 'a'] : cpb === 2 ? ['', '&'] : [''];
  const labels = [];
  for (let b = 1; b <= num; b++) {
    for (let s = 0; s < cpb; s++) labels.push(s === 0 ? String(b) : (sub[s] || ''));
  }
  return labels;
}

function makeGrid(measures, timeSig, strings, cpb) {
  const slots = slotsPerMeasure(timeSig, cpb) * measures;
  return strings.map(() => Array(slots).fill(null));
}

function gridToAscii(grid, measures, timeSig, strings, cpb) {
  const spm = slotsPerMeasure(timeSig, cpb);

  return strings.map((name, si) => {
    let line = name + '|';
    for (let m = 0; m < measures; m++) {
      for (let pos = 0; pos < spm; pos++) {
        const slot = m * spm + pos;
        const cell = grid[si][slot];
        if (cell !== null) {
          const fret = typeof cell === 'object' ? cell.fret : cell;
          const tech = typeof cell === 'object' ? (cell.technique || '') : '';
          line += String(fret) + tech;
          const used = String(fret).length + (tech ? 1 : 0);
          line += '-'.repeat(Math.max(0, 2 - used));
        } else {
          line += '---';
        }
      }
      if (m < measures - 1) line += '|';
    }
    return line;
  }).join('\n');
}

export default function TabGridEditor({ initialTab, time, strings = DEFAULT_STRINGS, tunings = null, instrument = 'electric', counts = null, sections = null, subdivision = 4, onSave, onClose }) {
  const timeSig = time || '4/4';
  // The active string labels (tuning). Changing tuning only relabels rows; the
  // grid (and fret positions) are preserved.
  const [curStrings, setCurStrings] = useState(strings);
  const [targetSec, setTargetSec] = useState(0);
  // Editing an existing tab loads at fine (16th) resolution so nothing is lost;
  // new tabs start at the chosen subdivision.
  const [cpb, setCpb] = useState(() => (initialTab ? 4 : subdivision));
  const [measures, setMeasures] = useState(2);
  const [duration, setDuration] = useState('q');
  const [grid, setGrid] = useState(() => makeGrid(2, timeSig, strings, initialTab ? 4 : subdivision));
  const [cursor, setCursor] = useState({ string: 0, pos: 0 });
  const [chordMode, setChordMode] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [lastPlaced, setLastPlaced] = useState(null);
  const [inputError, setInputError] = useState(false);
  const inputRef = useRef(null);

  const spm = slotsPerMeasure(timeSig, cpb);
  const totalSlots = spm * measures;
  const labels = beatLabels(timeSig, cpb);

  useEffect(() => {
    if (activeInput && inputRef.current) inputRef.current.focus();
  }, [activeInput]);

  useEffect(() => {
    if (!initialTab || !initialTab.strings || initialTab.strings.length === 0) return;
    const maxMeasures = Math.max(2, initialTab.strings[0]?.content?.split('|').length || 2);
    const newGrid = makeGrid(maxMeasures, timeSig, strings, 4);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeasures(maxMeasures);

    initialTab.strings.forEach((str, si) => {
      if (si >= strings.length) return;
      const content = str.content;
      let slot = 0;
      let i = 0;
      while (i < content.length && slot < spm * maxMeasures) {
        const ch = content[i];
        if (ch === '|') { i++; continue; }
        if (ch >= '0' && ch <= '9') {
          let fretStr = ch;
          if (i + 1 < content.length && content[i + 1] >= '0' && content[i + 1] <= '9') {
            fretStr += content[i + 1];
            i++;
          }
          let tech = null;
          if (i + 1 < content.length && 'hpsbx~'.includes(content[i + 1])) {
            tech = content[i + 1];
            i++;
          }
          const fret = parseInt(fretStr, 10);
          newGrid[si][slot] = tech ? { fret, technique: tech } : fret;
          slot++;
        } else if (ch === '-') {
          slot++;
        }
        i++;
      }
    });
    setGrid(newGrid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const durSlots = Math.max(1, Math.round((DURATIONS.find(d => d.id === duration)?.beats || 1) * cpb));

  // Switch grid resolution, remapping placed notes by beat position.
  const changeSubdivision = useCallback((newCpb) => {
    setGrid(prev => {
      const newTotal = slotsPerMeasure(timeSig, newCpb) * measures;
      const next = prev.map(() => Array(newTotal).fill(null));
      prev.forEach((row, si) => row.forEach((cell, slot) => {
        if (cell == null) return;
        const ns = Math.round((slot / cpb) * newCpb);
        if (ns < newTotal && next[si][ns] == null) next[si][ns] = cell;
      }));
      return next;
    });
    setCpb(newCpb);
    setCursor({ string: 0, pos: 0 });
  }, [cpb, timeSig, measures]);

  // Change string labels/count. Rebuilds grid rows to match the new count
  // (preserving existing rows by index) so the render never indexes a missing
  // row — the cause of the "se[D] is undefined" crash on 7-string / 5-bass.
  const changeStrings = useCallback((next) => {
    setGrid(prev => {
      const cols = prev[0]?.length || (slotsPerMeasure(timeSig, cpb) * measures);
      return next.map((_, i) => (prev[i] ? [...prev[i]] : Array(cols).fill(null)));
    });
    setCurStrings(next);
    setCursor({ string: 0, pos: 0 });
    setActiveInput(null);
    setLastPlaced(null);
  }, [timeSig, cpb, measures]);

  const openInput = useCallback((si, pos) => {
    setActiveInput({ string: si, pos });
    setInputVal('');
    setInputError(false);
    setCursor({ string: si, pos });
  }, []);

  const commitInput = useCallback((si, pos, val) => {
    const fret = parseInt(val, 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 24) {
      setGrid(prev => {
        const next = prev.map(r => [...r]);
        next[si][pos] = fret;
        return next;
      });
      setLastPlaced({ string: si, pos });
      if (!chordMode) {
        const nextPos = pos + durSlots;
        if (nextPos < totalSlots) {
          setCursor({ string: si, pos: nextPos });
        }
      }
      setActiveInput(null);
      setInputVal('');
      setInputError(false);
    } else {
      // Out of range — keep the input open and flash red
      setInputError(true);
      setInputVal('');
    }
  }, [chordMode, durSlots, totalSlots]);

  const clearCell = useCallback((si, pos) => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[si][pos] = null;
      return next;
    });
  }, []);

  const applyTechnique = useCallback((tech) => {
    if (!lastPlaced) return;
    const { string: si, pos } = lastPlaced;
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      const cell = next[si][pos];
      if (cell === null) return prev;
      const fret = typeof cell === 'object' ? cell.fret : cell;
      next[si][pos] = { fret, technique: tech };
      return next;
    });
  }, [lastPlaced]);

  const addMeasure = () => {
    setMeasures(m => {
      const next = m + 1;
      setGrid(prev => prev.map(row => [...row, ...Array(spm).fill(null)]));
      return next;
    });
  };

  const removeMeasure = () => {
    if (measures <= 1) return;
    setMeasures(m => {
      const next = m - 1;
      setGrid(prev => prev.map(row => row.slice(0, next * spm)));
      return next;
    });
  };

  const handleInsert = () => {
    const ascii = gridToAscii(grid, measures, timeSig, curStrings, cpb);
    const header = `{tab, time: ${timeSig}}`;
    onSave(`${header}\n${ascii}\n{/tab}`, targetSec);
  };

  const handleGridKeyDown = useCallback((e) => {
    if (activeInput) return;
    const { string: si, pos } = cursor;
    if (e.key === 'ArrowRight') { e.preventDefault(); setCursor({ string: si, pos: Math.min(pos + 1, totalSlots - 1) }); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setCursor({ string: si, pos: Math.max(pos - 1, 0) }); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor({ string: Math.min(si + 1, curStrings.length - 1), pos }); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setCursor({ string: Math.max(si - 1, 0), pos }); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInput(si, pos); }
    if (e.key === 'Delete' || e.key === 'Backspace') { clearCell(si, pos); }
  }, [activeInput, cursor, totalSlots, openInput, clearCell, curStrings.length]);

  const cellW = 34;
  const cellH = 28;
  const labelW = 28;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleGridKeyDown}
        tabIndex={-1}
        className="bg-[var(--ds-background-200)] rounded-2xl border border-[var(--ds-gray-400)] p-[18px] w-[95%] max-w-[860px] max-h-[90vh] overflow-auto outline-none"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3.5">
          <span className="text-heading-14 text-[var(--ds-gray-1000)] flex-1">
            Tab Editor
          </span>
          <span className="text-label-11-mono text-[var(--ds-gray-500)]">
            {timeSig}
          </span>
          <IconButton variant="ghost" size="xs" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        {/* Toolbar: Durations + chord mode + techniques */}
        <div className="flex flex-wrap gap-1.5 mb-3 items-center">
          {/* Duration picker */}
          <div className="flex gap-1">
            {DURATIONS.map(d => (
              <button
                key={d.id}
                onClick={() => setDuration(d.id)}
                title={d.title}
                className={`rounded-md px-2 py-1 text-[16px] font-semibold font-mono cursor-pointer border transition-colors ${
                  duration === d.id
                    ? 'border-[var(--color-brand)] text-[var(--color-brand-text)] bg-[var(--color-brand-soft)]'
                    : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[var(--ds-gray-400)]" />

          {/* Chord mode */}
          <Button
            variant={chordMode ? 'brand' : 'secondary'}
            size="xs"
            onClick={() => setChordMode(v => !v)}
          >
            Chord
          </Button>

          <div className="w-px h-5 bg-[var(--ds-gray-400)]" />

          {/* Technique buttons */}
          <div className="flex gap-1 items-center">
            <span className="text-label-10 text-[var(--ds-gray-500)] mr-0.5">Technique:</span>
            {TECHNIQUES.map(t => (
              <button
                key={t}
                onClick={() => applyTechnique(t)}
                disabled={!lastPlaced}
                title={{ h: 'Hammer-on', p: 'Pull-off', s: 'Slide', b: 'Bend', x: 'Mute', '~': 'Vibrato' }[t]}
                className={`rounded-md px-2 py-1 text-label-12 font-semibold font-mono cursor-pointer border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-200)] transition-colors ${
                  !lastPlaced ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {sections && (
            <div className="flex gap-1 items-center">
              <span className="text-label-10 text-[var(--ds-gray-500)]">Add to:</span>
              <select
                value={targetSec}
                onChange={e => setTargetSec(Number(e.target.value))}
                className="h-7 px-1.5 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-11 text-[var(--ds-gray-1000)] outline-none"
              >
                {sections.map((s, i) => <option key={i} value={i}>{s.type}</option>)}
              </select>
            </div>
          )}

          {counts && counts.length > 1 && (
            <div className="flex gap-1 items-center">
              <span className="text-label-10 text-[var(--ds-gray-500)]">Strings:</span>
              {counts.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeStrings(stringsForCount(instrument, n))}
                  className={`rounded-md px-2 py-1 text-label-11 font-semibold cursor-pointer border ${
                    curStrings.length === n
                      ? 'border-[var(--chord)] text-[var(--chord)] bg-[var(--ds-gray-100)]'
                      : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />

          {/* Tuning */}
          {tunings && tunings.length > 1 && (
            <div className="flex gap-1 items-center">
              <span className="text-label-10 text-[var(--ds-gray-500)]">Tuning:</span>
              <select
                value={tunings.find(t => t.strings.join('') === curStrings.join(''))?.id || ''}
                onChange={e => {
                  const t = tunings.find(x => x.id === e.target.value);
                  if (t) changeStrings(t.strings);
                }}
                className="h-7 px-1.5 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-11 text-[var(--ds-gray-1000)] outline-none"
              >
                {!tunings.some(t => t.strings.join('') === curStrings.join('')) && <option value="">Custom</option>}
                {tunings.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}

          {/* Subdivision (grid resolution) */}
          <div className="flex gap-1 items-center">
            <span className="text-label-10 text-[var(--ds-gray-500)]">Grid:</span>
            {[{ v: 1, l: '1/4' }, { v: 2, l: '1/8' }, { v: 4, l: '1/16' }].map(o => (
              <button
                key={o.v}
                type="button"
                onClick={() => changeSubdivision(o.v)}
                className={`rounded-md px-2 py-1 text-label-11 font-semibold cursor-pointer border transition-colors ${
                  cpb === o.v
                    ? 'border-[var(--color-brand)] text-[var(--color-brand-text)] bg-[var(--color-brand-soft)]'
                    : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[var(--ds-gray-400)]" />

          <div className="flex gap-1 items-center">
            <span className="text-label-10 text-[var(--ds-gray-500)]">{measures} bar{measures !== 1 ? 's' : ''}</span>
            <IconButton variant="default" size="xs" onClick={removeMeasure} disabled={measures <= 1} aria-label="Remove bar">−</IconButton>
            <IconButton variant="default" size="xs" onClick={addMeasure} aria-label="Add bar">+</IconButton>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto pb-2">
          {/* Beat header */}
          <div className="flex mb-0.5" style={{ marginLeft: labelW }}>
            {Array.from({ length: totalSlots }, (_, pos) => {
              const isBarLine = pos > 0 && pos % spm === 0;
              const beatLabel = labels[pos % labels.length];
              const isBeat = pos % cpb === 0;
              return (
                <div
                  key={pos}
                  className="shrink-0 text-center font-mono"
                  style={{
                    width: cellW,
                    fontSize: isBeat ? 10 : 8,
                    color: isBeat ? 'var(--ds-gray-600)' : 'var(--ds-gray-500)',
                    borderLeft: isBarLine ? '2px solid var(--ds-gray-400)' : 'none',
                    fontWeight: isBeat ? 700 : 400,
                  }}
                >
                  {beatLabel}
                </div>
              );
            })}
          </div>

          {/* String rows */}
          {curStrings.map((name, si) => (
            <div key={si} className="flex items-center mb-0.5">
              <div
                className="shrink-0 text-right pr-1.5 text-label-12-mono font-bold text-[var(--ds-gray-600)]"
                style={{ width: labelW }}
              >
                {name}
              </div>

              {Array.from({ length: totalSlots }, (_, pos) => {
                const isBarLine = pos > 0 && pos % spm === 0;
                const cell = grid[si][pos];
                const isActive = activeInput?.string === si && activeInput?.pos === pos;
                const isCursor = cursor.string === si && cursor.pos === pos && !activeInput;
                const fret = cell === null ? null : (typeof cell === 'object' ? cell.fret : cell);
                const tech = cell !== null && typeof cell === 'object' ? cell.technique : null;

                return (
                  <div
                    key={pos}
                    className="shrink-0 flex items-center justify-center relative cursor-pointer"
                    style={{
                      width: cellW, height: cellH,
                      borderLeft: isBarLine ? '2px solid var(--ds-gray-500)' : '1px solid var(--ds-gray-300)',
                      background: isCursor
                        ? 'var(--color-brand-soft)'
                        : cell !== null ? 'rgba(226,168,50,0.06)' : 'transparent',
                      outline: isCursor ? '1px solid var(--color-brand)' : 'none',
                      borderRadius: isCursor ? 3 : 0,
                    }}
                    onClick={() => {
                      if (isActive) return;
                      setCursor({ string: si, pos });
                      openInput(si, pos);
                    }}
                    onContextMenu={e => { e.preventDefault(); clearCell(si, pos); }}
                  >
                    {/* String line */}
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{ top: '50%', height: 1, background: 'var(--ds-gray-300)' }}
                    />

                    {isActive ? (
                      <input
                        ref={inputRef}
                        value={inputVal}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                          setInputVal(v);
                          if (v.length === 2) commitInput(si, pos, v);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            commitInput(si, pos, inputVal);
                          }
                          if (e.key === 'Escape') {
                            setActiveInput(null);
                            setInputVal('');
                          }
                        }}
                        onBlur={() => {
                          if (inputVal) commitInput(si, pos, inputVal);
                          else setActiveInput(null);
                        }}
                        className={`text-center font-mono text-label-13 font-bold outline-none z-[1] relative rounded-sm ${
                          inputError
                            ? 'bg-[var(--ds-red-100)] border border-[var(--ds-red-700)] text-[var(--ds-red-1000)]'
                            : 'bg-[var(--color-brand-soft)] border border-[var(--color-brand)] text-[var(--color-brand-text)]'
                        }`}
                        style={{
                          width: cellW - 4, height: cellH - 4,
                        }}
                      />
                    ) : (
                      fret !== null && (
                        <div className="relative z-[1] flex items-center gap-px">
                          <span className="font-mono text-label-12 font-bold text-[var(--chord)] leading-none">
                            {fret}
                          </span>
                          {tech && (
                            <span className="font-mono text-[9px] text-[var(--ds-gray-600)] leading-none">
                              {tech}
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="text-label-10-mono text-[var(--ds-gray-500)] mt-2 mb-3.5">
          Click a cell, type fret 0–24 (2 digits auto-commit) · Enter/Tab to confirm · Right-click to clear · Arrow keys to navigate
        </div>

        {/* Bottom bar */}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="brand" size="sm" onClick={handleInsert}>{initialTab ? 'Save Tab' : 'Insert Tab'}</Button>
        </div>
      </div>
    </div>
  );
}
