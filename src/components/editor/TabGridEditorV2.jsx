import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import TabBlock from '../TabBlock';
import { stringsForCount } from './tabInstruments';

const DEFAULT_STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
const TECHNIQUES = [
  { id: 'h', label: 'Hammer' }, { id: 'p', label: 'Pull' }, { id: 's', label: 'Slide' },
  { id: 'b', label: 'Bend' }, { id: '~', label: 'Vibrato' }, { id: 'x', label: 'Mute' },
];
const DURATIONS = [
  { id: 'q', label: '♩', beats: 1, title: 'Quarter' },
  { id: 'e', label: '♪', beats: 0.5, title: '8th' },
  { id: 's', label: '𝅘𝅥𝅯', beats: 0.25, title: '16th' },
  { id: 'dq', label: '♩.', beats: 1.5, title: 'Dotted ♩' },
  { id: 'h', label: '𝅗𝅥', beats: 2, title: 'Half' },
];

const slotsPerMeasure = (timeSig, cpb) => (parseInt((timeSig || '4/4').split('/')[0], 10) || 4) * cpb;

function beatLabels(timeSig, cpb) {
  const num = parseInt((timeSig || '4/4').split('/')[0], 10) || 4;
  const sub = cpb === 4 ? ['', 'e', '&', 'a'] : cpb === 2 ? ['', '&'] : [''];
  const labels = [];
  for (let b = 1; b <= num; b++) for (let s = 0; s < cpb; s++) labels.push(s === 0 ? String(b) : (sub[s] || ''));
  return labels;
}

const makeGrid = (measures, timeSig, strings, cpb) =>
  strings.map(() => Array(slotsPerMeasure(timeSig, cpb) * measures).fill(null));

function gridToAscii(grid, measures, timeSig, strings, cpb) {
  const spm = slotsPerMeasure(timeSig, cpb);
  return strings.map((name, si) => {
    let line = name + '|';
    for (let m = 0; m < measures; m++) {
      for (let pos = 0; pos < spm; pos++) {
        const cell = grid[si][m * spm + pos];
        if (cell !== null) {
          const fret = typeof cell === 'object' ? cell.fret : cell;
          const tech = typeof cell === 'object' ? (cell.technique || '') : '';
          line += String(fret) + tech;
          line += '-'.repeat(Math.max(0, 2 - (String(fret).length + (tech ? 1 : 0))));
        } else line += '---';
      }
      if (m < measures - 1) line += '|';
    }
    return line;
  }).join('\n');
}

// Parse an existing tab block into a fixed (16th) grid.
function gridFromTab(initialTab, timeSig, strings) {
  const cpb = 4;
  const measures = Math.max(2, initialTab.strings[0]?.content?.split('|').length || 2);
  const spm = slotsPerMeasure(timeSig, cpb);
  const grid = makeGrid(measures, timeSig, strings, cpb);
  initialTab.strings.forEach((str, si) => {
    if (si >= strings.length) return;
    const content = str.content; let slot = 0; let i = 0;
    while (i < content.length && slot < spm * measures) {
      const ch = content[i];
      if (ch === '|') { i++; continue; }
      if (ch >= '0' && ch <= '9') {
        let f = ch;
        if (i + 1 < content.length && content[i + 1] >= '0' && content[i + 1] <= '9') { f += content[i + 1]; i++; }
        let tech = null;
        if (i + 1 < content.length && 'hpsbx~'.includes(content[i + 1])) { tech = content[i + 1]; i++; }
        grid[si][slot] = tech ? { fret: parseInt(f, 10), technique: tech } : parseInt(f, 10);
        slot++;
      } else if (ch === '-') slot++;
      i++;
    }
  });
  return { grid, measures, cpb };
}

