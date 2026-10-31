import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { Markdown } from '@/ui/Markdown';
import { MoreIcon, PlusIcon } from '@/app/navIcons';
import { transposeKey } from '@/music';
import { resolveSongView, getArrangement } from '@/arrangements';
import { searchSongs } from '@/lib/search';
import { suggestSongs } from '@/lib/suggestSongs';
import { buildOrder } from '@/lib/setlistView';
import { useDragReorder, moveItem } from './useDragReorder';

// The setlist page, Edit (leaders; canvas → Setlist → Edit). A copy of the
// setlist is edited here and saved on Done, so nothing reaches the band
// half-made. Drag by the grip, or use Move up / Move down in a row's sheet.

export const NOTE_MAX = 500;
const LENGTHS = [1, 2, 5, 10];

const Label = ({ children }) => <span className="text-[13px] font-semibold text-muted-foreground">{children}</span>;
const Pill = ({ on, children, ...p }) => (
  <button type="button" {...p}
    className={cn('flex h-9 min-h-0 cursor-pointer items-center rounded-full border px-3.5 font-sans text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-transparent bg-selected font-semibold text-foreground' : 'border-border bg-transparent font-medium text-muted-foreground')}>
    {children}
  </button>
);
const Grip = (props) => (
  <span {...props} aria-hidden="true" className="flex h-11 w-7 shrink-0 items-center justify-center text-input">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
  </span>
);

function MoveButtons({ index, count, onMove, onRemove }) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-1">
      <Button variant="outline" disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑ Move up</Button>
      <Button variant="outline" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>↓ Move down</Button>
      <Button variant="outline" className="text-danger" onClick={() => onRemove(index)}>Remove</Button>
    </div>
  );
}

