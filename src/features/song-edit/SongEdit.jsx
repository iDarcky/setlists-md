import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useConfirm } from '@/ui/useConfirmHook';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getArrangement, withArrangement, addArrangement } from '@/arrangements';
import { parseLine, extractInlineNotes, CUE_MAX_CHARS, EXTRA_META_FIELDS } from '@/parser';
import { compactLabel, keyOptions } from '@/music';
import {
  playOrder, withOrder, move, renameSection, deleteSection, addSection, setLines, setSection,
  chordPalette, sectionToText, textToLines, SECTION_TYPES,
} from '@/lib/songEdit';
import { ArrangementChip, MoreIcon } from '@/features/song/SongView';
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

const sectionTag = (type) => (
  <span className="flex h-6 min-w-7 items-center justify-center rounded-[6px] bg-selected px-1.5 text-[12px] font-semibold text-link">{compactLabel(type)}</span>
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

/** The tapped line, open in place, with the song's chords and the tools under it. */
function LineEditor({ value, onChange, onDone, onEnter, palette, onCue, onKey, onTab, onText, onDelete, cue }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
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
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
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
          <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`[${c}]`)}
            className="flex h-9 min-h-0 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-warning-fill px-2 font-mono text-[14px] font-semibold text-[var(--chord)] outline-none focus-visible:ring-2 focus-visible:ring-ring">{c}</button>
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert('[]', 0)} className="flex h-9 min-h-0 shrink-0 cursor-pointer items-center rounded-control border border-border bg-transparent px-2.5 font-sans text-[13px] font-medium text-muted-foreground outline-none">Other</button>
      </div>
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
      <p className="m-0 px-1 text-[12px] leading-4 text-muted-foreground">Tap a chord to put it where the cursor is. Enter starts a new line.</p>
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

