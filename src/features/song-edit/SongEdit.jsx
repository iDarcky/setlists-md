import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useConfirm } from '@/ui/useConfirmHook';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getArrangement, withArrangement, addArrangement, deleteArrangement, setDefaultArrangement, resolveSongView } from '@/arrangements';
import { transposeArrangement } from '@/lib/transposeArrangement';
import { parseLine, parseTabBlock, extractInlineNotes, lineToPlacement, CUE_MAX_CHARS, INLINE_NOTE_MAX_CHARS, EXTRA_META_FIELDS } from '@/parser';
import { compactLabel, sectionStyle, semitonesBetween } from '@/music';
import { isChordToken } from '@/importer';
import { normalizeText } from '@/lib/search';
import { youtubeDuration, formatLength } from '@/lib/embedPlayers';
import { youtubeId } from '@/lib/coverArt';
import TabTool from './TabTool';
import { Field, KeyGrid, ArtistInput, NewSongForm } from './NewSongForm';
import { libraryArtists, detailsMissing } from './newSongDetails';
import VersionHistory from './VersionHistory';
import { useTeam } from '@/auth/useTeam';
import { songDoc, songFromDoc } from '@/sync/songDoc';
import { pushSongVersion } from '@/storage';
import { TAB_INSTRUMENTS, instrumentForStrings } from '@/data/tabInstruments';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { inferSections } from '@/lib/detectSections';
import {
  playOrder, withOrder, move, renameSection, newSectionName, deleteSection, addSection, setLines, setSection,
  chordPalette, sectionToText, textToLines, SECTION_TYPES,
  arrangementToText, textToSections, blocksToSections, setChordAt, songMarkdown, applyMarkdown,
  linesToWords, remapWords, wordsToLines, lineRuns, runsToLines, setLineNotes, pastedLines,
} from '@/lib/songEdit';
import { MoreIcon } from '@/features/song/SongView';

// The preview is the real Reader, so it draws exactly what the band will see.
const Reader = lazy(() => import('@/features/reader/Reader'));
import { PlusIcon } from '@/app/navIcons';
import { canFillVerseChords, fillVerseChords } from '@/lib/verseChords';

// The song editor, built from zero (canvas → "Song, edit and chart", Edit
// row). Two tabs instead of four: **Chart** is the chart itself, editable in
// place (tap a line to change its words or chords), and **Info** is the form.
// Preview is a button (beside the editor from 1024px, instead of it on a phone).
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
// The header's title and artist: plain text until you tap, then a field.
const headIn = 'h-6 w-full min-w-0 max-w-[420px] truncate rounded-[6px] border-0 bg-transparent px-1.5 text-center font-sans outline-none placeholder:text-muted-foreground/70 hover:bg-raised focus:bg-raised focus-visible:ring-2 focus-visible:ring-ring';
// One compact control in the details row over the chart.
const pill = 'inline-flex h-9 min-h-0 shrink-0 cursor-pointer items-center gap-1 rounded-control border border-border bg-transparent px-2 font-sans text-[14px] font-medium text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';
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
    const instr = TAB_INSTRUMENTS[line.instrument || instrumentForStrings(line.strings?.length)]?.label || 'Guitar';
    return (
      <span className="flex flex-col gap-1 rounded-card border border-border bg-card px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{line.savedName ? `Saved tab · ${line.savedName}` : `Tab · ${instr}`}{line.time ? ` · ${line.time}` : ''}</span>
        <pre className="m-0 overflow-x-auto font-mono text-[12px] leading-4 text-foreground">{(line.strings || []).map(x => `${x.note}|${x.content}`).join('\n') || 'Empty tab'}</pre>
      </span>
    );
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
function TapLine({ line, id, picked, onPick, onNote }) {
  const { clean, notes } = extractInlineNotes(line);
  const parts = parseLine(clean);
  const { plainText, chords } = lineToPlacement(clean);
  const endChord = chords.some(c => c.pos === plainText.length);
  const chordOnly = chords.length > 0 && !plainText.trim();
  const cols = parts.reduce((acc, p) => [...acc, { ...p, start: acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].text.length : 0 }], []);
  const pick = (e) => {
    const note = e.target.closest('[data-note]');
    if (note) { onNote?.(note.dataset.note === 'new' ? null : Number(note.dataset.note)); return; }
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
          <span className={cn('font-mono font-semibold text-[var(--chord)]', chordOnly ? 'h-7 text-[14px] leading-7' : chords.length ? 'h-[18px] text-[13px] leading-[18px]' : 'h-0', p.chord && (chordOnly ? 'pr-5' : 'pr-1.5'))}>
            {p.chord ? <span data-pos={p.start} className={cn('cursor-pointer rounded-[4px]', picked === p.start && 'bg-[var(--chord)] px-1 text-background')}>{p.chord}</span> : ''}
          </span>
          {!chordOnly && <span className="min-h-7 text-[17px] leading-7">{[...p.text].map((ch, k) => letter(ch, p.start + k))}</span>}
        </span>
      ))}
      {!endChord && (
        <span className="inline-flex flex-col whitespace-pre">
          {chords.length > 0 && <span className="h-[18px]" />}
          <span className="text-[17px] leading-7">
            {plainText.length ? letter('  ', plainText.length) : (
              <span data-pos={0} className={cn('relative cursor-pointer rounded-[2px] text-[15px] text-muted-foreground', picked === 0 && 'bg-selected')}>{picked === 0 && ghost}Empty line</span>
            )}
          </span>
        </span>
      )}
      {notes.map((t, n) => <button key={`n${n}`} type="button" data-note={n} aria-label={`Note: ${t}, change`} className="mb-0.5 ml-1.5 inline-flex h-6 min-h-0 cursor-pointer items-center self-end rounded-full border-0 bg-warning-fill px-2 font-sans text-[12px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring">{t || 'note'}</button>)}
      {onNote && !notes.length && (
        <button type="button" data-note="new" aria-label="Add a note to this line"
          className="mb-0.5 ml-1.5 inline-flex h-6 min-h-0 cursor-pointer items-center gap-0.5 self-end rounded-full border border-dashed border-chip-border bg-transparent px-1.5 font-sans text-[11px] font-medium text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <PlusIcon size={10} />Note
        </button>
      )}
    </div>
  );
}

const chip = 'flex h-10 min-h-0 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 px-2.5 font-mono text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The old editor's chord bar, drawn new. On a phone it sits at the bottom
 * with no keyboard (chips, not typing); on a computer it opens at the letter
 * with the typing box ready ("D/F#", Enter). Chips, a box, Remove, close. The key's chords keep their
 * order; this song's own chords follow at the end, drawn the same. It stays open, so the
 * next letter is one tap away.
 */
