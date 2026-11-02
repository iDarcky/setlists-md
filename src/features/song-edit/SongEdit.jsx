import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useConfirm } from '@/ui/useConfirmHook';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getArrangement, withArrangement, addArrangement, resolveSongView } from '@/arrangements';
import { parseLine, extractInlineNotes, lineToPlacement, CUE_MAX_CHARS, EXTRA_META_FIELDS } from '@/parser';
import { compactLabel, keyOptions, sectionStyle, getDiatonicChords } from '@/music';
import { isChordToken } from '@/importer';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { inferSections } from '@/lib/detectSections';
import {
  playOrder, withOrder, move, renameSection, deleteSection, addSection, setLines, setSection,
  chordPalette, sectionToText, textToLines, SECTION_TYPES,
  arrangementToText, textToSections, blocksToSections, setChordAt, songMarkdown, applyMarkdown,
  linesToWords, remapWords, wordsToLines, lineRuns, runsToLines,
} from '@/lib/songEdit';
import { ArrangementChip, MoreIcon } from '@/features/song/SongView';

// The preview is the real Reader, so it draws exactly what the band will see.
const Reader = lazy(() => import('@/features/reader/Reader'));
import { PlusIcon } from '@/app/navIcons';

// The song editor, built from zero (canvas → "Song, edit and chart", Edit
// row). Two tabs instead of four: **Chart** is the chart itself, editable in
// place (tap a line to change its words or chords), and **Info** is the form.
// From 1024px both sit side by side and there are no tabs at all.
//
// It edits the v2 song object directly, one arrangement at a time, and hands
// the whole song to onSave — the same door the old editor used.

