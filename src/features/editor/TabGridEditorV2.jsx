import { useState, useEffect, useRef } from 'react';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { stringsForCount, TAB_INSTRUMENTS } from '@/data/tabInstruments';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/ui/Select';

const DEFAULT_STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
const TECHNIQUES = [
  { id: 'h', title: 'Hammer-on' }, { id: 'p', title: 'Pull-off' }, { id: 's', title: 'Slide' },
  { id: 'b', title: 'Bend' }, { id: '~', title: 'Vibrato' }, { id: 'x', title: 'Mute' },
];
const DURATIONS = [
  { id: 'h', label: '𝅗𝅥', beats: 2, title: 'Half' },
  { id: 'q', label: '♩', beats: 1, title: 'Quarter' },
  { id: 'dq', label: '♩.', beats: 1.5, title: 'Dotted quarter' },
  { id: 'e', label: '♪', beats: 0.5, title: 'Eighth' },
  { id: 's', label: '𝅘𝅥𝅯', beats: 0.25, title: 'Sixteenth' },
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
  return { grid, measures };
}

// ─── Tab tool ─────────────────────────────────────────────────────
// Controls are all visible and grouped; the grid reads like a real tab.
// Click a cell and type the fret (auto-advances by the chosen note value).
export default function TabGridEditorV2({
  initialTab, initialName = '', time, strings = DEFAULT_STRINGS, tunings = null,
  instrument = 'electric', counts = null, subdivision = 1,
  onSave, onClose,
}) {
  const timeSig = time || '4/4';
  // Name + instrument are editable here now (they used to be chosen/auto-named
  // before opening). Instrument drives the string set / tuning options.
  const [name, setName] = useState(initialName);
  const [instr, setInstr] = useState(instrument);
  const effCounts = TAB_INSTRUMENTS[instr]?.counts || counts;
  const effTunings = TAB_INSTRUMENTS[instr]?.tunings || tunings;
  const initStrings = initialTab?.strings?.length ? initialTab.strings.map(s => s.note) : strings;
  const initState = initialTab?.strings?.length
    ? gridFromTab(initialTab, timeSig, initStrings)
    : { grid: makeGrid(4, timeSig, initStrings, subdivision), measures: 4 };

  const [curStrings, setCurStrings] = useState(initStrings);
  const [cpb, setCpb] = useState(initialTab ? 4 : subdivision);
  const [measures, setMeasures] = useState(initState.measures);
  const [grid, setGrid] = useState(initState.grid);
  const [duration, setDuration] = useState('q');
  const [cursor, setCursor] = useState({ string: 0, pos: 0 });
  const [editing, setEditing] = useState(null); // {string,pos} cell being typed
  const [val, setVal] = useState('');
  const [lastPlaced, setLastPlaced] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const spm = slotsPerMeasure(timeSig, cpb);
  const totalSlots = spm * measures;
  const labels = beatLabels(timeSig, cpb);
  const durSlots = Math.max(1, Math.round((DURATIONS.find(d => d.id === duration)?.beats || 1) * cpb));

  useEffect(() => { if (editing) inputRef.current?.focus(); else panelRef.current?.focus(); }, [editing]);

  const open = (si, pos) => { setCursor({ string: si, pos }); setEditing({ string: si, pos }); setVal(''); };

  const commit = (si, pos, v, advance = true) => {
    const fret = parseInt(v, 10);
    if (!isNaN(fret) && fret >= 0 && fret <= 24) {
      setGrid(prev => { const n = prev.map(r => [...r]); n[si][pos] = fret; return n; });
      setLastPlaced({ string: si, pos });
    }
    setEditing(null); setVal('');
    if (advance) {
      const next = pos + durSlots;
      if (next >= totalSlots) { setMeasures(m => m + 1); setGrid(prev => prev.map(r => [...r, ...Array(spm).fill(null)])); }
      setCursor({ string: si, pos: next });
    }
  };

  const clearCell = (si, pos) => setGrid(prev => { const n = prev.map(r => [...r]); n[si][pos] = null; return n; });

  const applyTech = (tech) => {
    const t = lastPlaced || cursor;
    setGrid(prev => {
      const n = prev.map(r => [...r]);
      const cell = n[t.string]?.[t.pos];
      if (cell == null) return prev;
      const fret = typeof cell === 'object' ? cell.fret : cell;
      n[t.string][t.pos] = { fret, technique: tech };
      return n;
    });
  };

  const changeStrings = (next) => {
    setGrid(prev => next.map((_, i) => (prev[i] ? [...prev[i]] : Array(totalSlots).fill(null))));
    setCurStrings(next); setCursor({ string: 0, pos: 0 }); setEditing(null);
  };
  const changeInstrument = (id) => {
    setInstr(id);
    const s = TAB_INSTRUMENTS[id]?.strings;
    if (s) changeStrings(s);
  };
  const changeCpb = (newCpb) => {
    setGrid(prev => {
      const nt = slotsPerMeasure(timeSig, newCpb) * measures;
      const next = prev.map(() => Array(nt).fill(null));
      prev.forEach((row, si) => row.forEach((cell, slot) => {
        if (cell == null) return;
        const ns = Math.round((slot / cpb) * newCpb);
        if (ns < nt && next[si][ns] == null) next[si][ns] = cell;
      }));
      return next;
    });
    setCpb(newCpb); setCursor({ string: 0, pos: 0 });
  };
  const addBar = () => { setMeasures(m => m + 1); setGrid(prev => prev.map(r => [...r, ...Array(spm).fill(null)])); };
  const removeBar = () => { if (measures <= 1) return; setMeasures(m => m - 1); setGrid(prev => prev.map(r => r.slice(0, (measures - 1) * spm))); };

  const onGridKey = (e) => {
    if (editing) return;
    const { string: si, pos } = cursor;
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); setCursor({ string: si, pos: Math.min(pos + 1, totalSlots - 1) }); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setCursor({ string: si, pos: Math.max(pos - 1, 0) }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor({ string: Math.min(si + 1, curStrings.length - 1), pos }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor({ string: Math.max(si - 1, 0), pos }); }
    else if (e.key >= '0' && e.key <= '9') { e.preventDefault(); open(si, pos); setVal(e.key); }
    else if (e.key === 'Enter') { e.preventDefault(); open(si, pos); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { clearCell(si, pos); }
    else if ('hpsbx~'.includes(e.key)) applyTech(e.key);
  };

  const handleInsert = () => {
    if (editing) commit(editing.string, editing.pos, val, false);
    const ascii = gridToAscii(grid, measures, timeSig, curStrings, cpb);
    onSave(`{tab, time: ${timeSig}}\n${ascii}\n{/tab}`, { name: name.trim(), instrument: instr });
  };

  const CW = 32, CH = 30, LW = 24;
  const cursorBeat = Math.floor(cursor.pos / cpb);

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={onGridKey}
        className="bg-[var(--ds-background-200)] rounded-2xl border border-[var(--ds-gray-400)] w-full max-w-[820px] max-h-[92vh] flex flex-col outline-none select-none"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        {/* Header — name + instrument, so a new tab is identifiable. */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ds-gray-300)]">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tab name"
            aria-label="Tab name"
            className="min-w-0 flex-1 max-w-[220px] h-8 px-2 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-13 font-semibold text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand-border)]"
          />
          <Select value={instr} onValueChange={changeInstrument}>
            <SelectTrigger aria-label="Instrument" className="h-8 w-auto gap-1.5 px-2.5 text-label-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAB_INSTRUMENTS).map(([id, cfg]) => <SelectItem key={id} value={id}>{cfg.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <IconButton variant="ghost" size="xs" aria-label="Help" title="How to use" onClick={() => setShowHelp(v => !v)}>?</IconButton>
        </div>

        {showHelp && (
          <div className="px-4 py-2 border-b border-[var(--ds-gray-200)] bg-[var(--ds-gray-100)] text-label-11 text-[var(--ds-gray-700)]">
            Click a cell and type a fret (0–24) · Enter to confirm · arrows to move · right-click clears · h p s b ~ x add techniques. The note value sets how far the cursor jumps after each note.
          </div>
        )}

        {/* Visible, grouped controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-100)]">
          {effCounts && effCounts.length > 1 && (
            <Group label="Strings">
              {effCounts.map(n => <Chip key={n} active={curStrings.length === n} onClick={() => changeStrings(stringsForCount(instr, n))}>{n}</Chip>)}
            </Group>
          )}
          {effTunings && effTunings.filter(t => t.strings.length === curStrings.length).length > 1 && (
            <Group label="Tuning">
              <select
                value={effTunings.find(t => t.strings.join('') === curStrings.join(''))?.id || ''}
                onChange={e => { const t = effTunings.find(x => x.id === e.target.value); if (t) changeStrings(t.strings); }}
                className="h-7 px-1.5 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-1000)] outline-none"
              >
                {!effTunings.some(t => t.strings.join('') === curStrings.join('')) && <option value="">Custom</option>}
                {effTunings.filter(t => t.strings.length === curStrings.length).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Group>
          )}
          <Group label="Grid">
            {[{ v: 1, l: '1/4' }, { v: 2, l: '1/8' }, { v: 4, l: '1/16' }].map(o => <Chip key={o.v} active={cpb === o.v} onClick={() => changeCpb(o.v)}>{o.l}</Chip>)}
          </Group>
          <Group label="Bars">
            <IconButton variant="default" size="xs" onClick={removeBar} disabled={measures <= 1} aria-label="Remove bar">−</IconButton>
            <span className="text-label-12 font-mono text-[var(--ds-gray-700)] w-4 text-center">{measures}</span>
            <IconButton variant="default" size="xs" onClick={addBar} aria-label="Add bar">+</IconButton>
          </Group>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="inline-block rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] px-2 py-3">
            {/* beat header */}
            <div className="flex mb-1" style={{ marginLeft: LW }}>
              {Array.from({ length: totalSlots }, (_, pos) => {
                const isBar = pos > 0 && pos % spm === 0;
                const isBeat = pos % cpb === 0;
                return (
                  <div key={pos} className="shrink-0 text-center font-mono" style={{ width: CW, fontSize: isBeat ? 10 : 8, color: isBeat ? 'var(--ds-gray-700)' : 'var(--ds-gray-500)', borderLeft: isBar ? '2px solid var(--ds-gray-400)' : 'none', fontWeight: isBeat ? 700 : 400 }}>
                    {labels[pos % labels.length]}
                  </div>
                );
              })}
            </div>
            {curStrings.map((name, si) => (
              <div key={si} className="flex items-center" style={{ height: CH }}>
                <div className="shrink-0 text-right pr-2 text-label-12-mono font-bold text-[var(--ds-gray-500)]" style={{ width: LW }}>{name}</div>
                <div className="flex relative">
                  {/* continuous string line */}
                  <div className="absolute left-0 right-0 pointer-events-none" style={{ top: '50%', height: 1, background: 'var(--ds-gray-400)' }} />
                  {Array.from({ length: totalSlots }, (_, pos) => {
                    const isBar = pos > 0 && pos % spm === 0;
                    const isCursor = cursor.string === si && cursor.pos === pos;
                    const inBeat = Math.floor(pos / cpb) === cursorBeat;
                    const isEditing = editing && editing.string === si && editing.pos === pos;
                    const cell = grid[si][pos];
                    const fret = cell === null ? null : (typeof cell === 'object' ? cell.fret : cell);
                    const tech = cell !== null && typeof cell === 'object' ? cell.technique : null;
                    return (
                      <div
                        key={pos}
                        onClick={() => open(si, pos)}
                        onContextMenu={e => { e.preventDefault(); clearCell(si, pos); }}
                        className="shrink-0 flex items-center justify-center relative cursor-pointer"
                        style={{
                          width: CW, height: CH,
                          borderLeft: isBar ? '2px solid var(--ds-gray-500)' : 'none',
                          background: isCursor ? 'var(--color-brand-soft)' : inBeat ? 'var(--ds-gray-alpha-100)' : 'transparent',
                          borderRadius: 4,
                          outline: isCursor ? '1.5px solid var(--color-brand)' : 'none',
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={val}
                            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); setVal(v); if (v.length === 2) commit(si, pos, v); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(si, pos, val); }
                              else if (e.key === 'Escape') { setEditing(null); setVal(''); }
                              else if (e.key === 'Backspace' && val === '') { clearCell(si, pos); setEditing(null); }
                            }}
                            onBlur={() => (val ? commit(si, pos, val, false) : setEditing(null))}
                            className="w-[26px] h-[24px] text-center font-mono text-label-13 font-bold rounded-sm bg-[var(--color-brand-soft)] border border-[var(--color-brand)] text-[var(--color-brand-text)] outline-none relative z-[1]"
                          />
                        ) : fret !== null && (
                          <span className="relative z-[1] px-1 rounded bg-[var(--ds-background-100)] font-mono text-label-13 font-bold text-[var(--chord)] leading-none">
                            {fret}{tech && <span className="text-[9px] text-[var(--ds-gray-600)] ml-px">{tech}</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note value + techniques */}
        <div className="shrink-0 border-t border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}>
          <Group label="Note">
            {DURATIONS.map(d => (
              <button key={d.id} type="button" onClick={() => setDuration(d.id)} title={d.title}
                className={`rounded-md px-2 py-1 text-[15px] font-mono cursor-pointer border ${duration === d.id ? 'border-[var(--chord)] text-[var(--chord)] bg-[var(--ds-gray-100)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'}`}>{d.label}</button>
            ))}
          </Group>
          <Group label="Technique">
            {TECHNIQUES.map(t => (
              <button key={t.id} type="button" onClick={() => applyTech(t.id)} disabled={!lastPlaced} title={t.title}
                className={`rounded-md w-7 py-1 text-label-12 font-mono font-semibold cursor-pointer border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] ${!lastPlaced ? 'opacity-40 cursor-not-allowed' : ''}`}>{t.id}</button>
            ))}
          </Group>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="brand" size="sm" onClick={handleInsert}>{initialTab ? 'Save' : 'Insert'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-2 py-1 text-label-12 font-semibold cursor-pointer border ${active ? 'border-[var(--chord)] text-[var(--chord)] bg-[var(--ds-gray-100)]' : 'border-[var(--ds-gray-400)] text-[var(--ds-gray-600)] bg-[var(--ds-gray-100)] hover:bg-[var(--ds-gray-200)]'}`}>{children}</button>
  );
}