function ChordBar({ line, lineId, pos, palette, popover, onPut, onClose }) {
  const { chords } = lineToPlacement(extractInlineNotes(line).clean);
  const current = chords.find(c => c.pos === pos)?.chord || null;
  const [typed, setTyped] = useState('');
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  const bad = typed.trim() && !isChordToken(typed.trim());
  const put = (c) => { onPut(c); setTyped(''); onClose(); };

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
        {/* One look for every chord: a Bm7 or F/A the writer typed is as much
            this song's chord as the key's own G (to-do 142). */}
        {palette.map(c => (
          <button key={c} type="button" aria-pressed={c === current} onClick={() => put(c)}
            className={cn(chip, c === current ? 'bg-[var(--chord)] text-background' : 'bg-warning-fill text-[var(--chord)]')}>{c}</button>
        ))}
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
function WordsRun({ lines, onChange, autoFocus, placeholder }) {
  const [w, setW] = useState(() => linesToWords(lines));
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (text) => {
    const marks = remapWords(w.text, text, w.marks);
    setW({ text, marks });
    onChange(wordsToLines(text, marks));
  };
  // A paste that carries chords ([G] inline or a chord line over the words)
  // keeps them; plain words paste as the browser does.
  const paste = (e) => {
    const lines = pastedLines(e.clipboardData?.getData('text/plain'));
    if (!lines) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const from = ta.selectionStart ?? w.text.length;
    const to = ta.selectionEnd ?? from;
    // A block pasted mid-line starts on a line of its own.
    const add = linesToWords(lines.length > 1 && from > 0 && w.text[from - 1] !== '\n' ? ['', ...lines] : lines);
    const text = w.text.slice(0, from) + add.text + w.text.slice(to);
    const marks = [
      ...remapWords(w.text, text, w.marks).filter(m => m.at < from || m.at >= from + add.text.length),
      ...add.marks.map(m => ({ ...m, at: m.at + from })),
    ];
    setW({ text, marks });
    onChange(wordsToLines(text, marks));
    const caret = from + add.text.length;
    requestAnimationFrame(() => { try { ta.setSelectionRange(caret, caret); } catch { /* unmounted */ } });
  };
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
      <textarea ref={ref} value={w.text} onChange={(e) => change(e.target.value)} onPaste={paste} spellCheck={false} placeholder={placeholder}
        aria-label="Words"
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

/** The section's chip is its type picker: tap "V1 ▾", pick Chorus. The names
 *  live in the menu, each beside its chip (QA 11 Nov: the header showed the
 *  chip AND the name, saying the same thing twice). */
function SectionName({ name, look, styleOf, onPick }) {
  const [open, setOpen] = useState(false);
  const base = baseType(name);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${name}, change the section type`} title={name}
          className="-ml-1 inline-flex h-8 min-h-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-control border-0 bg-transparent px-1 font-sans outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring" style={{ color: look.b }}>
          {sectionTag(name, look)}<ChevronIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[220px] flex-col p-1.5">
        {SECTION_TYPES.map(t => (
          <button key={t} type="button" className={cn(menuRow, t === base && 'bg-selected')} onClick={() => { setOpen(false); onPick(t); }}>
            {sectionTag(t, styleOf ? styleOf(t) : look)}{t}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function SectionMenu({ section, index, count, onText, onMove, onDuplicate, onDelete, onKeyChange, onTab, saved = [], onSaved }) {
  const [open, setOpen] = useState(false);
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${section.type} options`} className={cn(iconBtn, 'size-9')}><MoreIcon size={18} /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[240px] flex-col p-1.5">
        <button type="button" className={menuRow} onClick={run(onKeyChange)}>Add key change</button>
        <button type="button" className={menuRow} onClick={run(onTab)}>Add tab</button>
        {saved.map(name => <button key={name} type="button" className={menuRow} onClick={run(() => onSaved(name))}>Add saved tab: {name}</button>)}
        <button type="button" className={menuRow} onClick={run(onText)}>Edit as text</button>
        <div className="mx-1 my-1 h-px bg-border" />
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
          <button type="button" className="flex h-10 min-h-0 w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border border-dashed border-border bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none hover:border-chip-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <PlusIcon size={14} />Add a section below
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

function OrderBar({ order, names, onChange, styleOf, vertical = false, onJump = null }) {
  const [open, setOpen] = useState(null);
  const { shown, drag, props } = useChipDrag(order, onChange);
  return (
    <div className={vertical ? 'flex flex-col gap-1' : 'flex flex-wrap items-center gap-1'}>
      {!vertical && <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Order</span>}
      {shown.map(({ name, i }, k) => (
        <Popover key={`${name}${i}`} open={!drag && open === i} onOpenChange={(o) => setOpen(o ? i : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${name}, place ${i + 1}`} style={{ background: styleOf(name).bg, color: styleOf(name).b, touchAction: 'pan-y' }} {...props(i, k)}
              className={cn('flex h-8 min-h-0 min-w-9 shrink-0 cursor-grab select-none items-center justify-center rounded-[7px] border-0 px-2 font-sans text-[12px] font-semibold outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring',
                vertical && 'h-9 w-full justify-start gap-2.5 px-2.5 text-[14px]',
                drag?.from === i && (vertical ? 'cursor-grabbing shadow-[0_4px_12px_rgba(0,0,0,.35)] ring-2 ring-ring' : 'scale-110 cursor-grabbing shadow-[0_4px_12px_rgba(0,0,0,.35)] ring-2 ring-ring'))}>
              {vertical ? (<><span className="w-7 shrink-0 text-[12px] font-bold">{compactLabel(name)}</span><span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">{name}</span><span aria-hidden className="text-[14px] leading-none text-muted-foreground/60">⋮⋮</span></>) : compactLabel(name)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="flex w-[220px] flex-col p-1.5">
            <span className="px-2.5 pb-1 pt-1 text-[13px] font-semibold text-muted-foreground">{name}</span>
            {onJump && <button type="button" className={menuRow} onClick={() => { onJump(name); setOpen(null); }}>Show in the chart</button>}
            <button type="button" className={menuRow} disabled={i === 0} onClick={() => { onChange(move(order, i, -1)); setOpen(null); }}>{vertical ? '↑ Move up' : '← Move left'}</button>
            <button type="button" className={menuRow} disabled={i === order.length - 1} onClick={() => { onChange(move(order, i, 1)); setOpen(null); }}>{vertical ? '↓ Move down' : 'Move right →'}</button>
            <button type="button" className={menuRow} onClick={() => { onChange([...order.slice(0, i + 1), name, ...order.slice(i + 1)]); setOpen(null); }}>Repeat</button>
            <button type="button" className={cn(menuRow, 'text-danger-text')} onClick={() => { onChange(order.filter((_, n) => n !== i)); setOpen(null); }}>Remove</button>
            <p className="m-0 px-2.5 pb-1 pt-1.5 text-[12px] leading-4 text-muted-foreground">Or drag it to move it.</p>
          </PopoverContent>
        </Popover>
      ))}
      <Popover open={open === 'add'} onOpenChange={(o) => setOpen(o ? 'add' : null)}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Add to the order" className={cn('flex h-8 min-h-0 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-dashed border-chip-border bg-transparent p-0 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', vertical && 'h-9 w-full gap-1.5 font-sans text-[14px]')}><PlusIcon size={14} />{vertical && 'Add to the order'}</button>
        </PopoverTrigger>
        <PopoverContent className="flex w-[220px] flex-col p-1.5">
          {names.map(n => <button key={n} type="button" className={menuRow} onClick={() => { onChange([...order, n]); setOpen(null); }}>{n}</button>)}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SectionCard({ arr, index, editing, setEditing, pick, setPick, words, setWords, onArr, onAddAfter, onTab, styleOf, folded = false, onFold }) {
  const sec = arr.sections[index];
  const look = styleOf(sec.type);
  const [mode, setMode] = useState(null); // null | 'cue' | 'text'
  const [noteAt, setNoteAt] = useState(null); // { line, idx | null, draft }
  const [draft, setDraft] = useState('');
  const lines = sec.lines?.length ? sec.lines : [''];
  const at = editing?.sec === index ? editing.line : null;
  const typing = words === index;
  const lineAt = (n, v) => onArr(setLines(arr, index, lines.map((l, i) => (i === n ? v : l))));
  const open = (m) => { setEditing(null); setPick(null); setMode(m); setDraft(m === 'rename' ? sec.type : m === 'cue' ? (sec.note || '') : m === 'text' ? sectionToText(sec) : ''); };
  const runs = lineRuns(sec.lines || []);
  const setRun = (ri, ls) => { const next = runs.slice(); next[ri] = { lines: ls }; onArr(setLines(arr, index, runsToLines(next))); };

  return (
    <section data-sec={index} className="flex scroll-mt-4 flex-col gap-1.5 border-l-2 pl-3" style={{ borderColor: look.br }}>
      <div className="flex min-h-9 items-center gap-2">
        <button type="button" onClick={onFold} aria-expanded={!folded} aria-label={folded ? `Open ${sec.type}` : `Fold ${sec.type} shut`}
          className={cn(iconBtn, '-ml-1.5 size-7 text-muted-foreground')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('transition-transform', folded && '-rotate-90')}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {(
          <>
            <SectionName name={sec.type} look={look} styleOf={styleOf} onPick={(t) => { if (t === baseType(sec.type)) return; onArr(renameSection(arr, index, newSectionName(arr.sections.filter((_, n) => n !== index), t))); }} />
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
                <Svg size={14}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>Lyrics
              </button>
            )}
            <SectionMenu section={sec} index={index} count={arr.sections.length}
              onText={() => { setWords(null); open('text'); }}
              onKeyChange={() => { setWords(null); setPick(null); onArr(setLines(arr, index, [{ type: 'modulate', semitones: 2 }, ...(sec.lines || [])])); setEditing({ sec: index, line: 0 }); }}
              onTab={() => { setWords(null); setPick(null); onTab(null); }}
              saved={(arr.tabLibrary || []).map(t => t.name)}
              onSaved={(name) => { setWords(null); setPick(null); onArr(setLines(arr, index, [...(sec.lines || []), { type: 'tabref', name, tab: (arr.tabLibrary || []).find(t => t.name === name)?.tab || null }])); }}
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
      {folded ? (
        <button type="button" onClick={onFold} className="-mx-2 min-h-0 cursor-pointer self-start truncate rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-[14px] text-muted-foreground outline-none hover:bg-raised">
          {(() => { const ls = (sec.lines || []).filter(l => (typeof l === 'string' ? l.trim() : l)); const first = ls.find(l => typeof l === 'string'); return `${ls.length} ${ls.length === 1 ? 'line' : 'lines'}${first ? ` · ${lineToPlacement(extractInlineNotes(first).clean).plainText.trim().slice(0, 40)}…` : ''}`; })()}
        </button>
      ) : mode === 'text' ? (
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
            <WordsRun key={ri} lines={r.lines} autoFocus={ri === 0}
              placeholder={ri === 0 && !r.lines.some(l => l.trim()) ? 'Type or paste the words. Chords come along if they have them.' : 'More lyrics…'}
              onChange={(ls) => setRun(ri, ls)} />
          ) : (
            <div key={ri} className="px-1"><LineView line={r.obj} /></div>
          )))}
          <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-1 rounded-card border border-border bg-card p-1.5 shadow-[0_4px_16px_rgba(0,0,0,.18)]">
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
              const notesHere = extractInlineNotes(l).notes;
              return (
                <div key={n} className="flex flex-col gap-1">
                  <TapLine line={l} id={`${index}-${n}`} picked={mine ? pick.pos : null}
                    onPick={(pos) => { setEditing(null); setNoteAt(null); setPick(pos == null ? null : { sec: index, line: n, pos }); }}
                    onNote={(idx) => { setPick(null); setNoteAt({ line: n, idx, draft: idx == null ? '' : notesHere[idx] || '' }); }} />
                  {noteAt?.line === n && (
                    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const next = [...notesHere]; if (noteAt.idx == null) next.push(noteAt.draft); else next[noteAt.idx] = noteAt.draft; lineAt(n, setLineNotes(l, next)); setNoteAt(null); }}>
                      <Input autoFocus value={noteAt.draft} maxLength={INLINE_NOTE_MAX_CHARS} onChange={(e) => setNoteAt({ ...noteAt, draft: e.target.value })} placeholder="Note on this line, e.g. build" aria-label="Line note" className="h-10" />
                      {noteAt.idx != null && <Button type="button" variant="ghost" size="sm" className="h-10 text-danger-text" onClick={() => { lineAt(n, setLineNotes(l, notesHere.filter((_, k) => k !== noteAt.idx))); setNoteAt(null); }}>Remove</Button>}
                      <Button size="sm" type="submit" className="h-10">Done</Button>
                    </form>
                  )}
                </div>
              );
            }
            if (l?.type === 'modulate') {
              return (
                <button key={n} type="button" onClick={() => { setPick(null); setEditing({ sec: index, line: n }); }} aria-label="Edit key change"
                  className="-mx-2 min-h-0 cursor-pointer self-start rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised"><LineView line={l} /></button>
              );
            }
            if (l?.type === 'tabref') {
              const libTab = (arr.tabLibrary || []).find(t => t.name === l.name)?.tab || l.tab;
              return (
                <button key={n} type="button" onClick={() => { setPick(null); onTab(n); }} aria-label={`Edit saved tab ${l.name}`}
                  className="-mx-2 min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised"><LineView line={{ ...(libTab || { strings: [] }), type: 'tab', savedName: l.name }} /></button>
              );
            }
            if (l?.type === 'tab') {
              return (
                <button key={n} type="button" onClick={() => { setPick(null); onTab(n); }} aria-label="Edit tab"
                  className="-mx-2 min-h-0 cursor-pointer rounded-control border-0 bg-transparent px-2 py-0.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised"><LineView line={l} /></button>
              );
            }
            return <div key={n} className="py-0.5"><LineView line={l} /></div>;
          })}
          <div className="pt-2"><AddSection onAdd={onAddAfter} /></div>
        </div>
      )}
    </section>
  );
}

function KeyPicker({ value, onChange, onMove, compact = false }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(null); // the key picked, while asking move or rename
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); setTo(null); }}>
      <PopoverTrigger asChild>
        {compact ? (
          <button type="button" aria-label={`Key ${value || 'not set'}, change`} className={cn(pill, 'gap-1.5')}>
            <span className="font-sans text-[12px] font-medium text-muted-foreground">Key</span>
            <span className="font-mono text-[14px] font-semibold text-[var(--chord)]">{value || '—'}</span><ChevronIcon />
          </button>
        ) : (
          <button type="button" aria-label={`Key ${value || 'not set'}, change`}
            className="flex h-12 w-full min-w-0 cursor-pointer items-center justify-between gap-1 rounded-control border border-input bg-background px-3 font-mono text-[15px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11">
            {value || '—'}<ChevronIcon />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[340px] flex-col gap-2 p-2.5">
        {to ? (<>
          <b className="px-1 pt-1 text-[15px] font-semibold">From <span className="font-mono text-[var(--chord)]">{value}</span> to <span className="font-mono text-[var(--chord)]">{to}</span></b>
          <Button onClick={() => { onMove(to); setOpen(false); setTo(null); }}>Move every chord to {to}</Button>
          <Button variant="ghost" onClick={() => { onChange(to); setOpen(false); setTo(null); }}>Only rename the key</Button>
          <p className="m-0 px-1 text-[12px] leading-4 text-muted-foreground">Rename when the key was written down wrong and the chords are right.</p>
        </>) : (<>
        <KeyGrid value={value} onPick={(k) => { if (k === value) return; if (onMove && value) { setTo(k); return; } onChange(k); }} />
        <Button size="sm" variant="ghost" className="self-end" onClick={() => setOpen(false)}>Done</Button>
        </>)}
      </PopoverContent>
    </Popover>
  );
}

// The Info fields. Labels say what a field is for; the old editor's full set
// (tags, Spotify, length, band notes) is all here, capo is not: the reader's
// capo for guitarists is set where it is played.
const MORE_FIELDS = [
  ['originaltitle', 'Original title', 'For translated songs'],
  ['language', 'Language', 'English'],
  ['translator', 'Translator', ''],
  ['album', 'Album', ''],
  ['publishers', 'Publishers', ''],
  ['label', 'Record label', ''],
  ['genres', 'Genres', 'hymn, worship'],
  ['scripture', 'Bible verses', 'Ephesians 2:8'],
  ['moment', 'Moment in the service', 'Communion, offering, opening'],
  ['vocalrange', 'Vocal range', 'A2–C5'],
  ['story', 'Story behind the song', ''],
];

function InfoForm({ song, arr, onSong, onArr, onOldEditor, sameTitle, artists = [] }) {
  const [more, setMore] = useState(false);
  const f = (k, max = 300) => ({ value: song[k] ?? '', maxLength: max, onChange: (e) => onSong({ ...song, [k]: e.target.value }) });
  const a = (k, num) => ({ value: arr[k] ?? '', onChange: (e) => onArr({ ...arr, [k]: num ? (e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) || null) : e.target.value }) });
  const grp = 'm-0 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
  const ph = 'placeholder:text-muted-foreground/50';
  const tagsText = Array.isArray(song.tags) ? song.tags.join(', ') : (song.tags || '');
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Title"><Input {...f('title', 120)} placeholder="Song name" autoFocus={!song.title} className={ph} /></Field>
      {sameTitle && <p className="-mt-2 m-0 text-[13px] text-[var(--chord)]">You already have {sameTitle.title}{sameTitle.artist ? ` by ${sameTitle.artist}` : ''}.</p>}
      <Field label="Artist"><ArtistInput value={song.artist} artists={artists} className={ph} onChange={(artist) => onSong({ ...song, artist })} /></Field>
      <Field label="Release year"><Input inputMode="numeric" {...f('year', 4)} placeholder="1779" className={ph} /></Field>
      <Field label="Notes for the band"><textarea {...a('notes')} maxLength={1000} rows={2} placeholder="Shown with the chart" className={cn('w-full rounded-control border border-input bg-background p-3 font-sans text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', ph)} /></Field>
      <h3 className={grp}>Listen</h3>
      <Field label="YouTube link"><Input {...f('youtube')} inputMode="url" placeholder="youtube.com/watch?v=…" className={ph} /></Field>
      <Field label="Spotify link" hint="gives the song its cover art"><Input {...f('spotify')} inputMode="url" placeholder="open.spotify.com/track/…" className={ph} /></Field>
      <h3 className={grp}>Credits</h3>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CCLI"><Input inputMode="numeric" {...f('ccli', 20)} className={ph} /></Field>
        <Field label="Copyright"><Input {...f('copyright', 150)} placeholder="© …" className={ph} /></Field>
      </div>
      <Field label="Writers"><Input {...f('writers', 100)} placeholder="Comma between names" className={ph} /></Field>
      <h3 className={grp}>Find it later</h3>
      <Field label="Themes"><Input {...f('themes', 200)} placeholder="grace, hope" className={ph} /></Field>
      <Field label="Tags"><Input value={tagsText} maxLength={300} placeholder="fast, opener" className={ph}
        onChange={(e) => onSong({ ...song, tags: e.target.value.split(',').map(t => t.trimStart()).filter((t, i, all) => t || i === all.length - 1) })} /></Field>
      {more ? (
        MORE_FIELDS.map(([k, label, hint]) => (
          <Field key={k} label={label}>
            {k === 'story'
              ? <textarea {...f(k, 1000)} rows={3} className="w-full rounded-control border border-input bg-background p-3 font-sans text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              : <Input {...f(k)} placeholder={hint} className={ph} />}
          </Field>
        ))
      ) : (
        <Button variant="outline" onClick={() => setMore(true)}>More</Button>
      )}
      {onOldEditor && <Button variant="link" className="self-start pt-2" onClick={onOldEditor}>Open the old editor instead</Button>}
    </div>
  );
}

/** The tab grid's saved text → a tab line for the section (keeps its instrument). */
function tabFromGrid(saved, prev) {
  const tm = saved.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const tab = parseTabBlock(saved.split('\n').map(l => l.trim()).filter(l => /^[A-Za-z]\|/.test(l)));
  tab.time = tm && tm[1] ? tm[1].trim() : null;
  if (prev?.instrument) tab.instrument = prev.instrument;
  return tab;
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
function PasteSong({ styleOf, onUse, onBlank, onCancel, replacing = null, onNewArr = null }) {
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
          <Button disabled={!blocks.length} onClick={() => onUse(blocksToSections(blocks))}>{replacing ? `Replace ${replacing}` : 'Use these sections'}</Button>
          {onNewArr && <Button variant="outline" disabled={!blocks.length} onClick={() => onNewArr(blocksToSections(blocks))}>Add as a new arrangement</Button>}
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
/** Things worth a look before saving (never a block): empty sections, an order naming a section that isn't there. */
function reviewIssues(song) {
  const many = song.arrangements.length > 1;
  return song.arrangements.flatMap(a => {
    const pre = many ? `${a.name || 'Arrangement'}: ` : '';
    const empty = (a.sections || []).filter(sc => !(sc.lines || []).some(l => (typeof l === 'string' ? l.trim() : l))).map(sc => `${pre}${sc.type} is empty`);
    const names = new Set((a.sections || []).map(sc => sc.type));
    const missing = [...new Set(playOrder(a).filter(n => !names.has(n)))].map(n => `${pre}the order lists ${n}, which has no section`);
    return [...empty, ...missing];
  });
}

/**
 * The arrangement you are editing: tabs, then its key, BPM, time and length
 * in one band under them. Living together says "these belong to this
 * arrangement" without renaming any field. Tap the open tab for its menu.
 */
/**
 * The arrangement and its numbers as ONE short row over the chart (user
 * feedback 13 Nov: the old tabs + four big boxes took a quarter of a desktop
 * screen). It scrolls away with the chart. The arrangement is a dropdown:
 * pick another, or rename / copy / make default / delete this one.
 */
function ArrangementBar({ arrangements, arr, defaultId, onPick, onRename, onDefault, onDelete, onNew, onArr, chords, stacked = false }) {
  const [naming, setNaming] = useState(null);
  const [menu, setMenu] = useState(false);
  const num = (k) => ({ value: arr[k] ?? '', onChange: (e) => onArr({ ...arr, [k]: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) || null }) });
  const txt = (k) => ({ value: arr[k] ?? '', onChange: (e) => onArr({ ...arr, [k]: e.target.value }) });
  const box = (label, w, props, extra = {}) => (
    <label className={cn(pill, 'cursor-text gap-1.5 focus-within:ring-2 focus-within:ring-ring')}>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <input {...props} {...extra} className={cn('h-full min-w-0 border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-foreground outline-none placeholder:text-muted-foreground/50', w)} />
    </label>
  );
  return (
    <div className={stacked ? 'grid grid-cols-2 gap-1.5 [&>*:first-child]:col-span-2 [&>*]:w-full [&>*]:justify-between' : 'flex w-max items-center gap-1.5'}>
      {naming != null ? (
        <form className="flex shrink-0 items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (naming.trim()) onRename(naming.trim()); setNaming(null); }}>
          <Input autoFocus value={naming} maxLength={40} aria-label="Arrangement name" onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setNaming(null); }} className="h-9 w-[160px]" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setNaming(null)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!naming.trim()}>Save</Button>
        </form>
      ) : (
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Arrangement ${arr.name}, change`} className={pill}>
              <span className="max-w-[160px] truncate">{arr.name || 'Arrangement'}</span>
              {arrangements.length > 1 && <span className="text-[12px] text-muted-foreground">{arrangements.length}</span>}
              <ChevronIcon />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-[260px] flex-col p-1.5">
            <span className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Arrangements</span>
            {arrangements.map(a => (
              <button key={a.id} type="button" aria-pressed={a.id === arr.id} className={cn(menuRow, a.id === arr.id && 'font-semibold')} onClick={() => { setMenu(false); if (a.id !== arr.id) onPick(a.id); }}>
                <span className="w-4 shrink-0 text-[var(--chord)]">{a.id === arr.id ? '✓' : ''}</span>
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                {a.id === defaultId && arrangements.length > 1 && <span className="rounded-full bg-raised px-1.5 text-[11px] font-medium text-muted-foreground">default</span>}
              </button>
            ))}
            {onNew && <button type="button" className={menuRow} onClick={() => { setMenu(false); onNew(); }}><PlusIcon size={14} />New arrangement<span className="text-[12px] text-muted-foreground">a copy</span></button>}
            <div className="mx-1 my-1 h-px bg-border" />
            <button type="button" className={menuRow} onClick={() => { setMenu(false); setNaming(arr.name || ''); }}>Rename {arr.name}</button>
            {arrangements.length > 1 && arr.id !== defaultId && <button type="button" className={cn(menuRow, 'h-auto min-h-11 flex-col items-start gap-0 py-2')} onClick={() => { setMenu(false); onDefault(); }}>Make default<span className="text-[12px] font-normal text-muted-foreground">Opens first, and new setlists use it</span></button>}
            {arrangements.length > 1 && <button type="button" className={cn(menuRow, 'text-danger-text')} onClick={() => { setMenu(false); onDelete(); }}>Delete {arr.name}</button>}
          </PopoverContent>
        </Popover>
      )}
      <KeyPicker compact value={arr.key || ''} onChange={(key) => onArr({ ...arr, key })} onMove={chords ? (to) => onArr({ ...transposeArrangement(arr, semitonesBetween(arr.key, to)), key: to }) : null} />
      {box('BPM', 'w-[3ch]', num('tempo'), { inputMode: 'numeric', maxLength: 3, placeholder: '72', 'aria-label': 'BPM' })}
      {box('Time', 'w-[3.2ch]', txt('time'), { maxLength: 5, placeholder: '4/4', 'aria-label': 'Time' })}
      {box('Length', 'w-[4ch]', txt('duration'), { maxLength: 5, placeholder: '3:45', 'aria-label': 'Length' })}
    </div>
  );
}

/**
 * A new song starts here (user, 13 Nov): name, artist, key and tempo first,
 * the rest behind More, then the chart gets the whole screen. Everything here
 * stays on the Info tab and the row over the chart afterwards.
 */
function NewSongDetails({ song, arr, onSong, onArr, sameTitle, artists = [], onNext, onCancel, wide = true }) {
  const value = { title: song.title, artist: song.artist, youtube: song.youtube, key: arr.key, tempo: arr.tempo, time: arr.time, duration: arr.duration };
  const onChange = (v) => {
    if (v.title !== value.title || v.artist !== value.artist || v.youtube !== value.youtube) onSong({ ...song, title: v.title, artist: v.artist, youtube: v.youtube });
    else onArr({ ...arr, key: v.key, tempo: v.tempo, time: v.time, duration: v.duration });
  };
  const missing = detailsMissing(value);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form className="mx-auto flex w-full max-w-[480px] flex-col gap-3.5 px-4 pb-16 pt-6" onSubmit={(e) => { e.preventDefault(); if (!missing) onNext(); }}>
        <h2 className="m-0 pb-1 text-[22px] font-semibold tracking-[-0.01em]">New song</h2>
        <NewSongForm value={value} onChange={onChange} artists={artists} sameTitle={sameTitle} />
        {wide && (
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={!!missing}>Next: Chart</Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        )}
        {missing && <p className="m-0 text-[13px] text-muted-foreground">Still needs {missing}.</p>}
      </form>
      {!wide && (
        <div className="sticky bottom-0 mt-auto flex shrink-0 gap-2 border-t border-border bg-background px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-[2]" disabled={!!missing} onClick={onNext}>Next: Chart</Button>
        </div>
      )}
    </div>
  );
}

export default function SongEdit({ askDetails = true, song, library = [], historyTeamId = null, mode = 'edit', checking = null, settings, onUpdateSettings, initialArrangementId, onSave, onBack, onDirtyChange, onOldEditor, layout = 'auto', embedded = false }) {
  const confirm = useConfirm();
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  // Undo / redo: every change is a step, except quick typing, which is one.
  const [hist, setHist] = useState(() => ({ past: [], present: song, future: [], at: 0 }));
  const working = hist.present;
  // `step` forces its own undo step (a new arrangement is never folded into a rename).
  const setWorking = useCallback((u, step = false) => setHist((h) => {
    const next = typeof u === 'function' ? u(h.present) : u;
    if (next === h.present) return h;
    const now = Date.now();
    const merge = !step && now - h.at < 700 && h.past.length > 0;
    return { past: merge ? h.past : [...h.past.slice(-99), h.present], present: next, future: [], at: step ? 0 : now };
  }), []);
  const undo = () => setHist(h => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], at: 0 } : h));
  const redo = () => setHist(h => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), at: 0 } : h));
  const [tabEdit, setTabEdit] = useState(null); // { sec, line | null }: the tab grid is open
  const [arrId, setArrId] = useState(() => (song.arrangements?.some(a => a.id === initialArrangementId) ? initialArrangementId : song.defaultArrangementId || song.arrangements?.[0]?.id));
  const [tab, setTab] = useState('chart'); // chart | info
  const [preview, setPreview] = useState(false); // the read-only chart, beside (wide) or instead of (phone) the editor
  const [step, setStep] = useState(mode === 'new' && askDetails ? 'details' : null); // a new song asks the basics first
  const [whole, setWhole] = useState(null); // null | 'paste' | 'text'
  const [editing, setEditing] = useState(null); // { sec, line }: an open key change
  const [pick, setPick] = useState(null); // { sec, line, pos }: the letter the chord bar is for
  const [words, setWords] = useState(null); // the section typed as words
  const [saving, setSaving] = useState(false);
  const [folded, setFolded] = useState(() => new Set()); // `${arrId}:${index}` of sections folded shut
  const [history, setHistory] = useState(false);
  const { members = [] } = useTeam() || {};
  const nameOf = (uid) => members.find(m => m.user_id === uid)?.profile?.display_name || null;
  const dirty = working !== song;
  const fresh = mode !== 'edit';
  // No song without a name, and none without a single line of words or chords.
  const hasLines = working.arrangements.some(x => (x.sections || []).some(sc => (sc.lines || []).some(l => (typeof l === 'string' ? l.trim() : l))));
  const missing = !working.title?.trim() ? (hasLines ? 'a title' : 'a title and at least one line') : !hasLines ? 'at least one line' : null;
  // `checking` = a batch-imported song a leader is walking through: keeping
  // it unchanged is an answer too ("Looks good"), so Save is always live.
  const canSave = !missing && (fresh || dirty || !!checking);
  // Another song in the library with this name ("You already have Amazing Grace").
  const sameTitle = useMemo(() => {
    const t = normalizeText(working.title || '').trim();
    return t ? library.find(x => x && x.id !== working.id && normalizeText(x.title || '').trim() === t) || null : null;
  }, [library, working.title, working.id]);

  // The library's artists, to pick from instead of typing (most used first).
  const artists = useMemo(() => libraryArtists(library), [library]);

  // Never lose work: an unsaved copy stays on this device until it is saved
  // or thrown away, and the next open offers it back.
  const draftKey = mode === 'import' ? null : `setlists-md:song-draft:${mode === 'new' ? 'new' : song.id}`;
  const [draftFound, setDraftFound] = useState(() => {
    if (!draftKey) return null;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || 'null');
      return d?.song?.arrangements?.length && (mode === 'new' || d.song.id === song.id) ? d : null;
    } catch { return null; }
  });
  const dropDraft = useCallback(() => { if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* private mode */ } }, [draftKey]);
  useEffect(() => {
    if (!draftKey || draftFound) return undefined;
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(draftKey, JSON.stringify({ at: Date.now(), song: working }));
        else localStorage.removeItem(draftKey);
      } catch { /* full or private mode */ }
    }, 600);
    return () => clearTimeout(t);
  }, [working, dirty, draftKey, draftFound]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const arr = getArrangement(working, arrId) || working.arrangements[0];
  const onArr = (next) => setWorking(w => withArrangement(w, arr.id, () => next));
  // The chord row keeps its order while you edit; new chords join at the end.
  const [rows, setRows] = useState({});
  const palette = chordPalette(arr, rows[arr.id] || []);
  const closeAll = () => { setEditing(null); setPick(null); setWords(null); };
  const doUndo = () => { closeAll(); undo(); };
  const doRedo = () => { closeAll(); redo(); };
  // ⌘/Ctrl+Z and ⇧⌘/Ctrl+Z, except inside a text box (it has its own undo).
  const keys = useRef(null);
  keys.current = { doUndo, doRedo, save: () => { if (canSave && !saving) save(); } };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); keys.current.save(); return; }
      if (e.key.toLowerCase() !== 'z') return;
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      if (e.shiftKey) keys.current.doRedo(); else keys.current.doUndo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const pickedLine = pick ? arr.sections[pick.sec]?.lines?.[pick.line] : null;
  const closePick = useCallback(() => setPick(null), []);
  if ((rows[arr.id] || []).length !== palette.length) setRows(r => ({ ...r, [arr.id]: palette }));
  const order = playOrder(arr);
  const names = [...new Set(arr.sections.map(s => s.type))];
  const arrangements = working.arrangements.map(a => ({ id: a.id, name: a.name || 'Untitled arrangement', key: a.key, tempo: a.tempo, capo: a.capo, isDefault: a.id === working.defaultArrangementId }));

  const cancel = async () => {
    if ((dirty || mode === 'import') && !(await confirm({ title: 'Leave without saving?', description: fresh ? 'This song won’t be added.' : 'Your changes to this song will be lost.', confirmLabel: 'Leave', variant: 'danger' }))) return;
    dropDraft();
    onDirtyChange?.(false);
    onBack?.();
  };
  const save = async () => {
    // A song needs a name; Info opens with the title box focused.
    if (missing) return;
    if (fresh && sameTitle && !(await confirm({ title: `You already have ${sameTitle.title}`, description: [sameTitle.artist, sameTitle.arrangements?.[0]?.key && `in ${sameTitle.arrangements[0].key}`].filter(Boolean).join(', ') || 'A song with this name is in the library.', confirmLabel: 'Add anyway' }))) return;
    const issues = reviewIssues(working);
    if (issues.length && !(await confirm({ title: 'Check before saving', description: issues.join(' · '), confirmLabel: fresh ? 'Add anyway' : 'Save anyway' }))) return;
    setSaving(true);
    try {
      const out = { ...working, title: working.title.trim(), tags: (Array.isArray(working.tags) ? working.tags : []).map(t => String(t).trim()).filter(Boolean), updatedAt: Date.now() };
      // Same title was already asked about above; the app must not ask twice.
      const ok = await onSave?.(out, { allowDuplicate: true });
      if (ok !== false) { pushSongVersion(out.id, songDoc(out)); dropDraft(); onDirtyChange?.(false); }
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
    <PasteSong styleOf={styleOf} onUse={useSections} replacing={arr.sections.length > 0 ? (arr.name || 'this arrangement') : null}
      onNewArr={mode === 'edit' && arr.sections.length > 0 ? ({ sections, structure }) => {
        const r = addArrangement(working, 'Pasted', { ...arr, sections: [] });
        const fresh2 = getArrangement(r.song, r.arrangementId);
        const filled = structure ? withOrder({ ...fresh2, sections }, structure) : { ...fresh2, sections, structure: [], structureMode: 'auto' };
        setWorking(withArrangement(r.song, r.arrangementId, () => filled), true); setArrId(r.arrangementId); setWhole(null);
      } : null}
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
      {!wide && <OrderBar order={order} names={names} styleOf={styleOf} onChange={(o) => onArr(withOrder(arr, o))} />}
      {arr.sections.map((x, i) => (
        <SectionCard key={`${i}-${x.type}`} arr={arr} index={i} editing={editing} setEditing={setEditing} pick={pick} setPick={setPick} words={words} setWords={setWords} onArr={onArr} styleOf={styleOf}
          onTab={(line) => setTabEdit({ sec: i, line })}
          folded={folded.has(`${arr.id}:${i}`)}
          onFold={() => { closeAll(); setFolded(f => { const n = new Set(f); const k = `${arr.id}:${i}`; if (n.has(k)) n.delete(k); else n.add(k); return n; }); }}
          onAddAfter={(t) => { const r = addSection(arr, i, t); onArr(r.arr); setPick(null); setWords(r.index); }} />
      ))}
      {arr.sections.length === 0 && <AddSection big onAdd={(t) => { const r = addSection(arr, -1, t); onArr(r.arr); setWords(r.index); }} />}
    </div>
  );
  const chordBar = pick && typeof pickedLine === 'string' && !whole && tab === 'chart' && !(preview && !wide) ? (
    <ChordBar key={`${pick.sec}-${pick.line}-${pick.pos}`} line={pickedLine} lineId={`${pick.sec}-${pick.line}`} pos={pick.pos} palette={palette} popover={wide}
      onClose={closePick}
      onPut={(c) => onArr(setLines(arr, pick.sec, arr.sections[pick.sec].lines.map((l, n) => (n === pick.line ? setChordAt(l, pick.pos, c) : l))))} />
  ) : null;
  const tabLine = tabEdit && tabEdit.line != null ? arr.sections[tabEdit.sec]?.lines?.[tabEdit.line] : null;
  const savedName = tabLine?.type === 'tabref' ? tabLine.name : null;
  const savedTab = savedName ? ((arr.tabLibrary || []).find(t => t.name === savedName)?.tab || tabLine.tab || null) : null;
  const savedUses = savedName ? arr.sections.reduce((n, sc) => n + (sc.lines || []).filter(l => l?.type === 'tabref' && l.name === savedName).length, 0) : 0;
  const tabTool = tabEdit && (
    <TabTool initialTab={savedName ? savedTab : tabLine} time={arr.time}
      title={savedName ? `Saved tab · ${savedName}${savedUses > 1 ? ` · used ${savedUses} times` : ''}` : `${tabLine ? 'Tab' : 'New tab'} · ${arr.sections[tabEdit.sec]?.type || ''}`}
      onClose={() => setTabEdit(null)}
      removeLabel={savedName ? 'Take out of this section' : 'Remove tab'}
      onRemove={tabEdit.line != null ? () => { onArr(setLines(arr, tabEdit.sec, (arr.sections[tabEdit.sec].lines || []).filter((_, n) => n !== tabEdit.line))); setTabEdit(null); } : null}
      onSave={(saved) => {
        const tab = tabFromGrid(saved, savedName ? savedTab : tabLine);
        if (savedName) {
          // One saved tab, every place it is used: the library entry and each reference change together.
          const lib = (arr.tabLibrary || []).some(t => t.name === savedName)
            ? arr.tabLibrary.map(t => (t.name === savedName ? { ...t, tab } : t))
            : [...(arr.tabLibrary || []), { name: savedName, tab }];
          onArr({ ...arr, tabLibrary: lib, sections: arr.sections.map(sc => ({ ...sc, lines: (sc.lines || []).map(l => (l?.type === 'tabref' && l.name === savedName ? { ...l, tab } : l)) })) });
        } else {
          const lines = [...(arr.sections[tabEdit.sec].lines || [])];
          if (tabEdit.line != null) lines[tabEdit.line] = tab; else lines.push(tab);
          onArr(setLines(arr, tabEdit.sec, lines));
        }
        setTabEdit(null);
      }} />
  );
  const info = <InfoForm sameTitle={sameTitle} artists={artists} song={working} arr={arr} onSong={setWorking} onArr={onArr} onOldEditor={onOldEditor} />;
  const view = useMemo(() => resolveSongView(working, arr.id), [working, arr.id]);
  const preview_ = arr.sections.length ? (
    <Suspense fallback={null}>
      <div className="relative min-h-[60vh]">
        <Reader embedded narrow song={view} displayMode="chords" settings={settings} onUpdateSettings={onUpdateSettings} selectedKey={arr.key} onSelectKey={() => {}} />
      </div>
    </Suspense>
  ) : <p className="m-0 py-10 text-center text-[14px] text-muted-foreground">The chart shows here once the song has a section.</p>;

  // A new YouTube link fills an empty Length from the video.
  const ytId = youtubeId(working.youtube || '');
  const lastYt = useRef(ytId);
  useEffect(() => {
    if (!ytId || ytId === lastYt.current) return undefined;
    lastYt.current = ytId;
    if (arr.duration) return undefined;
    let live = true;
    const target = arr.id;
    youtubeDuration(ytId).then((sec) => {
      if (live && sec) setWorking(w => withArrangement(w, target, (a) => (a.duration ? a : { ...a, duration: formatLength(sec) })));
    });
    return () => { live = false; };
  }, [ytId, arr.duration, arr.id, setWorking]);
  const hasChords = arr.sections.some(sc => (sc.lines || []).some(l => typeof l === 'string' && l.includes('[')));
  const arrBar = (
    <ArrangementBar arrangements={arrangements} arr={arr} defaultId={working.defaultArrangementId || working.arrangements[0]?.id}
      chords={hasChords} onArr={onArr} stacked={wide}
      onPick={(id) => { setArrId(id); closeAll(); setWhole(null); }}
      onRename={(name) => onArr({ ...arr, name })}
      onDefault={() => setWorking(w => setDefaultArrangement(w, arr.id), true)}
      onDelete={async () => {
        if (!(await confirm({ title: `Delete ${arr.name || 'this arrangement'}?`, description: 'Its chords, order and notes go with it. Undo brings it back until you leave.', confirmLabel: 'Delete', variant: 'danger' }))) return;
        const next = deleteArrangement(working, arr.id);
        setWorking(next, true); setArrId(next.defaultArrangementId || next.arrangements[0].id); closeAll();
      }}
      onNew={mode === 'edit' ? () => { const r = addArrangement(working, `${arr.name || 'Arrangement'} copy`, arr); setWorking(r.song, true); setArrId(r.arrangementId); closeAll(); } : null} />
  );

  const saveLabel = fresh ? 'Add' : checking && !dirty ? 'Looks good' : 'Save';

  if (step === 'details' && !draftFound) {
    return (
      <div data-slot="song-edit" className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
        <NewSongDetails song={working} arr={arr} onSong={setWorking} onArr={onArr} sameTitle={sameTitle} artists={artists} wide={wide} onCancel={cancel} onNext={() => setStep(null)} />
      </div>
    );
  }

  return (
    <div data-slot="song-edit" className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        {wide && <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>}
        {/* Phone: no Cancel/Save up here, so the name sits left, like a page title. */}
        <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5 leading-tight', wide ? 'items-center' : 'items-start')}>
          {/* Title and artist are typed right here (QA 11 Nov), not only in Info. */}
          <input value={working.title ?? ''} maxLength={120} onChange={(e) => setWorking({ ...working, title: e.target.value })}
            placeholder={mode === 'new' ? 'New song' : 'Song name'} aria-label="Title" spellCheck={false}
            className={cn(headIn, 'text-[15px] font-semibold text-foreground', !wide && 'max-w-none text-left text-[17px]')} />
          <input value={working.artist ?? ''} maxLength={120} onChange={(e) => setWorking({ ...working, artist: e.target.value })}
            placeholder={checking ? `Checking · ${checking.left === 1 ? 'last one' : `${checking.left} left`}` : 'Artist'} aria-label="Artist" spellCheck={false}
            className={cn(headIn, 'text-[12px] text-muted-foreground', !wide && 'max-w-none text-left text-[13px]')} />
          {checking && working.artist && <span className="text-[11px] text-muted-foreground">Checking · {checking.left === 1 ? 'last one' : `${checking.left} left`}</span>}
        </div>
        <button type="button" aria-label="Undo" title="Undo" disabled={!hist.past.length} onClick={doUndo} className={cn(iconBtn, 'size-10 disabled:opacity-30')}><Svg size={19}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Svg></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!hist.future.length} onClick={doRedo} className={cn(iconBtn, 'size-10 disabled:opacity-30')}><Svg size={19}><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></Svg></button>
        <EditMenu items={[
          { label: 'Edit all as text', onClick: () => { closeAll(); setWhole('text'); setTab('chart'); } },
          { label: 'Markdown editor', sub: 'The .md file, for those who know it', onClick: () => { closeAll(); setWhole('md'); setTab('chart'); } },
          { label: 'Paste a song', sub: mode === 'new' ? null : 'Replace this arrangement, or add it as a new one', onClick: () => { closeAll(); setWhole('paste'); setTab('chart'); } },
          arr.sections.length > 1 && { label: arr.sections.every((_, i) => folded.has(`${arr.id}:${i}`)) ? 'Open all sections' : 'Fold all sections', onClick: () => { closeAll(); setFolded(f => { const keys = arr.sections.map((_, i) => `${arr.id}:${i}`); const all = keys.every(k => f.has(k)); const n = new Set(f); keys.forEach(k => (all ? n.delete(k) : n.add(k))); return n; }); } },
          canFillVerseChords(arr.sections) && { label: 'Copy verse 1 chords to the other verses', sub: 'Placed at the same spot on each line. Undo if one is off.', onClick: () => { closeAll(); onArr({ ...arr, sections: fillVerseChords(arr.sections) }); } },
          mode === 'edit' && { label: 'Version history', sub: 'Earlier saves of this song', onClick: () => { closeAll(); setHistory(true); } },
          onOldEditor && { label: 'Open the old editor', onClick: onOldEditor },
        ].filter(Boolean)} />
        {wide && <Button size="sm" onClick={save} disabled={!canSave} loading={saving} title={missing ? `Needs ${missing}` : undefined}>{saveLabel}</Button>}
      </div>
      {draftFound && (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-warning-fill px-4 py-2">
          <span className="flex-1 text-[14px] text-foreground">Restore your unsaved changes{draftFound.at ? ` from ${new Date(draftFound.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}?</span>
          <Button size="sm" variant="ghost" onClick={() => { dropDraft(); setDraftFound(null); }}>Discard</Button>
          <Button size="sm" onClick={() => { setStep(null); const d = draftFound.song; setWorking(mode === 'new' ? { ...d, id: song.id } : d, true); setArrId(d.defaultArrangementId || d.arrangements[0].id); setDraftFound(null); }}>Restore</Button>
        </div>
      )}
      {(() => {
        const tabs = (
          <div role="tablist" className="flex w-[150px] shrink-0 gap-0.5 rounded-[10px] bg-raised p-[3px]">
            {[['chart', 'Chart'], ['info', 'Info']].map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id && !(preview && !wide)} onClick={() => { setTab(id); closeAll(); if (!wide) setPreview(false); }}
                className={cn('h-8 min-h-0 flex-1 cursor-pointer rounded-[7px] border-0 bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', tab === id && !(preview && !wide) && 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.18)]')}>{l}</button>
            ))}
          </div>
        );
        const need = missing && (fresh || dirty) && <p className="m-0 text-[13px] text-muted-foreground">To {fresh ? 'add' : 'save'} this song it needs {missing}.</p>;
        const main = (
          <div className={cn('mx-auto flex w-full flex-col gap-3 pb-16', wide ? 'max-w-[760px] px-6 pt-4' : 'max-w-[680px] px-4 pt-3')}>
            <div className="flex items-center gap-2">
              {tabs}
              <Button variant="ghost" size="sm" aria-pressed={preview} className={cn('ml-auto shrink-0 gap-1.5 px-2.5', preview && 'bg-raised text-foreground')} onClick={() => { closeAll(); setPreview(p => !p); }}>
                <Svg size={17}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>Preview
              </Button>
            </div>
            {!wide && tab === 'chart' && !preview && <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">{arrBar}</div>}
            {need}
            <div className="pt-1">{preview && !wide ? preview_ : tab === 'chart' ? chart : info}</div>
          </div>
        );
        const jump = (name) => {
          const i = arr.sections.findIndex(x => x.type === name);
          if (i < 0) return;
          setTab('chart');
          requestAnimationFrame(() => document.querySelector(`[data-slot="song-edit"] [data-sec="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        };
        const head = 'm-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
        return (
          <div className="flex min-h-0 flex-1">
            {wide && (
              // Desktop: the song's frame down the left (arrangement, numbers,
              // the order to read, drag and jump with), so the chart starts at
              // the top and keeps the whole middle.
              <aside className="flex min-h-0 w-[272px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border px-4 pb-10 pt-4">
                <div className="flex flex-col gap-2">
                  <h3 className={head}>Arrangement</h3>
                  {arrBar}
                </div>
                {!whole && arr.sections.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className={head}>Order</h3>
                    <OrderBar vertical order={order} names={names} styleOf={styleOf} onJump={jump} onChange={(o) => onArr(withOrder(arr, o))} />
                  </div>
                )}
              </aside>
            )}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{main}</div>
            {wide && preview && (
              <aside className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-border">
                <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
                  <b className="text-[14px] font-semibold">Preview</b>
                  <Button variant="ghost" size="sm" onClick={() => setPreview(false)}>Close</Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-16 pt-1">{preview_}</div>
              </aside>
            )}
            {chordBar}
            {tabTool}
          </div>
        );
      })()}
      {!wide && !pick && !tabEdit && (
        // Phone: Cancel and Save sit under the thumb (user, 13 Nov), not in the top corners.
        <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5">
          <Button variant="outline" className="flex-1" onClick={cancel}>Cancel</Button>
          <Button className="flex-[2]" onClick={save} disabled={!canSave} loading={saving}>{saveLabel}</Button>
        </div>
      )}
      {history && (
        <VersionHistory songId={song.id} teamId={historyTeamId} nameOf={nameOf} onClose={() => setHistory(false)}
          onRestore={(v) => {
            const back = v.doc ? songFromDoc(v.doc, working.id, v.ts, working) : v.md ? applyMarkdown(working, arr.id, v.md) : null;
            if (back) { setWorking(back, true); setArrId(back.arrangements.some(a => a.id === arr.id) ? arr.id : (back.defaultArrangementId || back.arrangements[0].id)); }
            setHistory(false);
          }} />
      )}
    </div>
  );
}