// ─── Tab tool v2 ──────────────────────────────────────────────────
// One focused grid + one bottom context bar; everything else lives in Setup.
export default function TabGridEditorV2({
  initialTab, time, strings = DEFAULT_STRINGS, tunings = null,
  instrument = 'electric', counts = null, sections = null, subdivision = 4,
  onSave, onClose,
}) {
  const timeSig = time || '4/4';
  const init = useMemo(() => {
    if (initialTab?.strings?.length) {
      const labels = initialTab.strings.map(s => s.note);
      return { strings: labels, ...gridFromTab(initialTab, timeSig, labels) };
    }
    return { strings, grid: makeGrid(2, timeSig, strings, subdivision), measures: 2, cpb: subdivision };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [curStrings, setCurStrings] = useState(init.strings);
  const [cpb, setCpb] = useState(init.cpb);
  const [measures, setMeasures] = useState(init.measures);
  const [grid, setGrid] = useState(init.grid);
  const [cursor, setCursor] = useState({ string: 0, pos: 0 });
  const [draft, setDraft] = useState('');
  const [duration, setDuration] = useState('q');
  const [lastPlaced, setLastPlaced] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const [targetSec, setTargetSec] = useState(0);
  const panelRef = useRef(null);

  const spm = slotsPerMeasure(timeSig, cpb);
  const totalSlots = spm * measures;
  const labels = beatLabels(timeSig, cpb);
  const durBeats = DURATIONS.find(d => d.id === duration)?.beats || 1;
  const durSlots = Math.max(1, Math.round(durBeats * cpb));

  useEffect(() => { panelRef.current?.focus(); }, []);

  const setCell = useCallback((si, pos, val) => {
    setGrid(prev => { const next = prev.map(r => [...r]); next[si][pos] = val; return next; });
  }, []);

  // Grow by one measure, returning the new total slot count.
  const growMeasure = useCallback(() => {
    setMeasures(m => m + 1);
    setGrid(prev => prev.map(row => [...row, ...Array(spm).fill(null)]));
    return totalSlots + spm;
  }, [spm, totalSlots]);

  const advance = useCallback(() => {
    setCursor(c => {
      let next = c.pos + durSlots;
      if (next >= totalSlots) { growMeasure(); }
      return { string: c.string, pos: next };
    });
  }, [durSlots, totalSlots, growMeasure]);

  const commitDraft = useCallback(() => {
    if (draft !== '') {
      const fret = Math.min(24, parseInt(draft, 10));
      if (!isNaN(fret)) { setCell(cursor.string, cursor.pos, fret); setLastPlaced({ string: cursor.string, pos: cursor.pos }); }
      setDraft('');
      return true;
    }
    return false;
  }, [draft, cursor, setCell]);

  const inputDigit = useCallback((d) => {
    setDraft(prev => {
      const n = (prev + d).replace(/^0+(?=\d)/, '');
      return parseInt(n, 10) <= 24 ? n.slice(-2) : d;
    });
  }, []);

  const confirmAndAdvance = useCallback(() => { commitDraft(); advance(); }, [commitDraft, advance]);

  const moveCursor = useCallback((dString, dPos) => {
    commitDraft();
    setCursor(c => ({
      string: Math.max(0, Math.min(curStrings.length - 1, c.string + dString)),
      pos: Math.max(0, Math.min(totalSlots - 1, c.pos + dPos)),
    }));
  }, [commitDraft, curStrings.length, totalSlots]);

  const backspace = useCallback(() => {
    if (draft !== '') { setDraft(''); return; }
    setCell(cursor.string, cursor.pos, null);
  }, [draft, cursor, setCell]);

  const applyTechnique = useCallback((tech) => {
    setFxOpen(false);
    const t = lastPlaced || cursor;
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      const cell = next[t.string]?.[t.pos];
      if (cell == null) return prev;
      const fret = typeof cell === 'object' ? cell.fret : cell;
      next[t.string][t.pos] = { fret, technique: tech };
      return next;
    });
  }, [lastPlaced, cursor]);

  const changeStrings = useCallback((next) => {
    setGrid(prev => next.map((_, i) => (prev[i] ? [...prev[i]] : Array(totalSlots).fill(null))));
    setCurStrings(next);
    setCursor({ string: 0, pos: 0 });
    setDraft('');
  }, [totalSlots]);

  const changeCpb = useCallback((newCpb) => {
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
  }, [timeSig, cpb, measures]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key >= '0' && e.key <= '9') { e.preventDefault(); inputDigit(e.key); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(0, 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(0, -1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1, 0); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1, 0); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmAndAdvance(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); backspace(); return; }
    if ('hpsbx~'.includes(e.key)) { e.preventDefault(); applyTechnique(e.key); }
  };

  const handleInsert = () => {
    commitDraft();
    const ascii = gridToAscii(grid, measures, timeSig, curStrings, cpb);
    onSave(`{tab, time: ${timeSig}}\n${ascii}\n{/tab}`, targetSec);
  };

  // Live preview tab object.
  const previewTab = useMemo(() => {
    const lines = gridToAscii(grid, measures, timeSig, curStrings, cpb).split('\n');
    return { type: 'tab', time: timeSig, strings: curStrings.map((note, i) => ({ note, content: (lines[i] || '').slice(2) })) };
  }, [grid, measures, timeSig, curStrings, cpb]);

  const cellW = 30, cellH = 26, labelW = 22;
  const cursorBeat = Math.floor(cursor.pos / cpb);

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="bg-[var(--ds-background-200)] rounded-2xl border border-[var(--ds-gray-400)] w-[95%] max-w-[760px] max-h-[92vh] flex flex-col outline-none"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ds-gray-300)]">
          <span className="text-heading-14 font-semibold text-[var(--ds-gray-1000)]">
            Tab{sections ? <span className="text-[var(--ds-gray-500)] font-normal"> · {sections[targetSec]?.type}</span> : null}
          </span>
          <span className="text-label-11 font-mono text-[var(--ds-gray-500)]">{curStrings.length}-str · {timeSig}</span>
          <div className="flex-1" />
          <Button variant={setupOpen ? 'brand' : 'secondary'} size="xs" onClick={() => setSetupOpen(v => !v)}>Setup</Button>
          <Button variant="brand" size="xs" onClick={handleInsert}>{initialTab ? 'Save' : 'Insert'}</Button>
          <IconButton variant="ghost" size="xs" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        {/* Setup sheet */}
        {setupOpen && (
          <div className="px-4 py-3 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-100)] flex flex-wrap gap-4">
            {sections && (
              <label className="flex flex-col gap-1">
                <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">Add to</span>
                <select value={targetSec} onChange={e => setTargetSec(Number(e.target.value))} className="h-8 px-2 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-1000)] outline-none">
                  {sections.map((s, i) => <option key={i} value={i}>{s.type}</option>)}
                </select>
              </label>
            )}
            {counts && counts.length > 1 && (
              <SetupGroup label="Strings">
                {counts.map(n => (
                  <Chip key={n} active={curStrings.length === n} onClick={() => changeStrings(stringsForCount(instrument, n))}>{n}</Chip>
                ))}
              </SetupGroup>
            )}
            {tunings && tunings.length > 1 && (
              <SetupGroup label="Tuning">
                {tunings.filter(t => t.strings.length === curStrings.length).map(t => (
                  <Chip key={t.id} active={t.strings.join('') === curStrings.join('')} onClick={() => changeStrings(t.strings)}>{t.label}</Chip>
                ))}
              </SetupGroup>
            )}
            <SetupGroup label="Grid">
              {[{ v: 1, l: '1/4' }, { v: 2, l: '1/8' }, { v: 4, l: '1/16' }].map(o => (
                <Chip key={o.v} active={cpb === o.v} onClick={() => changeCpb(o.v)}>{o.l}</Chip>
              ))}
            </SetupGroup>
          </div>
        )}

        {/* Live preview */}
        <div className="px-4 pt-2 pb-1 border-b border-[var(--ds-gray-200)] overflow-x-auto">
          <TabBlock data={previewTab} scale={0.85} />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <div className="inline-block min-w-full">
            {/* beat header */}
            <div className="flex mb-0.5" style={{ marginLeft: labelW }}>
              {Array.from({ length: totalSlots }, (_, pos) => {
                const isBar = pos > 0 && pos % spm === 0;
                const isBeat = pos % cpb === 0;
                return (
                  <div key={pos} className="shrink-0 text-center font-mono" style={{ width: cellW, fontSize: isBeat ? 10 : 8, color: isBeat ? 'var(--ds-gray-600)' : 'var(--ds-gray-500)', borderLeft: isBar ? '2px solid var(--ds-gray-400)' : 'none', fontWeight: isBeat ? 700 : 400 }}>
                    {labels[pos % labels.length]}
                  </div>
                );
              })}
            </div>
            {/* string rows */}
            {curStrings.map((name, si) => (
              <div key={si} className="flex items-center mb-0.5">
                <div className="shrink-0 text-right pr-1.5 text-label-12-mono font-bold text-[var(--ds-gray-600)]" style={{ width: labelW }}>{name}</div>
                {Array.from({ length: totalSlots }, (_, pos) => {
                  const isBar = pos > 0 && pos % spm === 0;
                  const inCursorBeat = Math.floor(pos / cpb) === cursorBeat;
                  const isCursor = cursor.string === si && cursor.pos === pos;
                  const cell = grid[si][pos];
                  const fret = cell === null ? null : (typeof cell === 'object' ? cell.fret : cell);
                  const tech = cell !== null && typeof cell === 'object' ? cell.technique : null;
                  return (
                    <div
                      key={pos}
                      onClick={() => { commitDraft(); setCursor({ string: si, pos }); }}
                      className="shrink-0 flex items-center justify-center relative cursor-pointer"
                      style={{
                        width: cellW, height: cellH,
                        borderLeft: isBar ? '2px solid var(--ds-gray-500)' : '1px solid var(--ds-gray-300)',
                        background: isCursor ? 'var(--color-brand-soft)' : inCursorBeat ? 'var(--ds-gray-alpha-100)' : 'transparent',
                        outline: isCursor ? '1px solid var(--color-brand)' : 'none',
                        borderRadius: isCursor ? 3 : 0,
                      }}
                    >
                      <div className="absolute left-0 right-0 pointer-events-none" style={{ top: '50%', height: 1, background: 'var(--ds-gray-300)' }} />
                      {isCursor && draft !== '' ? (
                        <span className="relative z-[1] font-mono text-label-12 font-bold text-[var(--color-brand-text)]">{draft}</span>
                      ) : fret !== null && (
                        <span className="relative z-[1] font-mono text-label-12 font-bold text-[var(--chord)] leading-none">{fret}{tech && <span className="text-[9px] text-[var(--ds-gray-600)]">{tech}</span>}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Context bar */}
        <div className="shrink-0 border-t border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] px-3 py-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {DURATIONS.map(d => (
              <button key={d.id} type="button" onClick={() => setDuration(d.id)} title={d.title}
                className={`rounded-md px-2 py-1 text-[15px] font-mono cursor-pointer border ${duration === d.id ? 'border-[var(--chord)] text-[var(--chord)] bg-[var(--ds-gray-100)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'}`}>{d.label}</button>
            ))}
            <div className="w-px h-5 bg-[var(--ds-gray-400)] mx-0.5" />
            <div className="relative">
              <Button variant="secondary" size="xs" onClick={() => setFxOpen(v => !v)}>FX</Button>
              {fxOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-10 w-[150px] rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] shadow-lg py-1">
                  {TECHNIQUES.map(t => (
                    <button key={t.id} type="button" onClick={() => applyTechnique(t.id)} className="w-full text-left px-3 py-1.5 text-label-12 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] bg-transparent border-none cursor-pointer">
                      <span className="font-mono font-bold mr-1.5">{t.id}</span>{t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="xs" onClick={() => { commitDraft(); advance(); }}>Rest →</Button>
          </div>
          {/* Number pad */}
          <div className="flex flex-wrap gap-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(d => (
              <button key={d} type="button" onClick={() => inputDigit(d)} className="flex-1 min-w-[34px] py-2 rounded-md font-mono text-label-14 font-bold bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] cursor-pointer">{d}</button>
            ))}
            <button type="button" onClick={backspace} aria-label="Delete" className="flex-1 min-w-[34px] py-2 rounded-md text-label-13 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] cursor-pointer">⌫</button>
            <button type="button" onClick={confirmAndAdvance} aria-label="Next" className="flex-[2] min-w-[60px] py-2 rounded-md text-label-13 font-semibold bg-[var(--color-brand-soft)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] hover:opacity-90 cursor-pointer">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-2.5 py-1 text-label-12 font-semibold cursor-pointer border ${active ? 'border-[var(--chord)] text-[var(--chord)] bg-[var(--ds-gray-100)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'}`}>{children}</button>
  );
}
