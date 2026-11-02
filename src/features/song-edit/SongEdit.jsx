import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useConfirm } from '@/ui/useConfirmHook';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getArrangement, withArrangement, addArrangement, resolveSongView } from '@/arrangements';
import { parseLine, extractInlineNotes, lineToPlacement, CUE_MAX_CHARS, EXTRA_META_FIELDS } from '@/parser';
import { compactLabel, keyOptions, sectionStyle } from '@/music';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { inferSections } from '@/lib/detectSections';
import {
  playOrder, withOrder, move, renameSection, deleteSection, addSection, setLines, setSection,
  chordPalette, sectionToText, textToLines, SECTION_TYPES,
  arrangementToText, textToSections, blocksToSections, setChordAt, songMarkdown, applyMarkdown,
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
 * The old editor's "tap where the chord goes", drawn new: the line's letters
 * are the targets. Tap one to pick that spot (a chord already there is
 * picked with it), then tap a chord below to put it there.
 */
function ChordTapLine({ value, at, onPick }) {
  const { clean } = extractInlineNotes(value);
  const { plainText, chords } = lineToPlacement(clean);
  const chordAt = new Map(chords.map(c => [c.pos, c.chord]));
  // One spare slot past the last letter, for a chord at the end of the line.
  const cells = [...plainText, ' '];
  return (
    <div className="flex flex-wrap rounded-control bg-background px-2 pb-1.5 pt-1" role="group" aria-label="Tap where a chord goes">
      {cells.map((ch, i) => (
        <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(at === i ? null : i)}
          aria-label={`${chordAt.has(i) ? `Chord ${chordAt.get(i)} at` : 'Put a chord at'} “${ch.trim() || 'end'}”`}
          className={cn('relative inline-flex min-h-0 cursor-pointer flex-col items-start rounded-[4px] border-0 bg-transparent p-0 font-sans text-foreground outline-none', at === i && 'bg-selected')}>
          <span className="h-[18px] whitespace-pre font-mono text-[13px] font-semibold leading-[18px] text-[var(--chord)]">{chordAt.get(i) || ' '}</span>
          <span className={cn('min-w-[7px] whitespace-pre font-sans text-[17px] leading-7', at === i && 'text-link underline decoration-2 underline-offset-4')}>{ch === ' ' && i === cells.length - 1 ? '  ' : ch}</span>
        </button>
      ))}
    </div>
  );
}

/** The tapped line, open in place, with the song's chords and the tools under it. */
function LineEditor({ value, onChange, onDone, onEnter, palette, onCue, onKey, onTab, onText, onDelete, cue }) {
  const ref = useRef(null);
  const [at, setAt] = useState(null); // the letter picked in ChordTapLine
  const [other, setOther] = useState('');
  const [typing, setTyping] = useState(false);
  const hasWords = !!lineToPlacement(extractInlineNotes(value).clean).plainText.trim();
  // A line with words opens on the letters; an empty one on the keyboard.
  useEffect(() => { if (!hasWords) ref.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const chordHere = at != null ? lineToPlacement(extractInlineNotes(value).clean).chords.find(c => c.pos === at)?.chord : null;
  const put = (c) => { if (at != null) onChange(setChordAt(value, at, c)); else insert(`[${c}]`); };
  const insert = (s, select = 0) => {
    const el = ref.current;
    const at = el ? el.selectionStart ?? value.length : value.length;
    const end = el ? el.selectionEnd ?? at : at;
    const next = value.slice(0, at) + s + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      if (select) el.setSelectionRange(at + s.length - select - 1, at + s.length - 1);
      else el.setSelectionRange(at + s.length, at + s.length);
    });
  };
  return (
    <div className="-mx-2 flex flex-col gap-2 rounded-card border border-link bg-card p-2">
      {hasWords && <ChordTapLine value={value} at={at} onPick={setAt} />}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
        onFocus={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); const at = e.currentTarget.selectionStart ?? value.length; onEnter(value.slice(0, at), value.slice(at)); }
          if (e.key === 'Escape') onDone();
        }}
        aria-label="Line: words with [chords]"
        spellCheck={false}
        enterKeyHint="next"
        className="min-h-11 w-full resize-none rounded-control border border-input bg-background px-3 py-2.5 font-mono text-[15px] leading-6 text-foreground outline-none [field-sizing:content] focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {palette.map(c => (
          <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => put(c)}
            className="flex h-9 min-h-0 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-warning-fill px-2 font-mono text-[14px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring">{c}</button>
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (at != null ? setTyping(true) : insert('[]', 0))} className="flex h-9 min-h-0 shrink-0 cursor-pointer items-center rounded-control border border-border bg-transparent px-2.5 font-sans text-[13px] font-medium text-muted-foreground outline-none">Other</button>
        {chordHere && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(setChordAt(value, at, null))} className="flex h-9 min-h-0 shrink-0 cursor-pointer items-center rounded-control border border-border bg-transparent px-2.5 font-sans text-[13px] font-medium text-danger-text outline-none">Remove {chordHere}</button>}
      </div>
      {typing && at != null && (
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (other.trim()) put(other.trim()); setOther(''); setTyping(false); }}>
          <Input autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder="Chord, e.g. Gsus4 or D/F#" aria-label="Chord name" className="h-10 font-mono" />
          <Button size="sm" type="submit">Put</Button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-0.5 border-t border-border pt-1.5">
        <button type="button" className={cn(tool, cue && 'text-[var(--chord)]')} onClick={onCue}><CueIcon />Cue</button>
        <button type="button" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => insert('{!note}', 4)}><NoteIcon />Note</button>
        <button type="button" className={tool} onClick={onKey}><KeyIcon />Key</button>
        <button type="button" className={tool} onClick={onTab}><TabIcon />Tab</button>
        <button type="button" className={tool} onClick={onText}><TextIcon />Text</button>
        <span className="flex-1" />
        <button type="button" aria-label="Delete this line" className={cn(tool, 'text-muted-foreground')} onClick={onDelete}><TrashIcon /></button>
        <Button size="sm" onClick={onDone}>Done</Button>
      </div>
      <p className="m-0 px-1 text-[12px] leading-4 text-muted-foreground">{hasWords ? 'Tap a letter, then a chord. Type in the box to change the words; Enter starts a new line.' : 'Type the words, or tap chords for a chord-only line. Enter starts a new line.'}</p>
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