function SectionMenu({ section, index, count, onRename, onCue, onText, onMove, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${section.type} options`} className={cn(iconBtn, 'size-9')}><MoreIcon size={18} /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[240px] flex-col p-1.5">
        <button type="button" className={menuRow} onClick={run(onRename)}>Rename</button>
        <button type="button" className={menuRow} onClick={run(onCue)}>{section.note ? 'Change the band cue' : 'Add a band cue'}</button>
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
function OrderBar({ order, names, onChange }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Order</span>
      {order.map((name, i) => (
        <Popover key={`${name}${i}`} open={open === i} onOpenChange={(o) => setOpen(o ? i : null)}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${name}, place ${i + 1}`} className="flex h-8 min-h-0 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-selected px-2 font-sans text-[12px] font-semibold text-link outline-none focus-visible:ring-2 focus-visible:ring-ring">{compactLabel(name)}</button>
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

function SectionCard({ arr, index, palette, editing, setEditing, onArr, onAddAfter }) {
  const sec = arr.sections[index];
  const [mode, setMode] = useState(null); // null | 'rename' | 'cue' | 'text'
  const [draft, setDraft] = useState('');
  const lines = sec.lines?.length ? sec.lines : [''];
  const at = editing?.sec === index ? editing.line : null;
  const lineAt = (n, v) => onArr(setLines(arr, index, lines.map((l, i) => (i === n ? v : l))));
  const open = (m) => { setEditing(null); setMode(m); setDraft(m === 'rename' ? sec.type : m === 'cue' ? (sec.note || '') : m === 'text' ? sectionToText(sec) : ''); };
  const insertAfter = (n, items) => onArr(setLines(arr, index, [...lines.slice(0, n + 1), ...items, ...lines.slice(n + 1)]));

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex min-h-9 items-center gap-2">
        {sectionTag(sec.type)}
        {mode === 'rename' ? (
          <form className="flex flex-1 gap-1.5" onSubmit={(e) => { e.preventDefault(); onArr(renameSection(arr, index, draft.trim())); setMode(null); }}>
            <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Section name" className="h-9" />
            <Button size="sm" type="submit">Done</Button>
          </form>
        ) : (
          <>
            <b className="text-[15px] font-semibold">{sec.type}</b>
            {sec.note && mode !== 'cue' && <span className="inline-flex h-6 min-w-0 items-center truncate rounded-full bg-warning-fill px-2 text-[12px] font-semibold text-[var(--chord)]">{sec.note}</span>}
            <span className="flex-1" />
            <SectionMenu section={sec} index={index} count={arr.sections.length}
              onRename={() => open('rename')} onCue={() => open('cue')} onText={() => open('text')}
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
      <Field label="Title"><Input {...f('title')} /></Field>
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

/**
 * @param {object} p
 * @param {object} p.song  the v2 song (with arrangements)
 */
export default function SongEdit({ song, initialArrangementId, onSave, onBack, onDirtyChange, onOldEditor, layout = 'auto', embedded = false }) {
  const confirm = useConfirm();
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [working, setWorking] = useState(song);
  const [arrId, setArrId] = useState(() => (song.arrangements?.some(a => a.id === initialArrangementId) ? initialArrangementId : song.defaultArrangementId || song.arrangements?.[0]?.id));
  const [tab, setTab] = useState('chart');
  const [editing, setEditing] = useState(null); // { sec, line }
  const [saving, setSaving] = useState(false);
  const dirty = working !== song;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const arr = getArrangement(working, arrId) || working.arrangements[0];
  const onArr = (next) => setWorking(w => withArrangement(w, arr.id, () => next));
  const palette = useMemo(() => chordPalette(arr), [arr]);
  const order = playOrder(arr);
  const names = [...new Set(arr.sections.map(s => s.type))];
  const arrangements = working.arrangements.map(a => ({ id: a.id, name: a.name || 'Untitled arrangement', key: a.key, tempo: a.tempo, capo: a.capo, isDefault: a.id === working.defaultArrangementId }));

  const cancel = async () => {
    if (dirty && !(await confirm({ title: 'Leave without saving?', description: 'Your changes to this song will be lost.', confirmLabel: 'Leave', variant: 'danger' }))) return;
    onDirtyChange?.(false);
    onBack?.();
  };
  const save = async () => {
    setSaving(true);
    try {
      const ok = await onSave?.({ ...working, updatedAt: Date.now() });
      if (ok !== false) onDirtyChange?.(false);
    } finally { setSaving(false); }
  };

  const chart = (
    <div className="flex flex-col gap-5">
      <OrderBar order={order} names={names} onChange={(o) => onArr(withOrder(arr, o))} />
      <p className="m-0 text-[13px] text-muted-foreground">Looks like the chart. Tap any line to change its words or chords.</p>
      {arr.sections.map((s, i) => (
        <SectionCard key={`${i}-${s.type}`} arr={arr} index={i} palette={palette} editing={editing} setEditing={setEditing} onArr={onArr}
          onAddAfter={(t) => { const r = addSection(arr, i, t); onArr(r.arr); setEditing({ sec: r.index, line: 0 }); }} />
      ))}
      {arr.sections.length === 0 && <AddSection big onAdd={(t) => { const r = addSection(arr, -1, t); onArr(r.arr); setEditing({ sec: r.index, line: 0 }); }} />}
    </div>
  );
  const info = <InfoForm song={working} arr={arr} onSong={setWorking} onArr={onArr} onOldEditor={onOldEditor} />;

  return (
    <div data-slot="song-edit" className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <b className="text-[15px] font-semibold">Edit song</b>
          <span className="max-w-full truncate text-[12px] text-muted-foreground">{working.title || 'Untitled'}</span>
        </div>
        <Button size="sm" onClick={save} disabled={!dirty} loading={saving}>Save</Button>
      </div>
      <div className={cn('mx-auto flex w-full shrink-0 items-center gap-2 py-2.5', wide ? 'max-w-[1180px] px-6' : 'max-w-[680px] px-4')}>
        {!wide && (
          <div role="tablist" className="flex flex-1 gap-0.5 rounded-[10px] bg-raised p-[3px]">
            {[['chart', 'Chart'], ['info', 'Info']].map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setEditing(null); }}
                className={cn('h-[34px] min-h-0 flex-1 cursor-pointer rounded-[7px] border-0 bg-transparent font-sans text-[14px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', tab === id && 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.18)]')}>{l}</button>
            ))}
          </div>
        )}
        <ArrangementChip arrangements={arrangements} current={arr.id}
          onPick={(id) => { setArrId(id); setEditing(null); }}
          onNew={() => { const r = addArrangement(working, `${arr.name || 'Arrangement'} copy`, arr); setWorking(r.song); setArrId(r.arrangementId); }} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {wide ? (
          <div className="mx-auto flex w-full max-w-[1180px] gap-8 px-6 pb-16 pt-2">
            <div className="min-w-0 flex-1">{chart}</div>
            <aside className="w-[380px] shrink-0 border-l border-border pl-6">{info}</aside>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[680px] px-4 pb-16 pt-1">{tab === 'chart' ? chart : info}</div>
        )}
      </div>
    </div>
  );
}
