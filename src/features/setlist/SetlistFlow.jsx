import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { PlusIcon, MoreIcon } from '@/app/navIcons';
import { transposeKey, transposeChord } from '@/music';
import { parseLine } from '@/parser';
import { resolveSongView, getArrangement } from '@/arrangements';
import { searchSongs } from '@/lib/search';
import { suggestSongs } from '@/lib/suggestSongs';
import { buildOrder } from '@/lib/setlistView';
import {
  templatesOf, serviceTemplates, templateTitle, draftFromTemplate, autoName, nextDates, takenDates, shiftDate,
  isPlaceholder, placeholderItem, lastPlayed, blankTemplate, dayLabel as longDay, shortDayLabel as shortDay,
} from '@/lib/newSetlist';
import { useDragReorder, moveItem } from './useDragReorder';
import { MomentFields, NoteEditor, MoveButtons, Grip, Label, NOTE_MAX } from './SetlistEdit';
import { Chip, DateSheet, TimeSheet } from './WhenPickers';
import { TemplateEditor, TemplatesSheet } from './TemplateEditor';
import BandSection from './BandSection';

// New setlist, step by step (canvas → New setlist): Service → Band → Songs →
// Who leads. The same screens edit a setlist later, with the steps as tabs.
// A copy is edited here and saved on Save, so nothing reaches the band
// half-made; a new setlist's band picks travel with it as `plannedBand` and
// the setlist page sends those asks once it is saved.

const STEPS = [['service', 'Service'], ['band', 'Band'], ['songs', 'Songs'], ['leads', 'Who leads']];
const TIMES = ['4/4', '3/4', '6/8', '2/4'];

const WIDE = '(min-width: 1024px)';
const sub = (cb) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };
const useWide = () => useSyncExternalStore(sub, () => window.matchMedia(WIDE).matches, () => false);