function SectionCard({ arr, index, palette, editing, setEditing, onArr, onAddAfter, styleOf }) {
  const sec = arr.sections[index];
  const look = styleOf(sec.type);
  const [mode, setMode] = useState(null); // null | 'rename' | 'cue' | 'text'
  const [draft, setDraft] = useState('');
  const lines = sec.lines?.length ? sec.lines : [''];
  const at = editing?.sec === index ? editing.line : null;
  const lineAt = (n, v) => onArr(setLines(arr, index, lines.map((l, i) => (i === n ? v : l))));
  const open = (m) => { setEditing(null); setMode(m); setDraft(m === 'rename' ? sec.type : m === 'cue' ? (sec.note || '') : m === 'text' ? sectionToText(sec) : ''); };
  const insertAfter = (n, items) => onArr(setLines(arr, index, [...lines.slice(0, n + 1), ...items, ...lines.slice(n + 1)]));

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
            <b className="text-[15px] font-semibold" style={{ color: look.b }}>{sec.type}</b>
            {/* The band cue lives here, by the name, as the chart shows it: tap to change; "+ Cue" when there is none. */}
            {mode !== 'cue' && (sec.note ? (
              <button type="button" onClick={() => open('cue')} aria-label={`Band cue: ${sec.note}, change`}
                className="inline-flex h-7 min-h-0 min-w-0 cursor-pointer items-center truncate rounded-full border-0 bg-warning-fill px-2.5 font-sans text-[12px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring">{sec.note}</button>
            ) : (
              <button type="button" onClick={() => open('cue')}
                className="inline-flex h-7 min-h-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-chip-border bg-transparent px-2.5 font-sans text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><PlusIcon size={12} />Cue</button>
            ))}
            <span className="flex-1" />
            <SectionMenu section={sec} index={index} count={arr.sections.length}
              onRename={() => open('rename')} onText={() => open('text')}
              onMove={(d) => onArr({ ...arr, sections: move(arr.sections, index, d) })}
              onDuplicate={() => { const { arr: a, index: i } = addSection(arr, index, sec.type.replace(/\s*\d+$/, '')); onArr(setSection(a, i, { lines: [...lines], note: sec.note })); }}
              onDelete={() => onArr(deleteSection(arr, index))} />
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
      ) : (
        <div className="flex flex-col gap-1">
          {lines.map((l, n) => {
            if (at === n && typeof l === 'object' && l?.type === 'modulate') {
              return <KeyChangeEditor key={n} line={l} onChange={(v) => lineAt(n, v)} onDelete={() => { onArr(setLines(arr, index, lines.filter((_, i) => i !== n))); setEditing(null); }} onDone={() => setEditing(null)} />;
            }
            if (at === n && typeof l === 'string') {
              return (
                <LineEditor key={n} value={l} palette={palette} cue={!!sec.note}
                  onChange={(v) => lineAt(n, v)}
                  onDone={() => setEditing(null)}
                  onEnter={(a, b) => { onArr(setLines(arr, index, [...lines.slice(0, n), a, b, ...lines.slice(n + 1)])); setEditing({ sec: index, line: n + 1 }); }}
                  onCue={() => open('cue')}
                  onKey={() => { insertAfter(n, [{ type: 'modulate', semitones: 2 }]); setEditing({ sec: index, line: n + 1 }); }}
                  onTab={() => { const withTab = [...lines.slice(0, n + 1), { type: 'tab', strings: [], time: null, instrument: null, raw: ['e|-----------|', 'B|-----------|', 'G|-----------|', 'D|-----------|', 'A|-----------|', 'E|-----------|'] }, ...lines.slice(n + 1)]; const a = setLines(arr, index, withTab); onArr(a); setEditing(null); setMode('text'); setDraft(sectionToText(a.sections[index])); }}
                  onText={() => open('text')}
                  onDelete={() => { const rest = lines.filter((_, i) => i !== n); onArr(setLines(arr, index, rest.length ? rest : [''])); setEditing(rest.length ? { sec: index, line: Math.max(0, n - 1) } : null); }}
                />
              );
            }
            const tappable = typeof l === 'string' || l?.type === 'modulate';
            return (
              <button key={n} type="button" disabled={!tappable} onClick={() => setEditing({ sec: index, line: n })}
                aria-label={typeof l === 'string' ? `Edit line: ${l.replace(/\[[^\]]*\]/g, '').trim() || 'chords'}` : l?.type === 'modulate' ? 'Edit key change' : undefined}
                className="-mx-2 min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised disabled:cursor-default">
                <LineView line={l} />
              </button>
            );
          })}
          <div className="-mx-2 flex items-center gap-1">
            <button type="button" onClick={() => { onArr(setLines(arr, index, [...lines, ''])); setEditing({ sec: index, line: lines.length }); }}
              className="flex h-8 min-h-0 cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent px-2 font-sans text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <PlusIcon size={13} />Line
            </button>
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
  const [editing, setEditing] = useState(null); // { sec, line }
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
      onBlank={arr.sections.length === 0 ? () => { const r = addSection(arr, -1, 'Verse'); onArr(r.arr); setEditing({ sec: r.index, line: 0 }); setWhole(null); } : null}
      onCancel={whole === 'paste' ? () => setWhole(null) : null} />
  ) : whole === 'text' ? (
    <WholeText key="text" title="The whole song as text" initial={arrangementToText(arr)} onCancel={() => setWhole(null)}
      hint="## Name starts a section, > text under it is the band cue, [G] before a word puts the chord there."
      onDone={(t) => { onArr({ ...arr, sections: textToSections(t) }); setWhole(null); setEditing(null); }} />
  ) : whole === 'md' ? (
    <WholeText key="md" title="Markdown" initial={songMarkdown(working, arr.id)} onCancel={() => setWhole(null)}
      hint="The song's .md file for this arrangement: the details between the --- lines, then the sections. Done puts it back on the song."
      onDone={(t) => { setWorking(w => applyMarkdown(w, arr.id, t)); setWhole(null); setEditing(null); }} />
  ) : (
    <div className="flex flex-col gap-5">
      <OrderBar order={order} names={names} styleOf={styleOf} onChange={(o) => onArr(withOrder(arr, o))} />
      <p className="m-0 text-[13px] text-muted-foreground">Looks like the chart. Tap any line to change its words or chords.</p>
      {arr.sections.map((x, i) => (
        <SectionCard key={`${i}-${x.type}`} arr={arr} index={i} palette={palette} editing={editing} setEditing={setEditing} onArr={onArr} styleOf={styleOf}
          onAddAfter={(t) => { const r = addSection(arr, i, t); onArr(r.arr); setEditing({ sec: r.index, line: 0 }); }} />
      ))}
      {arr.sections.length === 0 && <AddSection big onAdd={(t) => { const r = addSection(arr, -1, t); onArr(r.arr); setEditing({ sec: r.index, line: 0 }); }} />}
    </div>
  );
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
      onPick={(id) => { setArrId(id); setEditing(null); setWhole(null); }}
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
          { label: 'Edit all as text', onClick: () => { setEditing(null); setWhole('text'); setTab('chart'); } },
          { label: 'Markdown editor', sub: 'The .md file, for those who know it', onClick: () => { setEditing(null); setWhole('md'); setTab('chart'); } },
          mode === 'new' && { label: 'Paste a song', onClick: () => { setEditing(null); setWhole('paste'); setTab('chart'); } },
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
        </div>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-[680px] shrink-0 px-4 py-2.5">
            {seg([['chart', 'Chart'], ['info', 'Info'], ['preview', 'Preview']], tab, (id) => { setTab(id); setEditing(null); })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[680px] px-4 pb-16 pt-1">{tab === 'chart' ? chart : tab === 'info' ? info : preview}</div>
          </div>
        </>
      )}
    </div>
  );
}
