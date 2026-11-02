import { useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { TAB_INSTRUMENTS, stringsForCount, instrumentForStrings } from '@/data/tabInstruments';
import {
  TECHNIQUES, DURATIONS, slotsPerMeasure, beatLabels, makeGrid, gridToAscii, gridFromTab,
} from '@/lib/tabGrid';

const seg = 'h-9 min-h-0 cursor-pointer rounded-[7px] border-0 bg-transparent px-2.5 font-sans text-[13px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const segOn = 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.18)]';
const padKey = 'flex h-11 min-h-0 cursor-pointer items-center justify-center rounded-control border-0 bg-raised font-mono text-[16px] font-semibold text-foreground outline-none active:bg-selected focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

function Seg({ items, value, onPick, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-[10px] bg-raised p-[3px]">
      {items.map(([v, l, title]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} title={title} onClick={() => onPick(v)} className={cn(seg, value === v && segOn)}>{l}</button>
      ))}
    </div>
  );
}

/**
 * The guitar tab editor, drawn new. Tap a spot on a string, then a fret on
 * the pad (or type it on a keyboard); the cursor moves on by the note value.
 * The pad means a phone never opens its keyboard over the grid.
 */
export default function TabTool({ initialTab, time, title, onSave, onRemove, onClose }) {
  const timeSig = initialTab?.time || time || '4/4';
  const startStrings = initialTab?.strings?.length ? initialTab.strings.map(s => s.note) : TAB_INSTRUMENTS.electric.strings;
  const [instr, setInstr] = useState(initialTab?.instrument || instrumentForStrings(startStrings.length));
  const [strings, setStrings] = useState(startStrings);
  const [cpb, setCpb] = useState(initialTab?.strings?.length ? 4 : 2);
  const init = initialTab?.strings?.length ? gridFromTab(initialTab, timeSig, startStrings) : { grid: makeGrid(2, timeSig, startStrings, 2), measures: 2 };
  const [measures, setMeasures] = useState(init.measures);
  const [grid, setGrid] = useState(init.grid);
  const [dur, setDur] = useState('q');
  const [cur, setCur] = useState({ s: 0, p: 0 });
  const [high, setHigh] = useState(false); // the pad shows 13–24
  const typed = useRef({ v: '', at: 0 });
  const box = useRef(null);
  const spm = slotsPerMeasure(timeSig, cpb);
  const total = spm * measures;
  const labels = beatLabels(timeSig, cpb);
  const step = Math.max(1, Math.round((DURATIONS.find(d => d.id === dur)?.beats || 1) * cpb));
  const cell = grid[cur.s]?.[cur.p] ?? null;

  useEffect(() => { box.current?.focus(); }, []);
  // Keep the cursor in view as it moves along.
  useEffect(() => { box.current?.querySelector('[data-cur="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [cur]);

  const grow = (need) => {
    if (need < total) return;
    const add = Math.ceil((need - total + 1) / spm);
    setMeasures(m => m + add);
    setGrid(g => g.map(r => [...r, ...Array(add * spm).fill(null)]));
  };
  const put = (fret, advance = true) => {
    setGrid(g => { const n = g.map(r => [...r]); n[cur.s][cur.p] = fret; return n; });
    if (advance) { const next = cur.p + step; grow(next); setCur({ s: cur.s, p: next }); }
  };
  const clear = () => setGrid(g => { const n = g.map(r => [...r]); n[cur.s][cur.p] = null; return n; });
  const tech = (t) => setGrid(g => {
    const n = g.map(r => [...r]);
    const c = n[cur.s][cur.p];
    if (c == null) return g;
    const fret = typeof c === 'object' ? c.fret : c;
    n[cur.s][cur.p] = (typeof c === 'object' && c.technique === t) ? fret : { fret, technique: t };
    return n;
  });
  const setStringSet = (next) => {
    setGrid(g => next.map((_, i) => (g[i] ? [...g[i]] : Array(total).fill(null))));
    setStrings(next); setCur({ s: 0, p: 0 });
  };
  const changeGrid = (n) => {
    setGrid(g => {
      const nt = slotsPerMeasure(timeSig, n) * measures;
      const out = g.map(() => Array(nt).fill(null));
      g.forEach((row, si) => row.forEach((c, slot) => {
        if (c == null) return;
        const ns = Math.round((slot / cpb) * n);
        if (ns < nt && out[si][ns] == null) out[si][ns] = c;
      }));
      return out;
    });
    setCpb(n); setCur({ s: cur.s, p: 0 });
  };
  const bars = (d) => {
    if (d < 0 && measures <= 1) return;
    setMeasures(m => m + d);
    setGrid(g => g.map(r => (d > 0 ? [...r, ...Array(spm).fill(null)] : r.slice(0, (measures - 1) * spm))));
    if (d < 0 && cur.p >= (measures - 1) * spm) setCur({ s: cur.s, p: 0 });
  };

  const onKey = (e) => {
    if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
    const { s, p } = cur;
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); grow(p + 1); setCur({ s, p: p + 1 }); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setCur({ s, p: Math.max(0, p - 1) }); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCur({ s: Math.min(strings.length - 1, s + 1), p }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur({ s: Math.max(0, s - 1), p }); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear(); }
    else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      // "1" then "2" quickly is fret 12, on the same spot.
      const now = Date.now();
      const t = typed.current;
      if (t.v && now - t.at < 700 && Number(t.v + e.key) <= 24) {
        const fret = Number(t.v + e.key);
        typed.current = { v: '', at: 0 };
        setGrid(g => { const n = g.map(r => [...r]); n[t.s][t.p] = fret; return n; });
        return;
      }
      typed.current = { v: e.key, at: now, s, p };
      put(Number(e.key));
    } else if ('hpsbx~'.includes(e.key)) { e.preventDefault(); tech(e.key); }
  };

  const save = () => onSave(`{tab, time: ${timeSig}}\n${gridToAscii(grid, measures, timeSig, strings, cpb)}\n{/tab}`, { instrument: instr });
  const tunings = (TAB_INSTRUMENTS[instr]?.tunings || []).filter(t => t.strings.length === strings.length);
  const tuningId = tunings.find(t => t.strings.join('') === strings.join(''))?.id;
  const CW = 30;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-label={title} onKeyDown={onKey} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-[860px] select-none flex-col overflow-hidden rounded-t-[16px] border border-border bg-background font-sans text-foreground shadow-[0_16px_48px_rgba(0,0,0,.5)] outline-none sm:max-h-[92vh] sm:rounded-[16px]">
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <b className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{title}</b>
          <Button size="sm" onClick={save}>{initialTab ? 'Save' : 'Add tab'}</Button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Seg label="Instrument" value={instr} items={Object.entries(TAB_INSTRUMENTS).map(([id, c]) => [id, c.label])}
            onPick={(id) => { setInstr(id); setStringSet(TAB_INSTRUMENTS[id].strings); }} />
          {(TAB_INSTRUMENTS[instr]?.counts || []).length > 1 && (
            <Seg label="Strings" value={strings.length} items={TAB_INSTRUMENTS[instr].counts.map(n => [n, `${n} strings`])} onPick={(n) => setStringSet(stringsForCount(instr, n))} />
          )}
          {tunings.length > 1 && (
            <Seg label="Tuning" value={tuningId} items={tunings.map(t => [t.id, t.label])} onPick={(id) => setStringSet(tunings.find(t => t.id === id).strings)} />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <div className="inline-block rounded-card border border-border bg-card px-2 py-2.5">
            <div className="flex" style={{ marginLeft: 22 }}>
              {Array.from({ length: total }, (_, p) => (
                <div key={p} className={cn('shrink-0 text-center font-mono', p % cpb === 0 ? 'text-[10px] font-bold text-muted-foreground' : 'text-[9px] text-muted-foreground/60')}
                  style={{ width: CW, borderLeft: p > 0 && p % spm === 0 ? '2px solid var(--border)' : 'none' }}>{labels[p % labels.length]}</div>
              ))}
            </div>
            {strings.map((name, s) => (
              <div key={s} className="flex items-center" style={{ height: 32 }}>
                <div className="w-[22px] shrink-0 pr-1.5 text-right font-mono text-[12px] font-bold text-muted-foreground">{name}</div>
                <div className="relative flex">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border" />
                  {Array.from({ length: total }, (_, p) => {
                    const c = grid[s][p];
                    const fret = c == null ? null : typeof c === 'object' ? c.fret : c;
                    const t = c != null && typeof c === 'object' ? c.technique : null;
                    const on = cur.s === s && cur.p === p;
                    return (
                      <button key={p} type="button" data-cur={on} aria-label={`${name} string, ${Math.floor(p / spm) + 1}.${(p % spm) + 1}${fret != null ? `, fret ${fret}` : ''}`}
                        onClick={() => { setCur({ s, p }); box.current?.focus(); }}
                        onContextMenu={(e) => { e.preventDefault(); setGrid(g => { const n = g.map(r => [...r]); n[s][p] = null; return n; }); }}
                        className={cn('relative flex h-8 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0 outline-none',
                          on && 'rounded-[5px] bg-selected shadow-[inset_0_0_0_1.5px_var(--link)]')}
                        style={{ width: CW, borderLeft: p > 0 && p % spm === 0 ? '2px solid var(--border)' : undefined }}>
                        {fret != null && (
                          <span className="relative z-[1] rounded-[3px] bg-card px-0.5 font-mono text-[13px] font-bold leading-none text-[var(--chord)]">
                            {fret}{t && <span className="ml-px text-[9px] text-muted-foreground">{t}</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2.5">
            <Seg label="Grid" value={cpb} items={[[1, '1/4'], [2, '1/8'], [4, '1/16']]} onPick={changeGrid} />
            <div className="flex items-center gap-1 rounded-[10px] bg-raised p-[3px]">
              <button type="button" aria-label="One bar less" disabled={measures <= 1} onClick={() => bars(-1)} className={cn(seg, 'w-9 px-0 disabled:opacity-40')}>−</button>
              <span className="px-1 text-[13px] text-muted-foreground">{measures} {measures === 1 ? 'bar' : 'bars'}</span>
              <button type="button" aria-label="One bar more" onClick={() => bars(1)} className={cn(seg, 'w-9 px-0')}>+</button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-3 pt-2.5" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Seg label="Note length, how far the cursor moves" value={dur} items={DURATIONS.map(d => [d.id, d.label, d.title])} onPick={setDur} />
            <div className="flex gap-1" role="group" aria-label="Technique on this note">
              {TECHNIQUES.map(t => (
                <button key={t.id} type="button" title={t.title} aria-label={t.title} disabled={cell == null} onClick={() => tech(t.id)}
                  className={cn(seg, 'w-9 bg-raised px-0 font-mono disabled:opacity-40', cell != null && typeof cell === 'object' && cell.technique === t.id && 'bg-selected text-link')}>{t.id}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Fret">
            {Array.from({ length: 13 }, (_, i) => (high ? i + 12 : i)).filter(n => n <= 24).map(n => (
              <button key={n} type="button" className={padKey} onClick={() => put(n)}>{n}</button>
            ))}
            {!high && <button type="button" className={cn(padKey, 'text-[13px] text-muted-foreground')} onClick={() => setHigh(true)}>13+</button>}
            {high && <button type="button" className={cn(padKey, 'text-[13px] text-muted-foreground')} onClick={() => setHigh(false)}>0–12</button>}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="ghost" size="sm" disabled={cell == null} onClick={clear}>Clear note</Button>
            <Button variant="ghost" size="sm" onClick={() => setCur(c => ({ s: c.s, p: c.p + step < total ? c.p + step : c.p }))}>Rest →</Button>
            <span className="flex-1" />
            {onRemove && <Button variant="ghost" size="sm" className="text-danger-text" onClick={onRemove}>Remove tab</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