const Svg = ({ size = 18, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CueIcon = () => <Svg><path d="M4 5h16v11H8l-4 4z" /></Svg>;
const NoteIcon = () => <Svg><path d="M5 4h14v12l-4 4H5z" /><path d="M15 20v-4h4" /></Svg>;
const KeyIcon = () => <Svg><path d="M7 17 17 7M9 7h8v8" /></Svg>;
const TabIcon = () => <Svg><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="1.6" fill="currentColor" /><circle cx="15" cy="12" r="1.6" fill="currentColor" /></Svg>;
const TextIcon = () => <Svg><path d="M5 6h14M12 6v13M9 19h6" /></Svg>;
const TrashIcon = () => <Svg><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>;

const iconBtn = 'flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';
const menuRow = 'flex h-11 min-h-0 w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[15px] text-foreground outline-none hover:bg-raised focus-visible:bg-raised disabled:cursor-default disabled:opacity-40';
const tool = 'flex h-10 min-h-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent px-2.5 font-sans text-[13px] font-medium text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

// Sections keep the colours the chart gives them (music.js → sectionStyle,
// with the user's chart theme), so a Chorus here is the Chorus there.
const sectionTag = (type, look) => (
  <span className="flex h-6 min-w-7 items-center justify-center rounded-[6px] px-1.5 text-[12px] font-semibold" style={{ background: look.bg, color: look.b }}>{compactLabel(type)}</span>
);

/** A line drawn as the chart draws it: chords over words, cues as gold pills. */
function LineView({ line }) {
  if (typeof line === 'object' && line?.type === 'modulate') {
    return <span className="inline-flex h-7 items-center rounded-full bg-warning-fill px-2.5 text-[13px] font-semibold text-[var(--chord)]">Key change {line.semitones > 0 ? '+' : ''}{line.semitones}{line.every ? ', every time' : ''}</span>;
  }
  if (typeof line === 'object' && line?.type === 'tab') {
    return <pre className="m-0 overflow-x-auto rounded-control bg-raised p-2 font-mono text-[12px] leading-4">{(line.raw || []).join('\n') || 'Empty tab'}</pre>;
  }
  if (typeof line === 'object') return <span className="text-[13px] text-muted-foreground">Tab: {line?.name}</span>;
  const { clean, notes } = extractInlineNotes(line);
  if (!clean.trim() && !notes.length) return <span className="text-[15px] text-muted-foreground">Empty line</span>;
  const parts = parseLine(clean);
  const hasChords = parts.some(p => p.chord);
  if (hasChords && !parts.some(p => p.text.trim())) {
    return (
      <span className="flex flex-wrap items-center gap-x-4">
        {parts.filter(p => p.chord).map((p, n) => <span key={n} className="font-mono text-[14px] font-semibold leading-6 text-[var(--chord)]">{p.chord}</span>)}
        {notes.map((t, n) => <span key={`n${n}`} className="inline-flex h-6 items-center rounded-full bg-warning-fill px-2 text-[12px] font-semibold text-[var(--chord)]">{t || 'note'}</span>)}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-end">
      {parts.map((p, n) => (
        <span key={n} className="inline-flex flex-col whitespace-pre">
          {hasChords && <span className="min-h-[18px] pr-1.5 font-mono text-[13px] font-semibold leading-[18px] text-[var(--chord)]">{p.chord}</span>}
          <span className="text-[16px] leading-6">{p.text || (p.chord ? ' ' : '')}</span>
        </span>
      ))}
      {notes.map((t, n) => <span key={`n${n}`} className="ml-1.5 inline-flex h-6 items-center self-end rounded-full bg-warning-fill px-2 text-[12px] font-semibold text-[var(--chord)]">{t || 'note'}</span>)}
    </span>
  );
}

/**
 * A line of the open chart: every letter is a target. Tap one and the chord
 * bar opens for that spot (a chord already there is picked with it). Drawn
 * the way the chart draws it, chords over their words.
 */
function TapLine({ line, id, picked, onPick }) {
  const { clean, notes } = extractInlineNotes(line);
  const parts = parseLine(clean);
  const { plainText, chords } = lineToPlacement(clean);
  const endChord = chords.some(c => c.pos === plainText.length);
  const chordOnly = chords.length > 0 && !plainText.trim();
  const cols = parts.reduce((acc, p) => [...acc, { ...p, start: acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].text.length : 0 }], []);
  const pick = (e) => {
    const el = e.target.closest('[data-pos]');
    if (!el) return;
    const pos = Number(el.dataset.pos);
    onPick(pos === picked ? null : pos);
  };
  const ghost = <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-[-3px] flex h-[18px] items-center rounded-[4px] px-1 font-mono text-[12px] font-semibold leading-none text-link shadow-[inset_0_0_0_1px_var(--link)]">+</span>;
  const letter = (ch, pos) => (
    <span key={pos} data-pos={pos} className={cn('relative cursor-pointer rounded-[2px]', picked === pos && 'bg-selected shadow-[inset_0_-2px_0_var(--link)]')}>
      {picked === pos && !chords.some(c => c.pos === pos) && ghost}{ch}
    </span>
  );
  return (
    <div data-line={id} role="group" aria-label={`Line: ${plainText.trim() || 'chords only'}. Tap a letter to put a chord on it`} onClick={pick}
      className="flex select-none flex-wrap items-end">
      {cols.map((p) => (
        <span key={p.start} className="inline-flex flex-col whitespace-pre">
          <span className={cn('h-[18px] font-mono text-[13px] font-semibold leading-[18px] text-[var(--chord)]', p.chord && (chordOnly ? 'pr-5' : 'pr-1.5'))}>
            {p.chord ? <span data-pos={p.start} className={cn('cursor-pointer rounded-[4px]', picked === p.start && 'bg-[var(--chord)] px-1 text-background')}>{p.chord}</span> : ''}
          </span>
          <span className="min-h-7 text-[17px] leading-7">{[...p.text].map((ch, k) => letter(ch, p.start + k))}</span>
        </span>
      ))}
      {!endChord && (
        <span className="inline-flex flex-col whitespace-pre">
          <span className="h-[18px]" />
          <span className="text-[17px] leading-7">
            {plainText.length ? letter('  ', plainText.length) : (
              <span data-pos={0} className={cn('relative cursor-pointer rounded-[2px] text-[15px] text-muted-foreground', picked === 0 && 'bg-selected')}>{picked === 0 && ghost}Empty line</span>
            )}
          </span>
        </span>
      )}
      {notes.map((t, n) => <span key={`n${n}`} className="mb-0.5 ml-1.5 inline-flex h-6 items-center self-end rounded-full bg-warning-fill px-2 text-[12px] font-semibold text-[var(--chord)]">{t || 'note'}</span>)}
    </div>
  );
}

const chip = 'flex h-10 min-h-0 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 px-2.5 font-mono text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The old editor's chord bar, drawn new. On a phone it sits at the bottom
 * with no keyboard (chips, not typing); on a computer it opens at the letter
 * with the typing box ready ("D/F#", Enter). Chips, a box, Remove, close. The key's chords keep their
 * order; this song's own chords follow at the end. It stays open, so the
 * next letter is one tap away.
 */
function ChordBar({ line, lineId, pos, palette, diatonic, popover, onPut, onClose }) {
  const { chords } = lineToPlacement(extractInlineNotes(line).clean);
  const current = chords.find(c => c.pos === pos)?.chord || null;
  const [typed, setTyped] = useState('');
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  const bad = typed.trim() && !isChordToken(typed.trim());
  const put = (c) => { onPut(c); setTyped(''); };

  // The popover follows its letter (the chart scrolls, a new chord reflows the line).
  useEffect(() => {
    if (!popover) return undefined;
    const place = () => {
      const el = document.querySelector(`[data-line="${lineId}"] [data-pos="${pos}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const h = ref.current?.offsetHeight || 220;
      const left = Math.max(8, Math.min(r.left - 16, window.innerWidth - 400));
      const top = r.bottom + 8 + h > window.innerHeight - 8 ? Math.max(8, r.top - 26 - h) : r.bottom + 8;
      setAt({ left, top });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [popover, lineId, pos, line]);
  // Docked, the bar covers the bottom of the chart: keep the letter in sight above it.
  useEffect(() => {
    if (popover) return undefined;
    const id = requestAnimationFrame(() => document.querySelector(`[data-line="${lineId}"]`)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(id);
  }, [popover, lineId]);
  // A click outside the bar and the chart's letters closes it; Escape too.
  useEffect(() => {
    const down = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[data-line]')) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    if (popover) document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [popover, onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Chord"
      style={popover ? { position: 'fixed', left: at?.left ?? -9999, top: at?.top ?? -9999 } : undefined}
      className={cn('z-30 flex flex-col gap-2.5 bg-card p-3',
        popover ? 'w-[384px] rounded-card border border-border shadow-[0_12px_32px_rgba(0,0,0,.35)]' : 'shrink-0 border-t border-border pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,.18)]')}>
      <div className="flex flex-wrap gap-1.5">
        {palette.map(c => {
          const own = !diatonic.includes(c);
          return (
            <button key={c} type="button" aria-pressed={c === current} onClick={() => put(c)}
              className={cn(chip, c === current ? 'bg-[var(--chord)] text-background' : own ? 'bg-transparent text-[var(--chord)] shadow-[inset_0_0_0_1px_var(--chord)]' : 'bg-warning-fill text-[var(--chord)]')}>{c}</button>
          );
        })}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim() && !bad) put(typed.trim()); }}>
        <Input autoFocus={popover} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type a chord…" aria-label="Type a chord" aria-invalid={!!bad}
          autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="done"
          className={cn('h-10 flex-1 font-mono', bad && 'border-danger-text')} />
        {current && <Button type="button" variant="ghost" className="h-10 text-danger-text hover:text-danger-text" onClick={() => put(null)}>Remove {current}</Button>}
        <button type="button" aria-label="Close the chord bar" onClick={onClose} className={cn(iconBtn, 'size-10')}><Svg size={16}><path d="M18 6 6 18M6 6l12 12" /></Svg></button>
      </form>
    </div>
  );
}

/**
 * A run of lines typed as one text box: Enter for a new line, and the chords
 * ride along on their letters (drawn behind the text by a mirror that wraps
 * exactly as the box does).
 */
function WordsRun({ lines, onChange, onCaret, autoFocus, placeholder }) {
  const [w, setW] = useState(() => linesToWords(lines));
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (text) => {
    const marks = remapWords(w.text, text, w.marks);
    setW({ text, marks });
    onChange(wordsToLines(text, marks));
  };
  const caret = (el) => onCaret?.(el.value.slice(0, el.selectionStart ?? 0).split('\n').length - 1);
  const chordAt = new Map(w.marks.filter(m => !m.notes).map(m => [m.at, m.chord]));
  const rows = w.text.split('\n');
  const starts = rows.reduce((acc, r, k) => [...acc, k ? acc[k - 1] + rows[k - 1].length + 1 : 0], []);
  const box = 'm-0 whitespace-pre-wrap break-words px-3 py-1.5 font-sans text-[17px] leading-[46px] [overflow-wrap:anywhere]';
  return (
    <div className="relative -mx-1 rounded-card bg-card shadow-[inset_0_0_0_1.5px_var(--link)]">
      <div aria-hidden="true" className={cn(box, 'text-transparent')}>
        {rows.map((r, k) => {
          const start = starts[k];
          const out = [];
          let plain = '';
          for (let i = 0; i <= r.length; i++) {
            const c = chordAt.get(start + i);
            if (c) {
              if (plain) { out.push(plain); plain = ''; }
              out.push(<span key={i} className="relative">{r[i] ?? '​'}<span className="absolute bottom-[78%] left-0 whitespace-nowrap font-mono text-[13px] font-semibold leading-none text-[var(--chord)]">{c}</span></span>);
            } else if (i < r.length) plain += r[i];
          }
          if (plain) out.push(plain);
          return <span key={k}>{out}{k < rows.length - 1 ? '\n' : '​'}</span>;
        })}
      </div>
      <textarea ref={ref} value={w.text} onChange={(e) => { change(e.target.value); caret(e.target); }}
        onSelect={(e) => caret(e.target)} spellCheck={false} placeholder={placeholder}
        aria-label="Words, one line per line"
        className={cn(box, 'absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent text-foreground caret-[var(--link)] outline-none placeholder:text-muted-foreground')} />
    </div>
  );
}

function KeyChangeEditor({ line, onChange, onDelete, onDone }) {
  return (
    <div className="-mx-2 flex flex-wrap items-center gap-2 rounded-card border border-link bg-card p-2">
      <span className="px-1 text-[14px] font-medium">Key change</span>
      <button type="button" aria-label="Down a semitone" className={iconBtn} onClick={() => onChange({ ...line, semitones: Math.max(-11, line.semitones - 1) || -1 })}>−</button>
      <b className="w-8 text-center font-mono text-[16px] text-[var(--chord)]">{line.semitones > 0 ? '+' : ''}{line.semitones}</b>
      <button type="button" aria-label="Up a semitone" className={iconBtn} onClick={() => onChange({ ...line, semitones: Math.min(11, line.semitones + 1) || 1 })}>+</button>
      <button type="button" aria-pressed={!!line.every} onClick={() => { const n = { ...line }; if (n.every) delete n.every; else n.every = true; onChange(n); }}
        className={cn(tool, line.every && 'bg-selected text-link')}>Every time</button>
      <span className="flex-1" />
      <button type="button" aria-label="Remove the key change" className={cn(tool, 'text-muted-foreground')} onClick={onDelete}><TrashIcon /></button>
      <Button size="sm" onClick={onDone}>Done</Button>
    </div>
  );
}

function SectionMenu({ section, index, count, onRename, onText, onMove, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${section.type} options`} className={cn(iconBtn, 'size-9')}><MoreIcon size={18} /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[240px] flex-col p-1.5">
        <button type="button" className={menuRow} onClick={run(onRename)}>Rename</button>
        <button type="button" className={menuRow} onClick={run(onText)}>Edit as text</button>
        <button type="button" className={menuRow} disabled={index === 0} onClick={run(() => onMove(-1))}>Move up</button>
        <button type="button" className={menuRow} disabled={index === count - 1} onClick={run(() => onMove(1))}>Move down</button>
        <button type="button" className={menuRow} onClick={run(onDuplicate)}>Duplicate</button>
        <div className="mx-1 my-1 h-px bg-border" />
        <button type="button" className={cn(menuRow, 'text-danger-text')} onClick={run(onDelete)}>Delete section</button>
      </PopoverContent>
    </Popover>
  );
}

function AddSection({ onAdd, big = false }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {big ? (
          <button type="button" className="flex h-11 min-h-0 w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-dashed border-chip-border bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <PlusIcon size={14} />Add a section
          </button>
        ) : (
          <button type="button" className="flex h-8 min-h-0 cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent px-2 font-sans text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <PlusIcon size={13} />Section after
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="flex w-[240px] flex-col p-1.5">
        {SECTION_TYPES.map(t => <button key={t} type="button" className={menuRow} onClick={() => { setOpen(false); onAdd(t); }}>{t}</button>)}
      </PopoverContent>
    </Popover>
  );
}

/** The play order as chips: tap one to move or remove it, + to add a section's name. */
// Drag a chip to move it: a mouse drags at once, a finger after a short hold
// (so a tap still opens the chip's menu). The bar wraps rather than scrolls,
// so a sideways drag is never mistaken for scrolling the bar.
function useChipDrag(order, onChange) {
  const chips = useRef([]);
  const st = useRef(null); // { from, x, y, active, timer }
  const dragged = useRef(false);
  const [drag, setDrag] = useState(null); // { from, to }
  const nearest = (x, y) => {
    let best = 0, dist = Infinity;
    chips.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };
  const start = (e, i) => {
    if (e.button > 0) return;
    const s = { from: i, x: e.clientX, y: e.clientY, active: false, pointer: e.pointerId, el: e.currentTarget };
    st.current = s;
    dragged.current = false;
    if (e.pointerType !== 'mouse') {
      s.timer = setTimeout(() => {
        s.active = true;
        try { s.el.setPointerCapture(s.pointer); } catch { /* released already */ }
        setDrag({ from: i, to: i });
      }, 280);
    }
  };
  const moveTo = (e) => {
    const s = st.current;
    if (!s) return;
    if (!s.active) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
      if (e.pointerType !== 'mouse') { clearTimeout(s.timer); st.current = null; return; } // moved before the hold: a scroll
      s.active = true;
      try { s.el.setPointerCapture(s.pointer); } catch { /* released already */ }
    }
    e.preventDefault();
    setDrag({ from: s.from, to: nearest(e.clientX, e.clientY) });
  };
  const end = () => {
    const s = st.current;
    st.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.active) {
      dragged.current = true;
      setDrag(d => {
        if (d && d.to !== d.from) {
          const next = [...order];
          const [x] = next.splice(d.from, 1);
          next.splice(d.to, 0, x);
          onChange(next);
        }
        return null;
      });
    }
  };
  const shown = drag ? (() => { const n = [...order.map((name, i) => ({ name, i }))]; const [x] = n.splice(drag.from, 1); n.splice(drag.to, 0, x); return n; })() : order.map((name, i) => ({ name, i }));
  // `k` is where the chip is drawn now (the drag preview), so the nearest
  // drawn chip's place is where the dragged one would land.
  const props = (i, k) => ({
    ref: (el) => { chips.current[k] = el; },
    onPointerDown: (e) => start(e, i),
    onPointerMove: moveTo,
    onPointerUp: end,
    onPointerCancel: () => { if (st.current) clearTimeout(st.current.timer); st.current = null; setDrag(null); },
    onContextMenu: (e) => e.preventDefault(),
    // A drag must not also open the chip's menu.
    onClick: (e) => { if (dragged.current) { e.preventDefault(); dragged.current = false; } },
  });
  return { shown, drag, props };
}

function OrderBar({ order, names, onChange, styleOf }) {
  const [open, setOpen] = useState(null);
  const { shown, drag, props } = useChipDrag(order, onChange);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Order</span>
      {shown.map(({ name, i }, k) => (
        <Popover key={`${name}${i}`} open={!drag && open === i} onOpenChange={(o) => setOpen(o ? i : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${name}, place ${i + 1}`} style={{ background: styleOf(name).bg, color: styleOf(name).b, touchAction: 'pan-y' }} {...props(i, k)}
              className={cn('flex h-8 min-h-0 min-w-9 shrink-0 cursor-grab select-none items-center justify-center rounded-[7px] border-0 px-2 font-sans text-[12px] font-semibold outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring', drag?.from === i && 'scale-110 cursor-grabbing shadow-[0_4px_12px_rgba(0,0,0,.35)] ring-2 ring-ring')}>{compactLabel(name)}</button>
          </PopoverTrigger>
          <PopoverContent className="flex w-[220px] flex-col p-1.5">
            <span className="px-2.5 pb-1 pt-1 text-[13px] font-semibold text-muted-foreground">{name}</span>
            <button type="button" className={menuRow} disabled={i === 0} onClick={() => { onChange(move(order, i, -1)); setOpen(null); }}>Play earlier</button>
            <button type="button" className={menuRow} disabled={i === order.length - 1} onClick={() => { onChange(move(order, i, 1)); setOpen(null); }}>Play later</button>
            <button type="button" className={menuRow} onClick={() => { onChange([...order.slice(0, i + 1), name, ...order.slice(i + 1)]); setOpen(null); }}>Play again after</button>
            <button type="button" className={cn(menuRow, 'text-danger-text')} onClick={() => { onChange(order.filter((_, n) => n !== i)); setOpen(null); }}>Take out of the order</button>
          </PopoverContent>
        </Popover>
      ))}
      <Popover open={open === 'add'} onOpenChange={(o) => setOpen(o ? 'add' : null)}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Add to the order" className="flex h-8 min-h-0 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-dashed border-chip-border bg-transparent p-0 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><PlusIcon size={14} /></button>
        </PopoverTrigger>
        <PopoverContent className="flex w-[220px] flex-col p-1.5">
          {names.map(n => <button key={n} type="button" className={menuRow} onClick={() => { onChange([...order, n]); setOpen(null); }}>{n}</button>)}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SectionCard({ arr, index, editing, setEditing, pick, setPick, words, setWords, onArr, onAddAfter, styleOf }) {
  const sec = arr.sections[index];
  const look = styleOf(sec.type);
  const [mode, setMode] = useState(null); // null | 'rename' | 'cue' | 'text'
  const [draft, setDraft] = useState('');
  // A key change or tab added from Words remounts the boxes around it.
  const [session, setSession] = useState(0);
  const caret = useRef({ run: 0, line: 0 });
  const lines = sec.lines?.length ? sec.lines : [''];
  const at = editing?.sec === index ? editing.line : null;
  const typing = words === index;
  const lineAt = (n, v) => onArr(setLines(arr, index, lines.map((l, i) => (i === n ? v : l))));
  const open = (m) => { setEditing(null); setPick(null); setMode(m); setDraft(m === 'rename' ? sec.type : m === 'cue' ? (sec.note || '') : m === 'text' ? sectionToText(sec) : ''); };
  const runs = lineRuns(sec.lines || []);
  const setRun = (ri, ls) => { const next = runs.slice(); next[ri] = { lines: ls }; onArr(setLines(arr, index, runsToLines(next))); };
  // Key change / tab from Words: in after the line the caret is on.
  const insertAtCaret = (obj) => {
    const { run, line } = caret.current;
    const r = runs[run]?.lines ? run : runs.findIndex(x => x.lines);
    const ls = runs[r]?.lines || [];
    const cut = Math.min(ls.length, (r === run ? line : ls.length - 1) + 1);
    const next = [...runs.slice(0, r), { lines: ls.slice(0, cut) }, { obj }, { lines: ls.slice(cut) }, ...runs.slice(r + 1)];
    const all = runsToLines(next);
    const a = setLines(arr, index, all);
    onArr(a);
    return { a, at: all.indexOf(obj) };
  };

  return (
    <section className="flex flex-col gap-1.5 border-l-2 pl-3" style={{ borderColor: look.br }}>
      <div className="flex min-h-9 items-center gap-2">
        {sectionTag(sec.type, look)}
        {mode === 'rename' ? (
          <form className="flex flex-1 gap-1.5" onSubmit={(e) => { e.preventDefault(); onArr(renameSection(arr, index, draft.trim())); setMode(null); }}>
            <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Section name" className="h-9" />
            <Button size="sm" type="submit">Done</Button>
          </form>
        ) : (
          <>
            <b className="whitespace-nowrap text-[15px] font-semibold" style={{ color: look.b }}>{sec.type}</b>
            {/* The band cue lives here, by the name, as the chart shows it: tap to change; "+ Cue" when there is none. */}
            {mode !== 'cue' && (sec.note ? (
              <button type="button" onClick={() => open('cue')} aria-label={`Band cue: ${sec.note}, change`}
                className="inline-flex h-7 min-h-0 min-w-0 cursor-pointer items-center truncate rounded-full border-0 bg-warning-fill px-2.5 font-sans text-[12px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring">{sec.note}</button>
            ) : (
              <button type="button" onClick={() => open('cue')}
                className="inline-flex h-7 min-h-0 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-chip-border bg-transparent px-2.5 font-sans text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><PlusIcon size={12} />Cue</button>
            ))}
            <span className="flex-1" />
            {!typing && mode !== 'text' && (
              <button type="button" onClick={() => { setMode(null); setPick(null); setEditing(null); setWords(index); }}
                className="inline-flex h-8 min-h-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-raised px-2.5 font-sans text-[13px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Svg size={14}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>Words
              </button>
            )}
            <SectionMenu section={sec} index={index} count={arr.sections.length}
              onRename={() => open('rename')} onText={() => { setWords(null); open('text'); }}
              onMove={(d) => onArr({ ...arr, sections: move(arr.sections, index, d) })}
              onDuplicate={() => { const { arr: a, index: i } = addSection(arr, index, sec.type.replace(/\s*\d+$/, '')); onArr(setSection(a, i, { lines: [...lines], note: sec.note })); }}
              onDelete={() => { setWords(null); setPick(null); onArr(deleteSection(arr, index)); }} />
          </>
        )}
      </div>
      {mode === 'cue' && (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); onArr(setSection(arr, index, { note: draft.trim() || undefined })); setMode(null); }}>
          <Input autoFocus value={draft} maxLength={CUE_MAX_CHARS} onChange={(e) => setDraft(e.target.value)} placeholder="Band cue, e.g. Keys and voice only" aria-label="Band cue" className="h-10" />
          <Button size="sm" type="submit">Done</Button>
        </form>
      )}
      {mode === 'text' ? (
        <div className="flex flex-col gap-2">
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.max(4, draft.split('\n').length + 1)} spellCheck={false} aria-label={`${sec.type} as text`}
            className="w-full rounded-control border border-input bg-background p-3 font-mono text-[14px] leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <p className="m-0 text-[12px] text-muted-foreground">[G] before a word puts the chord there. {'{!text}'} is a note, {'{modulate: +2}'} a key change, {'{tab}'} … {'{/tab}'} a guitar tab.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onArr(setLines(arr, index, textToLines(draft))); setMode(null); }}>Done</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          </div>
        </div>
      ) : typing ? (
        <div className="flex flex-col gap-2 pt-1">
          {runs.map((r, ri) => (r.lines ? (
            <WordsRun key={`${session}-${ri}`} lines={r.lines} autoFocus={ri === 0}
              placeholder={ri === 0 && !r.lines.some(l => l.trim()) ? 'Type the words, one line per line' : 'More words…'}
              onCaret={(line) => { caret.current = { run: ri, line }; }}
              onChange={(ls) => setRun(ri, ls)} />
          ) : (
            <div key={`${session}-${ri}`} className="px-1"><LineView line={r.obj} /></div>
          )))}
          <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-1 rounded-card border border-border bg-card p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.18)]">
            <button type="button" className={tool} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { const { at: n } = insertAtCaret({ type: 'modulate', semitones: 2 }); setWords(null); setEditing({ sec: index, line: n }); }}><KeyIcon />Key change</button>
            <button type="button" className={tool} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { const { a } = insertAtCaret({ type: 'tab', strings: [], time: null, instrument: null, raw: ['e|-----------|', 'B|-----------|', 'G|-----------|', 'D|-----------|', 'A|-----------|', 'E|-----------|'] }); setSession(x => x + 1); setWords(null); setMode('text'); setDraft(sectionToText(a.sections[index])); }}><TabIcon />Tab</button>
            <span className="flex-1" />
            <Button size="sm" onClick={() => setWords(null)}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {lines.map((l, n) => {
            if (at === n && typeof l === 'object' && l?.type === 'modulate') {
              return <KeyChangeEditor key={n} line={l} onChange={(v) => lineAt(n, v)} onDelete={() => { onArr(setLines(arr, index, lines.filter((_, i) => i !== n))); setEditing(null); }} onDone={() => setEditing(null)} />;
            }
            if (typeof l === 'string') {
              const mine = pick?.sec === index && pick.line === n;
              return <TapLine key={n} line={l} id={`${index}-${n}`} picked={mine ? pick.pos : null} onPick={(pos) => { setEditing(null); setPick(pos == null ? null : { sec: index, line: n, pos }); }} />;
            }
            if (l?.type === 'modulate') {
              return (
                <button key={n} type="button" onClick={() => { setPick(null); setEditing({ sec: index, line: n }); }} aria-label="Edit key change"
                  className="-mx-2 min-h-0 cursor-pointer self-start rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised"><LineView line={l} /></button>
              );
            }
            return <div key={n} className="py-0.5"><LineView line={l} /></div>;
          })}
          <div className="-mx-2 flex items-center gap-1">
            <AddSection onAdd={onAddAfter} />
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">{label}{hint && <span className="font-normal"> · {hint}</span>}</span>
      {children}
    </label>
  );
}

function InfoForm({ song, arr, onSong, onArr, onOldEditor }) {
  const [more, setMore] = useState(false);
  const keys = useMemo(() => keyOptions('flats'), []);
  const f = (k) => ({ value: song[k] ?? '', onChange: (e) => onSong({ ...song, [k]: e.target.value }) });
  const a = (k, num) => ({ value: arr[k] ?? '', onChange: (e) => onArr({ ...arr, [k]: num ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value }) });
  const grp = 'm-0 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
  const shown = new Set(['writers', 'copyright', 'themes']);
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Title"><Input {...f('title')} placeholder="Song name" autoFocus={!song.title} /></Field>
      <Field label="Artist or writer"><Input {...f('artist')} /></Field>
      <h3 className={grp}>{arr.name || 'This arrangement'}</h3>
      <div className="grid grid-cols-4 gap-2">
        <Field label="Key">
          <select value={arr.key || ''} onChange={(e) => onArr({ ...arr, key: e.target.value })}
            className="h-12 w-full rounded-control border border-input bg-background px-2 font-mono text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11">
            {keys.map(k => <option key={k.value} value={k.value}>{k.value}</option>)}
          </select>
        </Field>
        <Field label="BPM"><Input inputMode="numeric" {...a('tempo', true)} /></Field>
        <Field label="Time"><Input {...a('time')} placeholder="4/4" /></Field>
        <Field label="Capo"><Input inputMode="numeric" {...a('capo', true)} /></Field>
      </div>
      <p className="m-0 text-[12px] leading-4 text-muted-foreground">Changing the key here only renames it. To move every chord, use Key on the song page.</p>
      <h3 className={grp}>Listen</h3>
      <Field label="YouTube link"><Input {...f('youtube')} placeholder="youtube.com/watch?v=…" /></Field>
      <h3 className={grp}>Credits</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CCLI"><Input inputMode="numeric" {...f('ccli')} /></Field>
        <Field label="Copyright"><Input {...f('copyright')} /></Field>
      </div>
      <Field label="Writers"><Input {...f('writers')} /></Field>
      <Field label="Themes" hint="commas between"><Input {...f('themes')} /></Field>
      {more ? (
        EXTRA_META_FIELDS.filter(([k]) => !shown.has(k)).map(([k]) => (
          <Field key={k} label={k === 'originaltitle' ? 'Original title' : k === 'vocalrange' ? 'Vocal range' : k === 'scripture' ? 'Bible verses' : k[0].toUpperCase() + k.slice(1)}>
            {k === 'story' ? <textarea {...f(k)} rows={3} className="w-full rounded-control border border-input bg-background p-3 font-sans text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /> : <Input {...f(k)} />}
          </Field>
        ))
      ) : (
        <Button variant="outline" onClick={() => setMore(true)}>More: album, year, language, Bible verses …</Button>
      )}
      {onOldEditor && <Button variant="link" className="self-start pt-2" onClick={onOldEditor}>Open the old editor instead</Button>}
    </div>
  );
}

const area = 'w-full rounded-control border border-input bg-background p-3 font-mono text-[14px] leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const baseType = (t) => String(t || '').replace(/\s*\d+$/, '').trim();
// "[Verse 1]", "Chorus:", "(Bridge)": the line a block was named from.
const LABEL_LINE = /^[[(]?\s*(intro|verses?|pre[\s-]?chorus|chorus|bridge|instrumental|interlude|tag|vamp|outro|ending|refrain)\b[\s\d.:)\]x×]*$/i;
const withoutLabel = (lines) => (LABEL_LINE.test((lines[0] || '').trim()) ? lines.slice(1) : lines);

/**
 * Paste a whole song, then check the sections we read out of it. Blank lines
 * split it into blocks; a block that comes back is the chorus. Each block's
 * name is a chip to correct — that is where "it starts on the chorus" gets
 * fixed, rather than being asked up front (same rules as the old editor's
 * PasteReview, drawn new).
 */
function PasteSong({ styleOf, onUse, onBlank, onCancel }) {
  const [text, setText] = useState('');
  const [blocks, setBlocks] = useState(null);
  const read = () => setBlocks(inferSections(text).map(b => ({ type: baseType(b.type), lines: b.lines, repeat: b.repeat || 1, sure: b.confident })));
  const setType = (i, type) => setBlocks(bs => bs.map((b, j) => (j === i ? { ...b, type, sure: true } : b)));
  if (blocks) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <b className="text-[16px] font-semibold">Check the sections</b>
          <span className="text-[13px] text-muted-foreground">{blocks.length} found</span>
        </div>
        <p className="m-0 text-[13px] text-muted-foreground">Tap a name to fix it. A chorus that comes back is played twice, not written twice.</p>
        {blocks.map((b, i) => {
          const look = styleOf(b.type);
          return (
            <div key={i} className="flex flex-col gap-1.5 border-l-2 pl-3" style={{ borderColor: look.br }}>
              <div className="flex items-center gap-2">
                <TypePicker value={b.type} look={look} sure={b.sure} onPick={(t) => setType(i, t)} />
                <span className="flex-1" />
                {i > 0 && <Button size="sm" variant="ghost" onClick={() => setBlocks(bs => bs.flatMap((x, j) => (j === i ? [] : j === i - 1 ? [{ ...x, lines: [...x.lines, ...bs[i].lines] }] : [x])))}>Join with above</Button>}
                <button type="button" aria-label="Leave this block out" className={cn(iconBtn, 'size-9 text-muted-foreground')} onClick={() => setBlocks(bs => bs.filter((_, j) => j !== i))}><TrashIcon /></button>
              </div>
              <pre className="m-0 overflow-x-auto whitespace-pre font-mono text-[13px] leading-5 text-muted-foreground">{withoutLabel(b.lines).slice(0, 4).join('\n')}{withoutLabel(b.lines).length > 4 ? `\n… ${withoutLabel(b.lines).length - 4} more lines` : ''}</pre>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button disabled={!blocks.length} onClick={() => onUse(blocksToSections(blocks))}>Use these sections</Button>
          <Button variant="ghost" onClick={() => setBlocks(null)}>Back to the text</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <b className="text-[16px] font-semibold">Paste the whole song</b>
      <p className="m-0 text-[13px] text-muted-foreground">Lyrics with chords over them, ChordPro, Ultimate Guitar or plain words. Leave a blank line between sections.</p>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={14} spellCheck={false} aria-label="The whole song" placeholder={'G        C        G\nAmazing grace how sweet the sound\n\nChorus\n…'} className={area} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!text.trim()} onClick={read}>Read sections</Button>
        {onBlank && <Button variant="ghost" onClick={onBlank}>Start with an empty verse</Button>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

function TypePicker({ value, look, sure = true, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${value}, change`} style={{ background: look.bg, color: look.b, borderColor: look.br }}
          className={cn('flex h-8 min-h-0 cursor-pointer items-center gap-1 rounded-[7px] border px-2.5 font-sans text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', !sure && 'border-dashed')}>
          {value}<ChevronIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[220px] flex-col p-1.5">
        {SECTION_TYPES.map(t => <button key={t} type="button" className={menuRow} onClick={() => { setOpen(false); onPick(t); }}>{t}</button>)}
      </PopoverContent>
    </Popover>
  );
}
const ChevronIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

function EditMenu({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="More ways to edit" className={cn(iconBtn, 'size-10')}><MoreIcon size={20} /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[260px] flex-col p-1.5">
        {items.map(it => (
          <button key={it.label} type="button" className={cn(menuRow, it.sub && 'h-auto min-h-11 flex-col items-start gap-0 py-2')} onClick={() => { setOpen(false); it.onClick(); }}>
            {it.label}{it.sub && <span className="text-[12px] text-muted-foreground">{it.sub}</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Every section of this arrangement as one text (or the .md file), for big changes. */
function WholeText({ initial, title, hint, onDone, onCancel }) {
  const [text, setText] = useState(initial);
  return (
    <div className="flex flex-col gap-3">
      <b className="text-[16px] font-semibold">{title}</b>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={Math.max(16, text.split('\n').length + 2)} spellCheck={false} aria-label={title} className={area} />
      <p className="m-0 text-[12px] text-muted-foreground">{hint}</p>
      <div className="flex gap-2">
        <Button onClick={() => onDone(text)}>Done</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * @param {object} p
 * @param {object} p.song  the v2 song (with arrangements)
 */
// mode: 'edit' (a song in the library) · 'new' (blank, from + New song) ·
// 'import' (parsed from a file or paste, not saved yet). A new or imported song
// can be saved untouched; an edit only once something changed.
export default function SongEdit({ song, mode = 'edit', settings, onUpdateSettings, initialArrangementId, onSave, onBack, onDirtyChange, onOldEditor, layout = 'auto', embedded = false }) {
  const confirm = useConfirm();
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [working, setWorking] = useState(song);
  const [arrId, setArrId] = useState(() => (song.arrangements?.some(a => a.id === initialArrangementId) ? initialArrangementId : song.defaultArrangementId || song.arrangements?.[0]?.id));
  const [tab, setTab] = useState('chart'); // phone: chart | info | preview
  const [side, setSide] = useState('info'); // wide: the right column, info | preview
  const [whole, setWhole] = useState(null); // null | 'paste' | 'text'
  const [editing, setEditing] = useState(null); // { sec, line }: an open key change
  const [pick, setPick] = useState(null); // { sec, line, pos }: the letter the chord bar is for
  const [words, setWords] = useState(null); // the section typed as words
  const [saving, setSaving] = useState(false);
  const dirty = working !== song;
  const fresh = mode !== 'edit';
  const canSave = fresh || dirty;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const arr = getArrangement(working, arrId) || working.arrangements[0];
  const onArr = (next) => setWorking(w => withArrangement(w, arr.id, () => next));
  // The chord row keeps its order while you edit; new chords join at the end.
  const [rows, setRows] = useState({});
  const palette = chordPalette(arr, rows[arr.id] || []);
  const diatonic = useMemo(() => getDiatonicChords(arr.key || 'C').slice(0, 6), [arr.key]);
  const closeAll = () => { setEditing(null); setPick(null); setWords(null); };
  const pickedLine = pick ? arr.sections[pick.sec]?.lines?.[pick.line] : null;
  const closePick = useCallback(() => setPick(null), []);
  if ((rows[arr.id] || []).length !== palette.length) setRows(r => ({ ...r, [arr.id]: palette }));
  const order = playOrder(arr);
  const names = [...new Set(arr.sections.map(s => s.type))];
  const arrangements = working.arrangements.map(a => ({ id: a.id, name: a.name || 'Untitled arrangement', key: a.key, tempo: a.tempo, capo: a.capo, isDefault: a.id === working.defaultArrangementId }));

  const cancel = async () => {
    if ((dirty || mode === 'import') && !(await confirm({ title: 'Leave without saving?', description: fresh ? 'This song won’t be added.' : 'Your changes to this song will be lost.', confirmLabel: 'Leave', variant: 'danger' }))) return;
    onDirtyChange?.(false);
    onBack?.();
  };
  const save = async () => {
    // A song needs a name; Info opens with the title box focused.
    if (!working.title?.trim()) { setTab('info'); setSide('info'); return; }
    setSaving(true);
    try {
      const ok = await onSave?.({ ...working, title: working.title.trim(), updatedAt: Date.now() });
      if (ok !== false) onDirtyChange?.(false);
    } finally { setSaving(false); }
  };

  const colors = useMemo(() => resolveSectionColors(settings), [settings]);
  const custom = settings?.customSectionTypes;
  const styleOf = (type) => sectionStyle(type || '', colors, custom);
  // Nothing written yet: the chart opens on the paste box, like a blank page.
  const pasting = whole === 'paste' || (whole == null && arr.sections.length === 0);
  const useSections = ({ sections, structure, meta = {} }) => {
    onArr(structure ? withOrder({ ...arr, sections }, structure) : { ...arr, sections, structure: [], structureMode: 'auto' });
    setWorking(w => ({
      ...w,
      title: w.title?.trim() ? w.title : (meta.title || w.title),
      artist: w.artist?.trim() ? w.artist : (meta.artist || w.artist),
    }));
    setWhole(null);
  };

  const chart = pasting ? (
    <PasteSong styleOf={styleOf} onUse={useSections}
      onBlank={arr.sections.length === 0 ? () => { const r = addSection(arr, -1, 'Verse'); onArr(r.arr); setWords(r.index); setWhole(null); } : null}
      onCancel={whole === 'paste' ? () => setWhole(null) : null} />
  ) : whole === 'text' ? (
    <WholeText key="text" title="The whole song as text" initial={arrangementToText(arr)} onCancel={() => setWhole(null)}
      hint="## Name starts a section, > text under it is the band cue, [G] before a word puts the chord there."
      onDone={(t) => { onArr({ ...arr, sections: textToSections(t) }); setWhole(null); closeAll(); }} />
  ) : whole === 'md' ? (
    <WholeText key="md" title="Markdown" initial={songMarkdown(working, arr.id)} onCancel={() => setWhole(null)}
      hint="The song's .md file for this arrangement: the details between the --- lines, then the sections. Done puts it back on the song."
      onDone={(t) => { setWorking(w => applyMarkdown(w, arr.id, t)); setWhole(null); closeAll(); }} />
  ) : (
    <div className="flex flex-col gap-5">
      <OrderBar order={order} names={names} styleOf={styleOf} onChange={(o) => onArr(withOrder(arr, o))} />
      <p className="m-0 text-[13px] text-muted-foreground">{wide ? 'Click a letter to put a chord on it, or type one straight away (D/F#, Enter). Words changes the lyrics.' : 'Tap a letter to put a chord on it. Tap Words to change the lyrics.'}</p>
      {arr.sections.map((x, i) => (
        <SectionCard key={`${i}-${x.type}`} arr={arr} index={i} editing={editing} setEditing={setEditing} pick={pick} setPick={setPick} words={words} setWords={setWords} onArr={onArr} styleOf={styleOf}
          onAddAfter={(t) => { const r = addSection(arr, i, t); onArr(r.arr); setPick(null); setWords(r.index); }} />
      ))}
      {arr.sections.length === 0 && <AddSection big onAdd={(t) => { const r = addSection(arr, -1, t); onArr(r.arr); setWords(r.index); }} />}
    </div>
  );
  const chordBar = pick && typeof pickedLine === 'string' && !whole && (wide || tab === 'chart') ? (
    <ChordBar key={`${pick.sec}-${pick.line}-${pick.pos}`} line={pickedLine} lineId={`${pick.sec}-${pick.line}`} pos={pick.pos} palette={palette} diatonic={diatonic} popover={wide}
      onClose={closePick}
      onPut={(c) => onArr(setLines(arr, pick.sec, arr.sections[pick.sec].lines.map((l, n) => (n === pick.line ? setChordAt(l, pick.pos, c) : l))))} />
  ) : null;
  const info = <InfoForm song={working} arr={arr} onSong={setWorking} onArr={onArr} onOldEditor={onOldEditor} />;
  const view = useMemo(() => resolveSongView(working, arr.id), [working, arr.id]);
  const preview = arr.sections.length ? (
    <Suspense fallback={null}>
      <div className="relative min-h-[60vh]">
        <Reader embedded narrow song={view} displayMode="chords" settings={settings} onUpdateSettings={onUpdateSettings} selectedKey={arr.key} onSelectKey={() => {}} />
      </div>
    </Suspense>
  ) : <p className="m-0 py-10 text-center text-[14px] text-muted-foreground">The chart shows here once the song has a section.</p>;

  const seg = (items, value, onPick) => (
    <div role="tablist" className="flex flex-1 gap-0.5 rounded-[10px] bg-raised p-[3px]">
      {items.map(([id, l]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onPick(id)}
          className={cn('h-[34px] min-h-0 flex-1 cursor-pointer rounded-[7px] border-0 bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', value === id && 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.18)]')}>{l}</button>
      ))}
    </div>
  );
  // The arrangement is what you are editing, so it sits under the title,
  // with the same dropdown as the song page. One arrangement on a new song
  // is just "the song": no chip until there is a choice to make.
  const arrChip = (
    <ArrangementChip arrangements={arrangements} current={arr.id}
      onRename={(name) => onArr({ ...arr, name })}
      onPick={(id) => { setArrId(id); closeAll(); setWhole(null); }}
      onNew={mode === 'edit' ? () => { const r = addArrangement(working, `${arr.name || 'Arrangement'} copy`, arr); setWorking(r.song); setArrId(r.arrangementId); } : null} />
  );

  return (
    <div data-slot="song-edit" className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 leading-tight">
          <b className="max-w-full truncate text-[15px] font-semibold">{working.title?.trim() || (mode === 'new' ? 'New song' : 'Untitled')}</b>
          {arrChip || <span className="text-[12px] text-muted-foreground">{mode === 'new' ? 'New song' : mode === 'import' ? 'Check and add' : 'Editing'}</span>}
        </div>
        <EditMenu items={[
          { label: 'Edit all as text', onClick: () => { closeAll(); setWhole('text'); setTab('chart'); } },
          { label: 'Markdown editor', sub: 'The .md file, for those who know it', onClick: () => { closeAll(); setWhole('md'); setTab('chart'); } },
          mode === 'new' && { label: 'Paste a song', onClick: () => { closeAll(); setWhole('paste'); setTab('chart'); } },
          onOldEditor && { label: 'Open the old editor', onClick: onOldEditor },
        ].filter(Boolean)} />
        <Button size="sm" onClick={save} disabled={!canSave} loading={saving}>{fresh ? 'Add' : 'Save'}</Button>
      </div>
      {wide ? (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-6 pb-16 pt-5">{chart}</div>
          </div>
          <aside className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-border">
            <div className="flex shrink-0 px-5 pb-2 pt-3">{seg([['info', 'Info'], ['preview', 'Preview']], side, setSide)}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-16 pt-2">{side === 'info' ? info : preview}</div>
          </aside>
          {chordBar}
        </div>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-[680px] shrink-0 px-4 py-2.5">
            {seg([['chart', 'Chart'], ['info', 'Info'], ['preview', 'Preview']], tab, (id) => { setTab(id); closeAll(); })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[680px] px-4 pb-16 pt-1">{tab === 'chart' ? chart : tab === 'info' ? info : preview}</div>
          </div>
          {chordBar}
        </>
      )}
    </div>
  );
}