const Caps = ({ children, right, className }) => (
  <div className={cn('flex items-center justify-between', className)}>
    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</span>
    {right}
  </div>
);
const Field = ({ label, children }) => (
  <div className="flex min-h-[52px] items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
    <span className="w-[56px] shrink-0 text-[14px] text-muted-foreground">{label}</span>
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">{children}</div>
  </div>
);
const Switch = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={cn('relative h-[26px] w-11 min-h-0 shrink-0 cursor-pointer rounded-full border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-link' : 'bg-raised')}>
    <span className={cn('absolute top-[3px] size-5 rounded-full bg-background transition-[left]', on ? 'left-[21px]' : 'left-[3px]')} />
  </button>
);
const KeyChip = ({ k }) => (k ? <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md bg-raised px-1.5 font-mono text-[13px] font-semibold text-[var(--chord)]">{k}</span> : null);

const lastLine = (lp, song, nameOf) => {
  if (!lp) return 'Never played';
  const v = resolveSongView(song, lp.arrangementId) || resolveSongView(song);
  const bits = [v?.key && transposeKey(v.key, lp.transpose), `${lp.tempo ?? v?.tempo ?? '?'} BPM`, lp.time || v?.time].filter(Boolean).join(' · ');
  return { date: longDay(lp.date), bits, who: lp.leadBy ? nameOf(lp.leadBy) : '' };
};

/* ── Step 1 · Service ─────────────────────────────────────────────────────── */

function ServiceStep({ wide, draft, setDraft, isNew, templates, template, onPickTemplate, onEditTemplates, setlists, nameTouched, setNameTouched }) {
  const [sheet, setSheet] = useState(null);   // 'date' | 'time' | 'rDate' | 'rTime'
  const weekday = Number.isInteger(template?.weekday) ? template.weekday : (draft.date ? new Date(`${draft.date}T12:00:00`).getDay() : 0);
  const dates = useMemo(() => {
    const n = wide ? 3 : 2;
    const xs = nextDates(weekday, template ? takenDates(template, setlists.filter(s => s.id !== draft.id)) : new Set(), n);
    return draft.date && !xs.includes(draft.date) ? [draft.date, ...xs.slice(0, n - 1)] : xs;
  }, [wide, weekday, template, setlists, draft.id, draft.date]);
  const times = [...new Set([template?.time, draft.time].filter(Boolean))];
  const rehearsal = !!(draft.rehearsalDate || draft.rehearsalTime);
  const rDates = draft.date ? [shiftDate(draft.date, -1), shiftDate(draft.date, -2), draft.date].slice(0, wide ? 3 : 2) : [];
  if (draft.rehearsalDate && !rDates.includes(draft.rehearsalDate)) rDates.unshift(draft.rehearsalDate);
  const rTimes = [...new Set([template?.rehearsalTime, draft.rehearsalTime, '18:00'].filter(Boolean))].slice(0, 2);

  const setDate = (date) => setDraft(d => {
    const gap = d.date && d.rehearsalDate ? Math.round((new Date(`${d.date}T12:00:00`) - new Date(`${d.rehearsalDate}T12:00:00`)) / 86400000) : null;
    const next = { ...d, date };
    if (gap != null) next.rehearsalDate = shiftDate(date, -gap);
    if (!nameTouched && template) next.name = autoName(template, setlists, date, d.id);
    return next;
  });
  const setRehearsal = (on) => setDraft(d => (on
    ? { ...d, rehearsalDate: shiftDate(d.date, -(Number(template?.rehearsalOffset ?? 1) || 0)) || d.date, rehearsalTime: d.rehearsalTime || template?.rehearsalTime || '18:00', rehearsalLocation: d.rehearsalLocation || template?.rehearsalLocation || d.location || '' }
    : (({ rehearsalDate: _a, rehearsalTime: _b, rehearsalLocation: _c, ...rest }) => rest)(d)));

  return (
    <div className="flex flex-col gap-3">
      {isNew && (
        <>
          <Caps>Service</Caps>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => <Chip key={t.id} on={template?.id === t.id} onClick={() => onPickTemplate(t)}>{templateTitle(t)}</Chip>)}
            <Chip dashed={!!template} on={!template} onClick={() => onPickTemplate(null)}>Empty</Chip>
          </div>
          {onEditTemplates && <Button variant="link" className="self-start text-[14px]" onClick={onEditTemplates}>Edit templates</Button>}
        </>
      )}
      <div className="rounded-card border border-border bg-card">
        <Field label="Name">
          <Input value={draft.name || ''} maxLength={80} placeholder="Sunday Morning" aria-label="Setlist name"
            onChange={e => { setNameTouched(true); setDraft(d => ({ ...d, name: e.target.value })); }}
            className="h-10 font-mono font-semibold" />
        </Field>
        <Field label="Date">
          {dates.map(d => <Chip key={d} on={draft.date === d} className="h-8 px-3 text-[13px]" onClick={() => setDate(d)}>{shortDay(d)}</Chip>)}
          <Chip dashed className="h-8 px-3 text-[13px]" onClick={() => setSheet('date')}>Other…</Chip>
        </Field>
        <Field label="Time">
          {times.map(t => <Chip key={t} on={draft.time === t} className="h-8 px-3 text-[13px]" onClick={() => setDraft(d => ({ ...d, time: t }))}>{t}</Chip>)}
          <Chip dashed className="h-8 px-3 text-[13px]" onClick={() => setSheet('time')}>Other…</Chip>
        </Field>
        <Field label="Place">
          <Input value={draft.location || ''} maxLength={80} placeholder="Main hall" aria-label="Place" onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} className="h-10" />
        </Field>
      </div>

      <Caps className="pt-2" right={<Switch label="Rehearsal" on={rehearsal} onChange={setRehearsal} />}>Rehearsal</Caps>
      {rehearsal && (
        <div className="rounded-card border border-border bg-card">
          <Field label="Date">
            {rDates.map(d => <Chip key={d} on={draft.rehearsalDate === d} className="h-8 px-3 text-[13px]" onClick={() => setDraft(x => ({ ...x, rehearsalDate: d }))}>{shortDay(d)}</Chip>)}
            <Chip dashed className="h-8 px-3 text-[13px]" onClick={() => setSheet('rDate')}>Other…</Chip>
          </Field>
          <Field label="Time">
            {rTimes.map(t => <Chip key={t} on={draft.rehearsalTime === t} className="h-8 px-3 text-[13px]" onClick={() => setDraft(d => ({ ...d, rehearsalTime: t }))}>{t}</Chip>)}
            <Chip dashed className="h-8 px-3 text-[13px]" onClick={() => setSheet('rTime')}>Other…</Chip>
          </Field>
          <Field label="Place">
            <Input value={draft.rehearsalLocation || ''} maxLength={80} placeholder={draft.location || 'Main hall'} aria-label="Rehearsal place" onChange={e => setDraft(d => ({ ...d, rehearsalLocation: e.target.value }))} className="h-10" />
          </Field>
        </div>
      )}
      {template && <p className="m-0 text-[12px] leading-[17px] text-muted-foreground">All of it comes from the “{templateTitle(template)}” template. A change here is for this setlist only.</p>}

      {(sheet === 'date' || sheet === 'rDate') && (
        <DateSheet key={sheet} open onOpenChange={o => { if (!o) setSheet(null); }} title={sheet === 'date' ? 'Service date' : 'Rehearsal date'}
          value={sheet === 'date' ? draft.date : draft.rehearsalDate} marked={sheet === 'date' ? weekday : null}
          onPick={(v) => { if (sheet === 'date') setDate(v); else setDraft(d => ({ ...d, rehearsalDate: v })); setSheet(null); }} />
      )}
      {(sheet === 'time' || sheet === 'rTime') && (
        <TimeSheet key={sheet} open onOpenChange={o => { if (!o) setSheet(null); }} title={sheet === 'time' ? 'Service time' : 'Rehearsal time'}
          value={sheet === 'time' ? draft.time : draft.rehearsalTime}
          onPick={(v) => { setDraft(d => ({ ...d, [sheet === 'time' ? 'time' : 'rehearsalTime']: v })); setSheet(null); }} />
      )}
    </div>
  );
}