/** Key, who leads and the note for one song in this setlist. */
function SongFields({ item, song, people, onChange }) {
  const base = song?.key || '';
  const keys = base ? Array.from({ length: 12 }, (_, i) => i - 5).map(t => ({ t, key: transposeKey(base, t) })) : [];
  const t = item.transpose || 0;
  return (
    <div className="flex flex-col gap-4">
      {keys.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Key for this setlist</Label>
          <div className="grid grid-cols-6 gap-1.5">
            {keys.map(k => (
              <button key={k.t} type="button" onClick={() => onChange({ transpose: k.t })} aria-pressed={k.t === t}
                className={cn('flex h-9 min-h-0 cursor-pointer items-center justify-center rounded-control border font-mono text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  k.t === t ? 'border-link bg-selected text-link' : k.t === 0 ? 'border-dashed border-input bg-transparent text-foreground' : 'border-border bg-transparent text-foreground')}>
                {k.key}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label>Who leads it</Label>
        <div className="flex flex-wrap gap-1.5">
          {people.map(p => <Pill key={p.id} on={item.leadBy === p.id} onClick={() => onChange({ leadBy: item.leadBy === p.id ? undefined : p.id })}>{p.name}</Pill>)}
          {!people.length && <span className="text-[13px] text-muted-foreground">Pick the band first; then you can choose who leads.</span>}
        </div>
      </div>
      <label className="flex flex-col gap-2">
        <Label>Note for the band</Label>
        <Input value={item.note || ''} maxLength={NOTE_MAX} placeholder="e.g. Start soft, keys only" onChange={e => onChange({ note: e.target.value.slice(0, NOTE_MAX) })} />
      </label>
    </div>
  );
}

function MomentFields({ item, onChange, onOpenNote }) {
  const custom = item.duration && !LENGTHS.includes(item.duration);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <Label>Name</Label>
        <Input value={item.label || ''} maxLength={60} placeholder="e.g. Offering" onChange={e => onChange({ label: e.target.value })} />
      </label>
      <div className="flex flex-col gap-2">
        <Label>Length</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {LENGTHS.map(m => <Pill key={m} on={item.duration === m} onClick={() => onChange({ duration: item.duration === m ? 0 : m })}>{m} min</Pill>)}
          <Input type="number" inputMode="numeric" min={0} max={120} aria-label="Other length in minutes" placeholder="Other"
            value={custom ? item.duration : ''} onChange={e => onChange({ duration: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
            className="h-9 w-[84px]" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Note</Label>
        <button type="button" onClick={onOpenNote}
          className="flex min-h-[88px] cursor-pointer flex-col items-start rounded-control border border-input bg-transparent px-3 py-2.5 text-left font-sans text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {item.note ? <Markdown text={item.note} className="line-clamp-4 text-[15px] leading-5" /> : <span className="text-muted-foreground">Add a note: what happens, who speaks, what the band plays under it</span>}
        </button>
        <span className="text-right text-[12px] text-muted-foreground">{(item.note || '').length} / {NOTE_MAX}</span>
      </div>
    </div>
  );
}

/** Full-screen note editor with a small markdown toolbar and a preview. */
function NoteEditor({ open, title, value, onDone, onCancel }) {
  const [text, setText] = useState(value || '');
  const [preview, setPreview] = useState(false);
  const [el, setEl] = useState(null);
  if (!open) return null;
  const wrap = (before, after = before) => {
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const next = (text.slice(0, a) + before + text.slice(a, b) + after + text.slice(b)).slice(0, NOTE_MAX);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, b + before.length); });
  };
  const line = (prefix) => {
    if (!el) return;
    const a = el.selectionStart;
    const start = text.lastIndexOf('\n', a - 1) + 1;
    const cur = text.slice(start).match(/^(#{1,2} |- )?/)[0];
    const next = (text.slice(0, start) + (cur === prefix ? '' : prefix) + text.slice(start + cur.length)).slice(0, NOTE_MAX);
    setText(next);
    requestAnimationFrame(() => el.focus());
  };
  const tools = [['H1', () => line('# ')], ['H2', () => line('## ')], ['B', () => wrap('**')], ['I', () => wrap('*')], ['• List', () => line('- ')]];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Note · ${title}`} className="fixed inset-0 z-[70] flex flex-col bg-background font-sans text-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <b className="truncate text-[16px]">{title}</b>
        <Button onClick={() => onDone(text)}>Done</Button>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
        {!preview && tools.map(([l, fn]) => (
          <button key={l} type="button" onMouseDown={e => e.preventDefault()} onClick={fn}
            className={cn('flex h-9 min-h-0 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-control border border-border bg-transparent px-2.5 font-sans text-[14px] text-foreground', l === 'B' && 'font-bold', l === 'I' && 'italic')}>{l}</button>
        ))}
        <span className="flex-1" />
        <Pill on={preview} onClick={() => setPreview(p => !p)}>{preview ? 'Edit' : 'Preview'}</Pill>
      </div>
      <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col px-4 py-3">
        {preview
          ? <Markdown text={text} className="overflow-y-auto text-[16px] leading-6" />
          : <textarea ref={setEl} autoFocus value={text} maxLength={NOTE_MAX} onChange={e => setText(e.target.value)}
              placeholder={'# Offering\nPastor Dan prays.\n- Keys pad in D\n- **Straight into** Living Hope'}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent font-sans text-[16px] leading-6 text-foreground outline-none placeholder:text-muted-foreground" />}
        <span className="pt-2 text-right text-[12px] text-muted-foreground">{text.length} / {NOTE_MAX}</span>
      </div>
    </div>,
    document.body,
  );
}

function AddSong({ open, onOpenChange, songs, setlist, setlists, at, onAdd }) {
  const [q, setQ] = useState('');
  const inSet = new Set((setlist.items || []).map(i => i?.songId));
  const suggested = useMemo(() => (open ? suggestSongs({ songs, setlist, setlists, at }) : []), [open, songs, setlist, setlists, at]);
  const list = q.trim() ? searchSongs(songs, q, { limit: 40 }) : [...songs].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  const row = (s, why) => {
    const v = resolveSongView(s);
    const added = inSet.has(s.id);
    return (
      <div key={s.id + (why ? '-s' : '')} className="flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{s.title}</span>
          <span className="truncate text-[13px] text-muted-foreground">{why ? <span className="text-warning-text">{why}</span> : [s.artist, added && 'Already in this setlist'].filter(Boolean).join(' · ')}</span>
        </span>
        {v?.key && <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-[13px] font-semibold text-[var(--chord)]">{v.key}</span>}
        <Button size="sm" variant={added ? 'ghost' : 'outline'} disabled={added} onClick={() => onAdd(s)}>{added ? 'Added' : <><PlusIcon size={16} />Add</>}</Button>
      </div>
    );
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a song" className="sm:max-w-[520px]">
      <div className="flex flex-col gap-3">
        <Input type="search" inputMode="search" placeholder="Search your songs" value={q} onChange={e => setQ(e.target.value)} />
        {!q.trim() && suggested.length > 0 && (
          <>
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Suggested</span>
            <div className="rounded-card border border-border bg-card px-4">{suggested.map(x => row(x.song, x.why))}</div>
            <span className="pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">All songs</span>
          </>
        )}
        <div className="rounded-card border border-border bg-card px-4">
          {list.length ? list.map(s => row(s)) : <p className="m-0 py-6 text-center text-[14px] text-muted-foreground">No song matches “{q}”.</p>}
        </div>
      </div>
    </Sheet>
  );
}

function DetailsSheet({ open, onOpenChange, draft, onChange }) {
  const f = (k, label, type = 'text', props = {}) => (
    <label className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input type={type} value={draft[k] || ''} onChange={e => onChange({ [k]: e.target.value })} {...props} />
    </label>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Name, date and time" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <div className="flex flex-col gap-4">
        {f('name', 'Name', 'text', { maxLength: 80, placeholder: 'Sunday Morning' })}
        <div className="grid grid-cols-2 gap-3">{f('date', 'Date', 'date')}{f('time', 'Time', 'time')}</div>
        {f('location', 'Place', 'text', { maxLength: 80, placeholder: 'Main hall' })}
        <div className="grid grid-cols-2 gap-3">{f('rehearsalDate', 'Rehearsal date', 'date')}{f('rehearsalTime', 'Rehearsal time', 'time')}</div>
        <Button className="mt-1" onClick={() => onOpenChange(false)}>Done</Button>
      </div>
    </Sheet>
  );
}

/**
 * @param {object} setlist         the saved setlist; this page edits a copy
 * @param {Array<{id,name}>} people who can lead (the band, else everyone)
 * @param {(setlist) => void} onSave
 */
export default function SetlistEdit({ setlist, songs = [], setlists = [], people = [], nameOf = () => '', onSave, onCancel, onDirtyChange, embedded = false, initialPicked = null }) {
  const [draft, setDraft] = useState(() => ({ ...setlist, items: (setlist.items || []).map(it => ({ ...it })) }));
  const [picked, setPicked] = useState(initialPicked);     // index whose sheet is open (phone) / panel (desktop)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteFor, setNoteFor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [details, setDetails] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(setlist);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const items = draft.items;
  const order = buildOrder(draft, songs, nameOf);
  const setItems = (fn) => setDraft(d => ({ ...d, items: fn(d.items) }));
  const patchItem = (i, patch) => setItems(xs => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (from, to) => {
    setItems(xs => moveItem(xs, from, to));
    setPicked(p => (p === from ? to : p));
  };
  const remove = (i) => { setItems(xs => xs.filter((_, j) => j !== i)); setPicked(null); setSheetOpen(false); };
  const addMoment = () => {
    setItems(xs => [...xs, { type: 'break', label: '', note: '', duration: 0 }]);
    setPicked(items.length); setSheetOpen(true);
  };
  const addSong = (s) => {
    const arr = getArrangement(s);
    setItems(xs => [...xs, { songId: s.id, songTitle: s.title, arrangementId: arr?.id, arrangementName: arr?.name || 'Main Arrangement', note: '', transpose: 0, capo: 0 }]);
  };
  const open = (i) => { setPicked(i); setSheetOpen(true); };
  // The note editor covers the screen, so the moment's sheet steps aside and comes back after.
  const closeNote = () => { setNoteFor(null); if (!isWide()) setSheetOpen(true); };
  const { listRef, gripProps, rowStyle } = useDragReorder(move);

  const pickedItem = picked != null ? items[picked] : null;
  const pickedSong = pickedItem?.songId ? resolveSongView(songs.find(s => s.id === pickedItem.songId), pickedItem.arrangementId) : null;
  const fields = pickedItem && (pickedItem.type === 'break'
    ? <MomentFields item={pickedItem} onChange={p => patchItem(picked, p)} onOpenNote={() => { setNoteFor(picked); setSheetOpen(false); }} />
    : <SongFields item={pickedItem} song={pickedSong} people={people} onChange={p => patchItem(picked, p)} />);
  const head = [draft.date && new Date(`${draft.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), draft.time, draft.location].filter(Boolean).join(' · ');

  return (
    <div data-slot="setlist-edit" className={cn('@container bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col px-4 pb-36 @min-[640px]:px-6 @min-[1024px]:grid @min-[1024px]:grid-cols-[minmax(0,1fr)_380px] @min-[1024px]:gap-x-8 @min-[1024px]:pb-12">
        <div className="sticky top-0 z-10 -mx-4 mb-3 flex h-14 @min-[1024px]:col-span-2 items-center justify-between bg-background px-4 @min-[640px]:-mx-6 @min-[640px]:px-6" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
          <Button variant="ghost" className="-ml-3" onClick={onCancel}>Cancel</Button>
          <b className="text-[17px] font-semibold">Edit setlist</b>
          <Button disabled={!dirty} onClick={() => { onDirtyChange?.(false); onSave?.(draft); }}>Done</Button>
        </div>
        <div className="flex min-w-0 flex-col gap-3">

          <button type="button" onClick={() => setDetails(true)}
            className="flex cursor-pointer items-center gap-3 rounded-card border-0 bg-raised px-4 py-3 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="truncate text-[15px] font-semibold">{draft.name || 'Untitled setlist'}</b>
              <span className="truncate text-[13px] text-muted-foreground">{head || 'No date yet'}</span>
            </span>
            <span className="text-[14px] font-medium text-link">Change</span>
          </button>

          <span className="pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Order · drag ⠿ or tap a row</span>
          <div ref={listRef} className="flex flex-col @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:px-3">
            {order.rows.map((r, i) => (
              <div key={i} data-drag-row style={rowStyle(i)}
                className={cn('flex min-h-[58px] items-center gap-1.5 border-t border-border bg-background first:border-t-0 @min-[1024px]:bg-card', picked === i && '@min-[1024px]:bg-selected')}>
                <Grip {...gripProps(i)} />
                <button type="button" onClick={() => open(i)}
                  className="flex min-h-[58px] min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-2 text-left font-sans text-foreground outline-none focus-visible:bg-raised">
                  <span className="w-4 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{r.n || ''}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('truncate text-[15px]', r.kind === 'moment' ? 'font-medium text-muted-foreground' : 'font-semibold')}>{r.kind === 'moment' && !items[i].label ? 'New moment' : r.title}</span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      {r.kind === 'moment' ? ['Moment', r.minutes ? `${r.minutes} min` : ''].filter(Boolean).join(' · ') : [r.leads && `${r.leads} leads`, r.time].filter(Boolean).join(' · ') || ' '}
                    </span>
                  </span>
                  {r.key && <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-[13px] font-semibold text-[var(--chord)]">{r.key}</span>}
                  <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"><MoreIcon /></span>
                </button>
              </div>
            ))}
            {!order.rows.length && <p className="m-0 py-8 text-center text-[14px] text-muted-foreground">Nothing here yet. Add a song or a moment.</p>}
          </div>
          <div className="hidden gap-2 @min-[1024px]:flex">
            <Button variant="outline" onClick={() => setAdding(true)}><PlusIcon size={16} />Add song</Button>
            <Button variant="outline" onClick={addMoment}><PlusIcon size={16} />Add moment</Button>
          </div>
        </div>

        <aside className="hidden @min-[1024px]:flex @min-[1024px]:flex-col @min-[1024px]:gap-3 @min-[1024px]:self-start @min-[1024px]:rounded-card @min-[1024px]:border @min-[1024px]:border-border @min-[1024px]:bg-card @min-[1024px]:p-5">
          {pickedItem ? (
            <>
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{pickedItem.type === 'break' ? 'Moment' : pickedSong?.title || 'Song'}</span>
              {fields}
              <MoveButtons index={picked} count={items.length} onMove={move} onRemove={remove} />
            </>
          ) : <span className="text-[14px] text-muted-foreground">Pick a row to set its key, who leads it and a note.</span>}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-background px-4 pt-3 @min-[1024px]:hidden" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <Button variant="outline" className="h-12 flex-1" onClick={() => setAdding(true)}><PlusIcon size={16} />Add song</Button>
        <Button variant="outline" className="h-12 flex-1" onClick={addMoment}><PlusIcon size={16} />Add moment</Button>
      </div>

      <Sheet open={sheetOpen && !!pickedItem && !isWide()} onOpenChange={setSheetOpen}
        title={pickedItem?.type === 'break' ? 'Moment' : pickedSong?.title || 'Song'} className="h-auto max-h-[92dvh]">
        {pickedItem && (
          <div className="flex flex-col gap-4">
            {fields}
            <MoveButtons index={picked} count={items.length} onMove={move} onRemove={remove} />
          </div>
        )}
      </Sheet>
      <AddSong open={adding} onOpenChange={setAdding} songs={songs} setlist={draft} setlists={setlists} at={items.length} onAdd={addSong} />
      <DetailsSheet open={details} onOpenChange={setDetails} draft={draft} onChange={p => setDraft(d => ({ ...d, ...p }))} />
      {noteFor != null && (
        <NoteEditor open key={noteFor} title={items[noteFor]?.label || 'Moment'} value={items[noteFor]?.note}
          onCancel={closeNote} onDone={(text) => { patchItem(noteFor, { note: text }); closeNote(); }} />
      )}
    </div>
  );
}

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