/* ── Step 3 · Songs ───────────────────────────────────────────────────────── */

/** A song's chart, chords over words, for the desktop preview. */
function ChartPreview({ view, transpose = 0 }) {
  const sections = view?.sections || [];
  return (
    <div className="flex flex-col gap-4 text-[14px] leading-[1.35]">
      {sections.slice(0, 8).map((s, i) => (
        <div key={i} className="flex flex-col">
          <span className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-link">{s.type}</span>
          {(s.lines || []).filter(l => typeof l === 'string' && l.trim() && !l.startsWith('>')).slice(0, 8).map((l, j) => (
            <div key={j} className="flex flex-wrap items-end">
              {parseLine(l).map((p, k) => (
                <span key={k} className="inline-flex flex-col whitespace-pre">
                  <span className="h-4 pr-1 font-mono text-[12px] font-semibold text-[var(--chord)]">{p.chord ? transposeChord(p.chord, transpose) : ' '}</span>
                  <span>{p.text || ' '}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
      {!sections.length && <p className="m-0 text-muted-foreground">This song has no chart yet.</p>}
    </div>
  );
}

function PickList({ songs, draft, setlists, at, nameOf, onAdd, onPreview, previewId, onKeepSong, today }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('suggested');
  const inSet = new Set((draft.items || []).map(i => i?.songId).filter(Boolean));
  const suggested = useMemo(() => suggestSongs({ songs, setlist: draft, setlists, at, limit: 6 }), [songs, draft, setlists, at]);
  const sorted = useMemo(() => [...songs].sort((a, b) => (a.title || '').localeCompare(b.title || '')), [songs]);
  const last = (s) => lastPlayed(s.id, setlists, today, draft.id);
  let list;
  if (q.trim()) list = searchSongs(songs, q, { limit: 40 }).map(s => ({ song: s }));
  else if (tab === 'suggested' && suggested.length) { const ids = new Set(suggested.map(x => x.song.id)); list = [...suggested, ...sorted.filter(s => !ids.has(s.id)).map(s => ({ song: s }))]; }
  else if (tab === 'stale') list = sorted.map(s => ({ song: s, lp: last(s) })).sort((a, b) => (a.lp?.date || '').localeCompare(b.lp?.date || '')).slice(0, 40);
  else list = sorted.map(s => ({ song: s }));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Input type="search" inputMode="search" autoFocus={!onPreview} placeholder="Search the library" value={q} onChange={e => setQ(e.target.value)} className="h-11" />
      {!q.trim() && (
        <div className="flex gap-1.5 overflow-x-auto">
          {[['suggested', 'Suggested'], ['all', 'All'], ['stale', 'Not played lately']].map(([k, l]) => <Chip key={k} on={tab === k} className="h-8 px-3 text-[13px]" onClick={() => setTab(k)}>{l}</Chip>)}
        </div>
      )}
      <div className="rounded-card border border-border bg-card">
        {list.map(({ song: s, why, lp: lp0 }) => {
          const lp = lp0 !== undefined ? lp0 : last(s);
          const l = lastLine(lp, s, nameOf);
          const added = inSet.has(s.id);
          return (
            <div key={s.id} className={cn('flex min-h-14 items-center gap-2 border-t border-border px-3 py-2 first:border-t-0', previewId === s.id && 'bg-selected shadow-[inset_3px_0_0_var(--color-link)]')}>
              <button type="button" onClick={() => (onPreview ? onPreview(s.id) : onAdd(s))}
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none focus-visible:underline">
                <span className="truncate text-[15px] font-semibold">{s.title}</span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {typeof l === 'string' ? l : <>Last: {l.date} · <span className="text-foreground">{l.bits}</span></>}
                  {added && ' · in this setlist'}
                </span>
                {why && <span className="truncate text-[12px] text-link">{why}</span>}
              </button>
              <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" aria-label={`Add ${s.title}`} onClick={() => onAdd(s)}><PlusIcon size={18} /></Button>
            </div>
          );
        })}
        {!list.length && <p className="m-0 px-4 py-6 text-center text-[14px] text-muted-foreground">{q.trim() ? `No song matches “${q}”.` : 'No songs in the library yet.'}</p>}
      </div>
      <div className="rounded-card border border-border bg-card">
        <button type="button" onClick={() => onKeepSong(q.trim())}
          className="flex min-h-12 w-full cursor-pointer flex-col items-start justify-center gap-0.5 border-0 bg-transparent px-3 py-2 text-left font-sans text-foreground outline-none">
          <span className="text-[15px] font-semibold">Keep it as “{q.trim() || 'Song'}”</span>
          <span className="text-[12px] text-muted-foreground">Choose the song later; the band sees “to be chosen”</span>
        </button>
      </div>
    </div>
  );
}

/** Key, BPM, time, version and the note for one song in this setlist. */
function SongSettings({ item, song, setlists, draftId, nameOf, today, onChange }) {
  const view = resolveSongView(song, item.arrangementId);
  const arrs = song?.arrangements || [];
  const base = view?.key || '';
  const t = item.transpose || 0;
  const keys = base ? Array.from({ length: 12 }, (_, i) => i - 5).map(x => ({ t: x, key: transposeKey(base, x) })) : [];
  const tempo = item.tempo ?? view?.tempo ?? null;
  const time = item.time || view?.time || '';
  const lp = lastLine(lastPlayed(item.songId, setlists, today, draftId), song, nameOf);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-control bg-raised px-3 py-2.5 text-[13px] text-muted-foreground">
        {typeof lp === 'string' ? lp : <>Last time: {lp.date} · <span className="font-medium text-foreground">{lp.bits}</span>{lp.who && ` · led by ${lp.who}`}</>}
      </div>
      {keys.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Key</Label>
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
        <Label>BPM</Label>
        <div className="flex items-center gap-3">
          <div className="flex items-center overflow-hidden rounded-control border border-border">
            <Button variant="ghost" className="h-10 w-11 rounded-none" aria-label="Slower" onClick={() => onChange({ tempo: Math.max(30, (Number(tempo) || 100) - 1) })}>−</Button>
            <Input type="number" inputMode="numeric" aria-label="BPM" value={tempo ?? ''} placeholder="—"
              onChange={e => onChange({ tempo: e.target.value === '' ? undefined : Math.max(30, Math.min(260, Number(e.target.value) || 0)) })}
              className="h-10 w-[72px] rounded-none border-0 border-x border-border text-center font-semibold" />
            <Button variant="ghost" className="h-10 w-11 rounded-none" aria-label="Faster" onClick={() => onChange({ tempo: Math.min(260, (Number(tempo) || 100) + 1) })}>+</Button>
          </div>
          {view?.tempo ? <span className="text-[12px] text-muted-foreground">Usual {view.tempo}</span> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Time</Label>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([view?.time, ...TIMES].filter(Boolean))].map(x => <Chip key={x} on={time === x} className="h-8 px-3 text-[13px]" onClick={() => onChange({ time: x === view?.time ? undefined : x })}>{x}</Chip>)}
        </div>
      </div>
      {arrs.length > 1 && (
        <div className="flex flex-col gap-2">
          <Label>Version</Label>
          <div className="flex flex-wrap gap-1.5">
            {arrs.map(a => <Chip key={a.id} on={(item.arrangementId || getArrangement(song)?.id) === a.id} className="h-8 px-3 text-[13px]" onClick={() => onChange({ arrangementId: a.id, arrangementName: a.name })}>{a.name || 'Main'}</Chip>)}
          </div>
        </div>
      )}
      <label className="flex flex-col gap-2">
        <Label>Note for the band</Label>
        <Input value={item.note || ''} maxLength={NOTE_MAX} placeholder="e.g. Start soft, keys only" onChange={e => onChange({ note: e.target.value.slice(0, NOTE_MAX) })} />
      </label>
    </div>
  );
}

/* ── The flow ─────────────────────────────────────────────────────────────── */

/**
 * @param {object} setlist   a fresh draft (isNew) or the saved setlist
 * @param {(draft) => Array<{id,name}>} peopleOf  who can lead (the band, else everyone)
 */
export default function SetlistFlow({
  setlist, isNew = false, songs = [], setlists = [], peopleOf = () => [], nameOf = () => '',
  team = null, members = [], schedules = [], setlistMap = {}, createSchedule, deleteSchedule, ensureRow,
  onSave, onCancel, onDirtyChange, onSaveTemplate, onDeleteTemplate, initialStep,
}) {
  const wide = useWide();
  const saved = useMemo(() => templatesOf(setlists), [setlists]);
  const templates = useMemo(() => [...saved, ...serviceTemplates(setlists)], [saved, setlists]);
  const [draft, setDraft] = useState(() => ({ ...setlist, items: (setlist.items || []).map(it => ({ ...it })) }));
  const [step, setStep] = useState(initialStep || (isNew ? 'service' : 'songs'));
  const [nameTouched, setNameTouched] = useState(!isNew);
  const [bandExtra, setBandExtra] = useState([]);
  const [pickAt, setPickAt] = useState(null);          // { index, replace } — the song picker
  const [previewId, setPreviewId] = useState(null);
  const [picked, setPicked] = useState(null);          // order index whose settings are open
  const [noteFor, setNoteFor] = useState(null);
  const [tplList, setTplList] = useState(false);
  const [tplEdit, setTplEdit] = useState(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const template = templates.find(t => t.id === draft.templateId) || null;

  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(setlist);
  useEffect(() => { onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(setlist)); }, [draft, setlist, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // A new setlist starts from the first template, if the church has one.
  useEffect(() => {
    if (isNew && !draft.templateId && templates.length && !(draft.items || []).length && !draft.name) pickTemplate(templates[0], setlist.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickTemplate(tpl, onDate = '') {
    setDraft(d => {
      const fresh = draftFromTemplate(tpl, setlists);
      if (onDate && fresh.date !== onDate) {
        if (fresh.rehearsalDate) fresh.rehearsalDate = shiftDate(onDate, Math.round((new Date(`${fresh.rehearsalDate}T12:00:00`) - new Date(`${fresh.date}T12:00:00`)) / 86400000));
        fresh.date = onDate;
        if (tpl) fresh.name = autoName(tpl, setlists, onDate, d.id);
      }
      const keepSongs = (d.items || []).some(it => it.songId);
      return { ...fresh, id: d.id, items: keepSongs ? d.items : fresh.items, ...(d.plannedBand ? { plannedBand: d.plannedBand } : {}) };
    });
    setNameTouched(false);
    setBandExtra([]);
  }

  const people = peopleOf(draft);
  const items = draft.items || [];
  const order = buildOrder(draft, songs, nameOf);
  const setItems = (fn) => setDraft(d => ({ ...d, items: fn(d.items || []) }));
  const patchItem = (i, patch) => setItems(xs => xs.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, ...patch };
    Object.keys(patch).forEach(k => { if (patch[k] === undefined) delete n[k]; });
    return n;
  }));
  const move = (from, to) => { setItems(xs => moveItem(xs, from, to)); setPicked(p => (p === from ? to : p)); };
  const remove = (i) => { setItems(xs => xs.filter((_, j) => j !== i)); setPicked(null); };
  const { listRef, gripProps, rowStyle } = useDragReorder(move);

  const songItem = (s) => {
    const arr = getArrangement(s);
    return { songId: s.id, songTitle: s.title, arrangementId: arr?.id, arrangementName: arr?.name || 'Main Arrangement', note: '', transpose: 0, capo: 0 };
  };
  // The slot being filled: an empty "Song", a song being changed, or the end.
  const target = pickAt ?? (wide ? { index: items.findIndex(isPlaceholder), replace: true } : null);
  const addSong = (s) => {
    const t = target && target.index >= 0 ? target : null;
    if (t?.replace) setItems(xs => xs.map((x, j) => (j === t.index ? { ...songItem(s), ...(x.note ? { note: x.note } : {}) } : x)));
    else setItems(xs => [...xs, songItem(s)]);
    setPickAt(null);
    setPreviewId(null);
  };
  const keepSong = (label) => {
    const t = target && target.index >= 0 ? target : null;
    if (t?.replace) setItems(xs => xs.map((x, j) => (j === t.index ? placeholderItem(label) : x)));
    else setItems(xs => [...xs, placeholderItem(label)]);
    setPickAt(null);
  };
  const addMoment = () => { setItems(xs => [...xs, { type: 'break', label: '', note: '', duration: 0 }]); setPicked(items.length); };
  const openRow = (i) => {
    const it = items[i];
    if (isPlaceholder(it)) { setPickAt({ index: i, replace: true }); setPicked(null); return; }
    setPicked(i);
  };

  const pickedItem = picked != null ? items[picked] : null;
  const pickedSong = pickedItem?.songId ? songs.find(s => s.id === pickedItem.songId) : null;
  const previewSong = previewId ? songs.find(s => s.id === previewId) : null;
  const idx = STEPS.findIndex(([k]) => k === step);
  const nextStep = STEPS[idx + 1];
  const save = () => { onDirtyChange?.(false); onSave?.(draft); };
  const canSave = !!(draft.name || '').trim() || !!draft.date;

  const saveTemplate = (tpl) => { onSaveTemplate?.(tpl); setTplEdit(null); };

  /* ── Pieces ─────────────────────────────────────────────────────────── */
  const orderList = (
    <div ref={listRef} className="flex flex-col rounded-card border border-border bg-card px-1.5 py-1">
      {order.rows.map((r, i) => {
        const it = items[i];
        const slot = isPlaceholder(it);
        const filling = slot && target?.replace && target.index === i && (wide || pickAt);
        return (
          <div key={i} data-drag-row style={rowStyle(i)}
            className={cn('flex min-h-[54px] items-center gap-1 bg-card', slot ? 'my-1 rounded-control border border-dashed border-input' : 'border-t border-border first:border-t-0',
              (picked === i || filling) && 'rounded-control bg-selected shadow-[inset_3px_0_0_var(--color-link)]', filling && 'border-link')}>
            <Grip {...gripProps(i)} />
            <button type="button" onClick={() => openRow(i)}
              className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-1.5 pr-2 text-left font-sans text-foreground outline-none focus-visible:underline">
              {r.kind === 'song' && <span className="w-4 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{r.n}</span>}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('truncate text-[15px]', r.kind === 'moment' ? 'font-medium text-muted-foreground' : 'font-semibold')}>
                  {r.kind === 'moment' && !it.label ? 'New moment' : r.title}
                </span>
                {!slot && r.kind === 'song' && <span className="truncate text-[12px] text-muted-foreground">{[r.tempo && `${r.tempo} BPM`, r.time, r.leads && `${r.leads} leads`].filter(Boolean).join(' · ') || ' '}</span>}
              </span>
              {r.kind === 'moment' && r.minutes > 0 && <span className="text-[12px] text-muted-foreground">{r.minutes} min</span>}
              {slot && <span className="text-[13px] font-medium text-link">{filling ? 'choosing…' : 'Choose'}</span>}
              <KeyChip k={r.key} />
              {!slot && <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"><MoreIcon size={18} /></span>}
            </button>
          </div>
        );
      })}
      {!order.rows.length && <p className="m-0 py-8 text-center text-[14px] text-muted-foreground">Nothing here yet. Add a song or a moment.</p>}
    </div>
  );
  const orderAdds = (
    <div className="flex flex-wrap gap-2">
      <Chip onClick={() => setPickAt({ index: -1, replace: false })}><PlusIcon size={16} />Song</Chip>
      <Chip onClick={addMoment}><PlusIcon size={16} />Moment</Chip>
      <Chip dashed onClick={() => setItems(xs => [...xs, placeholderItem()])}><PlusIcon size={16} />“Song”</Chip>
    </div>
  );
  const pickedFields = pickedItem && (pickedItem.type === 'break'
    ? <MomentFields item={pickedItem} onChange={p => patchItem(picked, p)} onOpenNote={() => setNoteFor(picked)} />
    : <SongSettings item={pickedItem} song={pickedSong} setlists={setlists} draftId={draft.id} nameOf={nameOf} today={today} onChange={p => patchItem(picked, p)} />);
  const pickedActions = pickedItem && (
    <div className="flex flex-col gap-2">
      {pickedItem.songId && <Button variant="outline" onClick={() => { setPickAt({ index: picked, replace: true }); setPicked(null); }}>Change song</Button>}
      <MoveButtons index={picked} count={items.length} onMove={move} onRemove={remove} />
    </div>
  );

  const leadsStep = (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[24px] font-semibold leading-[30px] tracking-[-0.5px]">Who leads each song?</h2>
      <p className="m-0 -mt-1 text-[14px] text-muted-foreground">{people.length ? 'People from the band, else everyone in the church.' : 'Add people to the band first.'}</p>
      <div className="rounded-card border border-border bg-card">
        {order.rows.filter(r => r.kind === 'song').map(r => {
          const it = items[r.idx];
          const lp = it.songId ? lastPlayed(it.songId, setlists, today, draft.id) : null;
          return (
            <div key={r.idx} className={cn('flex flex-col gap-2 border-t border-border px-4 py-3 first:border-t-0', r.placeholder && 'opacity-60')}>
              <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-[15px] font-semibold">{r.title}</b>
                  <span className="truncate text-[12px] text-muted-foreground">{r.placeholder ? 'To be chosen' : [r.key, r.tempo && `${r.tempo} BPM`, lp?.leadBy && `${nameOf(lp.leadBy)} led it last time`].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
              {!r.placeholder && (
                <div className="flex flex-wrap gap-1.5">
                  {people.map(p => <Chip key={p.id} on={it.leadBy === p.id} className="h-8 px-3 text-[13px]" onClick={() => patchItem(r.idx, { leadBy: it.leadBy === p.id ? undefined : p.id })}>{p.name}</Chip>)}
                </div>
              )}
            </div>
          );
        })}
        {!order.songCount && <p className="m-0 px-4 py-6 text-center text-[14px] text-muted-foreground">No songs yet.</p>}
      </div>
    </div>
  );

  const bandStep = (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[24px] font-semibold leading-[30px] tracking-[-0.5px]">Who’s playing?</h2>
      <p className="m-0 -mt-1 text-[14px] text-muted-foreground">{[longDay(draft.date), draft.time].filter(Boolean).join(' · ')}{template?.parts?.length ? '. Parts come from the template.' : ''}</p>
      {team ? (
        <div className="rounded-card border border-border bg-card px-4">
          <BandSection
            key={isNew ? 'plan' : 'live'}
            setlist={draft} setlists={setlists} schedules={schedules} setlistMap={setlistMap}
            team={team} members={members} nameOf={nameOf}
            createSchedule={createSchedule} deleteSchedule={deleteSchedule} ensureRow={ensureRow}
            planOnly={isNew} needed={template?.parts?.length ? template.parts : null} initialExtra={bandExtra}
            onPlanChange={(adds, extra) => { setBandExtra(extra); setDraft(d => (JSON.stringify(d.plannedBand || []) === JSON.stringify(adds) ? d : { ...d, plannedBand: adds })); }}
          />
        </div>
      ) : (
        <p className="m-0 rounded-card bg-raised px-4 py-3 text-[14px] text-muted-foreground">The band is picked in a church space. Skip this step.</p>
      )}
    </div>
  );

  const songsPhone = (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[24px] font-semibold leading-[30px] tracking-[-0.5px]">Order</h2>
      <p className="m-0 -mt-1 text-[14px] text-muted-foreground">{items.some(isPlaceholder) ? 'Tap a “Song” to choose it.' : 'Drag ⠿ to reorder, tap a row to change it.'}</p>
      {orderList}
      {orderAdds}
    </div>
  );

  const songsDesk = (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(320px,400px)] gap-0 border-t border-border">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-border p-4">
        {orderList}
        {orderAdds}
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto border-r border-border p-4">
        <PickList songs={songs} draft={draft} setlists={setlists} at={target?.index >= 0 ? target.index : items.length} nameOf={nameOf}
          onAdd={addSong} onPreview={(id) => { setPreviewId(id); setPicked(null); }} previewId={previewId} onKeepSong={keepSong} today={today} />
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto">
        {pickedItem ? (
          <div className="flex flex-col gap-4 p-5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{pickedItem.type === 'break' ? 'Moment' : pickedSong?.title || 'Song'}</span>
            {pickedFields}
            {pickedActions}
          </div>
        ) : previewSong ? (
          <DeskPreview song={previewSong} onAdd={() => addSong(previewSong)} slot={target?.replace && target.index >= 0 ? order.rows[target.index]?.n : null} setlists={setlists} draftId={draft.id} nameOf={nameOf} today={today} />
        ) : (
          <p className="m-0 p-5 text-[14px] text-muted-foreground">Click a song in the library to see its chart, or a row in the order to set its key, BPM and time.</p>
        )}
      </div>
    </div>
  );

  /* ── Frame ──────────────────────────────────────────────────────────── */
  const body = step === 'service'
    ? <ServiceStep wide={wide} draft={draft} setDraft={setDraft} isNew={isNew} templates={templates} template={template} onPickTemplate={pickTemplate}
        onEditTemplates={onSaveTemplate ? () => setTplList(true) : null} setlists={setlists} nameTouched={nameTouched} setNameTouched={setNameTouched} />
    : step === 'band' ? bandStep : step === 'leads' ? leadsStep : songsPhone;
  const deskSongs = wide && step === 'songs';

  return (
    <div data-slot="setlist-flow" className={cn('flex flex-col bg-background font-sans text-foreground', deskSongs ? 'h-full min-h-[calc(100dvh-64px)]' : 'min-h-full')}>
      <div className="sticky top-0 z-10 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex h-14 items-center gap-3 px-4 @container">
          <Button variant="ghost" className="-ml-3" onClick={onCancel}>Cancel</Button>
          {!wide && <b className="flex-1 text-center text-[16px] font-semibold">{isNew ? 'New setlist' : 'Edit setlist'}</b>}
          {wide && (
            <>
              <b className="text-[16px] font-semibold">{isNew ? 'New setlist' : 'Edit setlist'}</b>
              <nav aria-label="Steps" className="ml-6 flex gap-1">
                {STEPS.map(([k, l], i) => (
                  <button key={k} type="button" onClick={() => setStep(k)} aria-current={step === k ? 'step' : undefined}
                    className={cn('flex h-8 min-h-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 font-sans text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      step === k ? 'bg-selected font-semibold text-foreground' : i < idx ? 'bg-transparent text-link' : 'bg-transparent text-muted-foreground')}>
                    {i < idx ? '✓' : i + 1} {l}
                  </button>
                ))}
              </nav>
              <span className="flex-1" />
              <Button variant="outline" disabled={!canSave || (!dirty && !isNew)} onClick={save}>{isNew ? 'Save draft' : 'Save'}</Button>
              {nextStep ? <Button onClick={() => setStep(nextStep[0])}>Next: {nextStep[1]}</Button> : <Button disabled={!canSave} onClick={save}>Save setlist</Button>}
            </>
          )}
          {!wide && (
            step === 'band' && isNew
              ? <Button variant="ghost" className="-mr-3 text-link" onClick={() => setStep('songs')}>Skip</Button>
              : <Button variant="ghost" className="-mr-3 text-link" disabled={!canSave || (!dirty && !isNew)} onClick={save}>{isNew ? 'Save draft' : 'Save'}</Button>
          )}
        </div>
        {!wide && (
          <div className="flex flex-col gap-1.5 px-4 pb-2">
            <div className="flex gap-1.5">
              {STEPS.map(([k, l], i) => (
                <button key={k} type="button" aria-label={l} onClick={() => setStep(k)}
                  className={cn('h-1.5 min-h-0 flex-1 cursor-pointer rounded-full border-0 p-0', i <= idx ? 'bg-link' : 'bg-raised')} />
              ))}
            </div>
            <div className="flex justify-between text-[12px] text-muted-foreground">
              <span>Step {idx + 1} of 4 · <b className="font-semibold text-foreground">{STEPS[idx][1]}</b></span>
              <span className="truncate pl-3 font-mono">{draft.name}</span>
            </div>
          </div>
        )}
      </div>

      {deskSongs ? songsDesk : (
        <div className="mx-auto w-full max-w-[600px] px-4 pb-36 pt-2 lg:pb-16">{body}</div>
      )}

      {!wide && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
          {idx > 0 && <Button variant="outline" className="h-12" onClick={() => setStep(STEPS[idx - 1][0])}>Back</Button>}
          {nextStep
            ? <Button className="h-12 flex-1" onClick={() => setStep(nextStep[0])}>Next: {nextStep[1]}</Button>
            : <Button className="h-12 flex-1" disabled={!canSave} onClick={save}>{isNew && draft.plannedBand?.length ? 'Save and ask band' : 'Save setlist'}</Button>}
        </div>
      )}

      {/* Phone: the song picker covers the screen, one song at a time. */}
      {!wide && pickAt && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Choose a song" className="fixed inset-0 z-[70] flex flex-col bg-background font-sans text-foreground">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
            <Button variant="ghost" className="-ml-3" onClick={() => setPickAt(null)}>‹ Order</Button>
            <b className="flex-1 text-center text-[16px] font-semibold">{pickAt.replace && pickAt.index >= 0 ? `Choose song ${order.rows[pickAt.index]?.n || ''}` : 'Add a song'}</b>
            <span className="w-[60px]" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
            <PickList songs={songs} draft={draft} setlists={setlists} at={pickAt.index >= 0 ? pickAt.index : items.length} nameOf={nameOf} onAdd={addSong} onKeepSong={keepSong} today={today} />
          </div>
        </div>,
        document.body,
      )}

      <Sheet open={!wide && !!pickedItem && noteFor == null} onOpenChange={(o) => { if (!o) setPicked(null); }}
        title={pickedItem?.type === 'break' ? 'Moment' : pickedSong?.title || 'Song'} className="h-auto max-h-[92dvh]">
        {pickedItem && <div className="flex flex-col gap-4">{pickedFields}{pickedActions}</div>}
      </Sheet>
      {noteFor != null && (
        <NoteEditor open key={noteFor} title={items[noteFor]?.label || 'Moment'} value={items[noteFor]?.note}
          onCancel={() => setNoteFor(null)} onDone={(text) => { patchItem(noteFor, { note: text }); setNoteFor(null); }} />
      )}
      <TemplatesSheet open={tplList} onOpenChange={setTplList} templates={saved}
        onEdit={(t) => { setTplList(false); setTplEdit(t); }} onNew={() => { setTplList(false); setTplEdit(blankTemplate()); }} />
      {tplEdit && (
        <TemplateEditor template={tplEdit} setlists={setlists} onCancel={() => setTplEdit(null)} onSave={saveTemplate}
          onDelete={saved.some(t => t.id === tplEdit.id) && onDeleteTemplate ? () => { onDeleteTemplate(tplEdit.id); setTplEdit(null); } : null} />
      )}
    </div>
  );
}

function DeskPreview({ song, onAdd, slot, setlists, draftId, nameOf, today }) {
  const [arrId, setArrId] = useState(null);
  const view = resolveSongView(song, arrId || undefined);
  const lp = lastLine(lastPlayed(song.id, setlists, today, draftId), song, nameOf);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-border px-5 pb-3 pt-4">
        <b className="text-[20px] font-semibold">{song.title}</b>
        <span className="text-[13px] text-muted-foreground">{[song.artist, view?.key && `usually ${view.key}`, view?.tempo && `${view.tempo} BPM`, view?.time].filter(Boolean).join(' · ')}</span>
        <span className="text-[12px] text-muted-foreground">{typeof lp === 'string' ? lp : <>Last: {lp.date} · <span className="text-foreground">{lp.bits}</span></>}</span>
        {(song.arrangements || []).length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {song.arrangements.map(a => <Chip key={a.id} on={(view?._arrangementId) === a.id} className="h-8 px-3 text-[13px]" onClick={() => setArrId(a.id)}>{a.name || 'Main'}</Chip>)}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><ChartPreview view={view} /></div>
      <div className="px-5 pb-4 pt-2"><Button className="h-11 w-full" onClick={onAdd}>{slot ? `Put in slot ${slot}` : 'Add to the order'}</Button></div>
    </div>
  );
}
