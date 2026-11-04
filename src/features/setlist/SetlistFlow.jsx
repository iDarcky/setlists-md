import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { PlusIcon } from '@/app/navIcons';
import { transposeKey, transposeChord } from '@/music';
import { parseLine } from '@/parser';
import { resolveSongView, getArrangement } from '@/arrangements';
import { searchSongs } from '@/lib/search';
import { suggestSongs } from '@/lib/suggestSongs';
import { buildOrder } from '@/lib/setlistView';
import {
  templatesOf, templateTitle, autoName, nextDates, takenDates, shiftDate,
  isPlaceholder, placeholderItem, lastPlayed, dayLabel as longDay, shortDayLabel as shortDay, flowHints, playedRecently,
} from '@/lib/newSetlist';
import { useDragReorder, moveItem } from './useDragReorder';
import { MomentFields, NoteEditor, Grip, NOTE_MAX } from './SetlistEdit';
import { Chip, DateSheet, TimeSheet } from './WhenPickers';
import BandSection from './BandSection';
import { writeNewDraft } from '@/lib/setlistDraft';

// New setlist (canvas → New setlist v2): the template pop-up picks where to
// start, then two steps: Details and band, then Songs. The same two screens
// edit a setlist later, opening on Songs.
// A copy is edited here and saved on Save, so nothing reaches the band
// half-made; a new setlist's band picks travel with it as `plannedBand` and
// the setlist page sends those asks once it is saved.

const STEPS = [['details', 'Details and band'], ['songs', 'Songs']];
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

/* ── Step 1 · Details ─────────────────────────────────────────────────────── */

function ServiceStep({ wide, draft, setDraft, template, setlists, nameTouched, setNameTouched }) {
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

/* ── Step 2 · Songs ───────────────────────────────────────────────────────── */

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

const shortDate = (date) => (date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

/**
 * "Add songs": search, then one line per song (key · last played) with +.
 * Plain on purpose (2026-11-04: the three-column picker was "too busy").
 */
function AddSongs({ songs, draft, setlists, at, today, filling, onAdd, onPreview, previewId, onEmptySlot, searchRef }) {
  const [q, setQ] = useState('');
  const inSet = new Set((draft.items || []).map(i => i?.songId).filter(Boolean));
  const suggested = useMemo(() => suggestSongs({ songs, setlist: draft, setlists, at, limit: 8 }), [songs, draft, setlists, at]);
  const sorted = useMemo(() => [...songs].sort((a, b) => (a.title || '').localeCompare(b.title || '')), [songs]);
  let list; let label;
  if (q.trim()) { list = searchSongs(songs, q, { limit: 40 }); label = null; }
  else if (suggested.length) {
    const ids = new Set(suggested.map(x => x.song.id));
    list = [...suggested.map(x => x.song), ...sorted.filter(s => !ids.has(s.id))]; label = 'Suggested';
  } else { list = sorted; label = 'All songs'; }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[17px] font-semibold">Add songs</b>
        <span className="truncate text-[13px] text-muted-foreground">{filling ? `filling song ${filling}` : '+ fills the next “Song”'}</span>
      </div>
      <Input ref={searchRef} type="search" inputMode="search" placeholder="Search the library" value={q} onChange={e => setQ(e.target.value)} className="h-11" />
      {label && <span className="pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>}
      <div className="rounded-card border border-border bg-card">
        {list.map(s => {
          const lp = lastPlayed(s.id, setlists, today, draft.id);
          const v = resolveSongView(s);
          const line = [v?.key && transposeKey(v.key, lp?.transpose || 0), lp ? `last ${shortDate(lp.date)}` : 'never played', inSet.has(s.id) && 'in this setlist'].filter(Boolean).join(' · ');
          return (
            <div key={s.id} className={cn('flex min-h-[52px] items-center gap-2 border-t border-border px-3 py-1.5 first:border-t-0', previewId === s.id && 'bg-selected')}>
              <button type="button" onClick={() => (onPreview ? onPreview(s.id) : onAdd(s))}
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none focus-visible:underline">
                <span className="truncate text-[14px] font-semibold">{s.title}</span>
                <span className="truncate text-[12px] text-muted-foreground">{line}</span>
              </button>
              <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" aria-label={`Add ${s.title}`} onClick={() => onAdd(s)}><PlusIcon size={18} /></Button>
            </div>
          );
        })}
        {!list.length && <p className="m-0 px-4 py-6 text-center text-[14px] text-muted-foreground">{q.trim() ? `No song matches “${q}”.` : 'No songs in the library yet.'}</p>}
      </div>
      <Button variant="link" className="self-start text-[14px]" onClick={() => onEmptySlot(q.trim())}>
        {q.trim() ? `Keep a “${q.trim()}” slot, choose the song later` : 'Add an empty “Song”, choose later'}
      </Button>
    </div>
  );
}

const SettingRow = ({ label, children }) => (
  <div className="flex min-h-[50px] items-center gap-3 border-t border-border py-2 pl-10 pr-3">
    <span className="w-[58px] shrink-0 text-[13px] text-muted-foreground">{label}</span>
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
  </div>
);
const sm = 'h-8 px-3 text-[13px]';

/** One song, opened in place: who leads, key, BPM, time, version, note. */
function SongSettings({ item, song, people, setlists, draftId, nameOf, today, onChange }) {
  const [allKeys, setAllKeys] = useState(false);
  const view = resolveSongView(song, item.arrangementId);
  const arrs = song?.arrangements || [];
  const base = view?.key || '';
  const t = item.transpose || 0;
  const span = allKeys ? Array.from({ length: 12 }, (_, i) => i - 5) : [-2, -1, 0, 1, 2].map(x => x + t).filter(x => x >= -6 && x <= 6);
  const keys = base ? span.map(x => ({ t: x, key: transposeKey(base, x) })) : [];
  const tempo = item.tempo ?? view?.tempo ?? null;
  const time = item.time || view?.time || '';
  const raw = lastPlayed(item.songId, setlists, today, draftId);
  const lp = lastLine(raw, song, nameOf);
  return (
    <>
      <div className="mx-3 mb-2.5 ml-10 rounded-control bg-background/60 px-3 py-2 text-[13px] text-muted-foreground">
        {typeof lp === 'string' ? lp : <>Last time: {lp.date} · <span className="font-medium text-foreground">{lp.bits}</span>{lp.who && ` · led by ${lp.who}`}</>}
      </div>
      <SettingRow label="Leads">
        {people.map(p => <Chip key={p.id} on={item.leadBy === p.id} className={sm} onClick={() => onChange({ leadBy: item.leadBy === p.id ? undefined : p.id })}>{p.name}</Chip>)}
        {!people.length && <span className="text-[13px] text-muted-foreground">Pick singers in Details and band</span>}
      </SettingRow>
      {keys.length > 0 && (
        <SettingRow label="Key">
          {keys.map(k => (
            <Chip key={k.t} on={k.t === t} dashed={k.t === 0 && k.t !== t} className="h-8 px-2.5 font-mono text-[13px]" onClick={() => onChange({ transpose: k.t })}>{k.key}</Chip>
          ))}
          <Chip dashed className="h-8 px-2.5 text-[13px]" onClick={() => setAllKeys(v => !v)}>{allKeys ? 'Fewer' : 'More'}</Chip>
        </SettingRow>
      )}
      <SettingRow label="BPM">
        <div className="flex items-center overflow-hidden rounded-control border border-border">
          <Button variant="ghost" className="h-9 w-10 rounded-none" aria-label="Slower" onClick={() => onChange({ tempo: Math.max(30, (Number(tempo) || 100) - 1) })}>−</Button>
          <Input type="number" inputMode="numeric" aria-label="BPM" value={tempo ?? ''} placeholder="—"
            onChange={e => onChange({ tempo: e.target.value === '' ? undefined : Math.max(30, Math.min(260, Number(e.target.value) || 0)) })}
            className="h-9 w-[64px] rounded-none border-0 border-x border-border text-center font-semibold" />
          <Button variant="ghost" className="h-9 w-10 rounded-none" aria-label="Faster" onClick={() => onChange({ tempo: Math.min(260, (Number(tempo) || 100) + 1) })}>+</Button>
        </div>
        {view?.tempo ? <span className="text-[12px] text-muted-foreground">usual {view.tempo}</span> : null}
      </SettingRow>
      <SettingRow label="Time">
        {[...new Set([view?.time, ...TIMES].filter(Boolean))].map(x => <Chip key={x} on={time === x} className={sm} onClick={() => onChange({ time: x === view?.time ? undefined : x })}>{x}</Chip>)}
      </SettingRow>
      {arrs.length > 1 && (
        <SettingRow label="Version">
          {arrs.map(a => <Chip key={a.id} on={(item.arrangementId || getArrangement(song)?.id) === a.id} className={sm} onClick={() => onChange({ arrangementId: a.id, arrangementName: a.name })}>{a.name || 'Main'}</Chip>)}
        </SettingRow>
      )}
      <SettingRow label="Note">
        <Input value={item.note || ''} maxLength={NOTE_MAX} placeholder="Add a cue for the band…" aria-label="Note for the band" onChange={e => onChange({ note: e.target.value.slice(0, NOTE_MAX) })} className="h-9" />
      </SettingRow>
    </>
  );
}

/* ── The flow ─────────────────────────────────────────────────────────────── */

/**
 * @param {object} setlist   a fresh draft (isNew, already filled from a template) or the saved setlist
 * @param {(draft) => Array<{id,name}>} peopleOf  who can lead (the band, else the church's singers)
 */
export default function SetlistFlow({
  setlist, isNew = false, songs = [], setlists = [], peopleOf = () => [], nameOf = () => '',
  team = null, members = [], schedules = [], setlistMap = {}, createSchedule, deleteSchedule, ensureRow,
  onSave, onCancel, onDirtyChange, initialStep, space = 'personal',
}) {
  const wide = useWide();
  const templates = useMemo(() => templatesOf(setlists), [setlists]);
  const [draft, setDraft] = useState(() => ({ ...setlist, items: (setlist.items || []).map(it => ({ ...it })) }));
  const [step, setStep] = useState(initialStep === 'songs' || initialStep === 'details' ? initialStep : (isNew ? 'details' : 'songs'));
  const [nameTouched, setNameTouched] = useState(!isNew);
  const [bandExtra, setBandExtra] = useState([]);
  const [open, setOpen] = useState(null);              // order index opened in place
  const [slot, setSlot] = useState(null);              // index of the "Song" (or song) being filled
  const [previewId, setPreviewId] = useState(null);    // desktop: library song shown in the right column
  const [noteFor, setNoteFor] = useState(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [ready, setReady] = useState(false);           // Save and mark ready
  const [removed, setRemoved] = useState(null);        // { item, index } — for Undo
  const searchRef = useRef(null);
  const libRef = useRef(null);
  const template = templates.find(t => t.id === draft.templateId) || null;

  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(setlist);
  useEffect(() => { onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(setlist)); }, [draft, setlist, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // A new setlist keeps itself on the device as it is made (the pop-up then
  // offers "Continue your setlist"); saving it clears that.
  useEffect(() => { if (isNew) writeNewDraft(space, draft); }, [isNew, space, draft]);
  useEffect(() => {
    if (!removed) return undefined;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);

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
  const follow = (i, from, to) => (i == null ? i : i === from ? to : from < i && to >= i ? i - 1 : from > i && to <= i ? i + 1 : i);
  const move = (from, to) => { setItems(xs => moveItem(xs, from, to)); setOpen(o => follow(o, from, to)); setSlot(x => follow(x, from, to)); };
  const remove = (i) => { setRemoved({ item: items[i], index: i, title: order.rows[i]?.title }); setItems(xs => xs.filter((_, j) => j !== i)); setOpen(null); setSlot(null); };
  const undoRemove = () => {
    if (!removed) return;
    setItems(xs => { const n = [...xs]; n.splice(Math.min(removed.index, n.length), 0, removed.item); return n; });
    setRemoved(null);
  };
  const { listRef, gripProps, rowStyle } = useDragReorder(move);

  const songItem = (s) => {
    const arr = getArrangement(s);
    return { songId: s.id, songTitle: s.title, arrangementId: arr?.id, arrangementName: arr?.name || 'Main Arrangement', note: '', transpose: 0, capo: 0 };
  };
  // Where + puts a song: the slot being filled, else the next empty "Song", else the end.
  const fillAt = slot != null && items[slot] ? slot : items.findIndex(isPlaceholder);
  const goToLibrary = () => {
    if (wide) { setPreviewId(null); searchRef.current?.focus(); return; }
    libRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 350);
  };
  const addSong = (s) => {
    if (fillAt >= 0) setItems(xs => xs.map((x, j) => (j === fillAt ? { ...songItem(s), ...(x.note ? { note: x.note } : {}), ...(x.leadBy ? { leadBy: x.leadBy } : {}) } : x)));
    else setItems(xs => [...xs, songItem(s)]);
    setSlot(null);
    setPreviewId(null);
  };
  const emptySlot = (label) => { setItems(xs => [...xs, placeholderItem(label)]); };
  const addMoment = () => { setItems(xs => [...xs, { type: 'break', label: '', note: '', duration: 0 }]); setOpen(items.length); };
  const tapRow = (i) => {
    if (isPlaceholder(items[i])) { setSlot(i); setOpen(null); goToLibrary(); return; }
    setOpen(o => (o === i ? null : i));
  };

  const previewSong = previewId ? songs.find(s => s.id === previewId) : null;
  const idx = STEPS.findIndex(([k]) => k === step);
  const nextStep = STEPS[idx + 1];
  const save = (final = false) => {
    onDirtyChange?.(false);
    if (isNew) writeNewDraft(space, null);
    onSave?.(draft, { ready: final === true && ready });
  };
  const canSave = !!(draft.name || '').trim() || !!draft.date;
  const asks = isNew && draft.plannedBand?.length;
  const canReady = draft.status !== 'ready';
  const saveLabel = asks ? 'Save and ask band' : ready && canReady ? 'Save and mark ready' : 'Save setlist';
  const hints = flowHints(order.rows);
  const fillingN = fillAt >= 0 ? order.rows[fillAt]?.n : null;

  /* ── Pieces ─────────────────────────────────────────────────────────── */
  const leadChip = (it) => {
    if (!it?.songId) return null;
    const name = it.leadBy ? nameOf(it.leadBy) : '';
    return name
      ? <span className="flex h-[26px] max-w-[110px] shrink-0 items-center gap-1.5 rounded-full bg-raised pl-[3px] pr-2 text-[12px] text-muted-foreground">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[9px] font-bold text-link">{initials(name)}</span>
          <span className="truncate">{name.split(' ')[0]}</span>
        </span>
      : <span className="flex h-[26px] shrink-0 items-center rounded-full border border-dashed border-input px-2 text-[12px] text-muted-foreground">Who leads?</span>;
  };

  const orderList = (
    <div ref={listRef} className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      {order.rows.map((r, i) => {
        const it = items[i];
        const isSlot = isPlaceholder(it);
        const isOpen = open === i;
        const filling = isSlot && fillAt === i && (slot === i || wide);
        return (
          <div key={i} data-drag-row style={rowStyle(i)}
            className={cn('border-t border-border bg-card first:border-t-0', isOpen && 'bg-raised', isSlot && 'border-t-0 px-1.5 py-1')}>
            <div className={cn('flex min-h-[54px] items-center gap-1', isSlot && 'rounded-control border border-dashed border-input', filling && 'border-link bg-selected')}>
              <Grip {...gripProps(i)} />
              <button type="button" onClick={() => tapRow(i)} aria-expanded={isSlot ? undefined : isOpen}
                className="flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-0 bg-transparent py-1.5 pr-3 text-left font-sans text-foreground outline-none focus-visible:underline">
                {r.kind === 'song' && !isSlot && <span className="w-4 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{r.n}</span>}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn('truncate', r.kind === 'moment' ? 'text-[14px] text-muted-foreground' : 'text-[15px] font-semibold')}>
                    {r.kind === 'moment' && !it.label ? 'New moment' : r.title}
                  </span>
                  {!isSlot && r.kind === 'song' && <span className="truncate text-[12px] text-muted-foreground">{[r.tempo && `${r.tempo} BPM`, r.time].filter(Boolean).join(' · ') || ' '}</span>}
                  {!isSlot && r.kind === 'song' && (() => {
                    const recent = playedRecently(it.songId, setlists, draft.date || today, draft.id);
                    if (!recent && !hints[i]) return null;
                    return (
                      <span className="truncate text-[12px]">
                        {hints[i] && <span className="text-warning-text">{hints[i]}</span>}
                        {hints[i] && recent && <span className="text-muted-foreground"> · </span>}
                        {recent && <span className="text-muted-foreground">{recent}</span>}
                      </span>
                    );
                  })()}
                </span>
                {r.kind === 'moment' && r.minutes > 0 && <span className="text-[12px] text-muted-foreground">{r.minutes} min</span>}
                {isSlot && <span className="text-[13px] font-medium text-link">{filling ? 'choosing…' : 'Choose'}</span>}
                {!isOpen && leadChip(it)}
                <KeyChip k={r.key} />
                {!isSlot && <span className={cn('w-3.5 shrink-0 text-center text-[13px] text-muted-foreground transition-transform', isOpen ? 'rotate-180' : '')} aria-hidden="true">⌄</span>}
              </button>
            </div>
            {isOpen && (
              <div className="pb-1">
                {it.type === 'break' ? (
                  <div className="px-3 pb-3 pl-10"><MomentFields item={it} onChange={p => patchItem(i, p)} onOpenNote={() => setNoteFor(i)} /></div>
                ) : (
                  <SongSettings item={it} song={songs.find(s => s.id === it.songId)} people={people} setlists={setlists} draftId={draft.id} nameOf={nameOf} today={today} onChange={p => patchItem(i, p)} />
                )}
                <div className="flex items-center justify-between border-t border-border py-2 pl-10 pr-3">
                  {it.songId ? <Button variant="link" className="text-[14px]" onClick={() => { setSlot(i); setOpen(null); goToLibrary(); }}>Change song</Button> : <span />}
                  <Button variant="link" className="text-[14px] text-danger" onClick={() => remove(i)}>Remove</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!order.rows.length && <p className="m-0 py-8 text-center text-[14px] text-muted-foreground">Nothing here yet. Add songs below, or a moment.</p>}
    </div>
  );

  const orderBlock = (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[17px] font-semibold">Order</b>
        <span className="flex items-center gap-3 truncate text-[13px] text-muted-foreground">
          {order.songCount} {order.songCount === 1 ? 'song' : 'songs'}{order.totalSeconds ? ` · ~${Math.round(order.totalSeconds / 60)} min` : ''}
          {!wide && <Button variant="link" className="text-[13px]" onClick={goToLibrary}>Add songs ↓</Button>}
        </span>
      </div>
      {wide && <span className="-mt-2 text-[12px] text-muted-foreground">{[longDay(draft.date), draft.time, draft.location].filter(Boolean).join(' · ')} · drag ⠿ to move</span>}
      {orderList}
      <div className="flex gap-2"><Chip onClick={addMoment}><PlusIcon size={16} />Add moment</Chip></div>
      {canReady && (
        <div className="mt-2 flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-medium">Mark ready when I save</span>
            <span className="text-[12px] text-muted-foreground">{asks ? 'The band hears it’s final once they’re asked.' : 'The band hears it’s final.'}</span>
          </span>
          <Switch label="Mark ready when I save" on={ready} onChange={setReady} />
        </div>
      )}
    </div>
  );

  const addSongs = (
    <AddSongs songs={songs} draft={draft} setlists={setlists} at={fillAt >= 0 ? fillAt : items.length} today={today}
      filling={slot != null ? fillingN : null} onAdd={addSong} onEmptySlot={emptySlot} searchRef={searchRef}
      onPreview={wide ? (id) => setPreviewId(id) : null} previewId={previewId} />
  );

  const bandBlock = (
    <div className="flex flex-col gap-3">
      <Caps>Band</Caps>
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
        <p className="m-0 rounded-card bg-raised px-4 py-3 text-[14px] text-muted-foreground">The band is picked in a church space.</p>
      )}
    </div>
  );
  const serviceBlock = (
    <div className="flex flex-col gap-3">
      {wide && <Caps>Service</Caps>}
      <ServiceStep wide={wide} draft={draft} setDraft={setDraft} template={template} setlists={setlists} nameTouched={nameTouched} setNameTouched={setNameTouched} />
    </div>
  );

  /* ── Frame ──────────────────────────────────────────────────────────── */
  let body;
  if (step === 'details') {
    body = wide
      ? <div className="mx-auto grid w-full max-w-[1100px] grid-cols-2 gap-8 px-6 pb-16 pt-4">{serviceBlock}{bandBlock}</div>
      : <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5 px-4 pb-36 pt-2">{serviceBlock}{bandBlock}</div>;
  } else if (wide) {
    body = (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,420px)] border-t border-border">
        <div className="min-h-0 overflow-y-auto border-r border-border px-6 py-5"><div className="mx-auto max-w-[760px]">{orderBlock}</div></div>
        <div className="flex min-h-0 flex-col overflow-y-auto">
          {previewSong
            ? <DeskPreview song={previewSong} onBack={() => setPreviewId(null)} onAdd={() => addSong(previewSong)} slotN={fillingN || order.songCount + 1} setlists={setlists} draftId={draft.id} nameOf={nameOf} today={today} />
            : <div className="p-5">{addSongs}</div>}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6 px-4 pb-36 pt-2">
        {orderBlock}
        <div ref={libRef} className="scroll-mt-28">{addSongs}</div>
      </div>
    );
  }
  const deskSongs = wide && step === 'songs';

  return (
    <div data-slot="setlist-flow" className={cn('flex flex-col bg-background font-sans text-foreground', deskSongs ? 'h-full min-h-[calc(100dvh-64px)]' : 'min-h-full')}>
      <div className="sticky top-0 z-10 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" className="-ml-3" onClick={onCancel}>Cancel</Button>
          {!wide && <b className="flex-1 text-center text-[16px] font-semibold">{isNew ? 'New setlist' : 'Edit setlist'}</b>}
          {wide && (
            <>
              <b className="truncate font-mono text-[16px] font-semibold">{draft.name || (isNew ? 'New setlist' : 'Edit setlist')}</b>
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
              <Button variant="outline" disabled={!canSave || (!dirty && !isNew)} onClick={() => save()}>{isNew ? 'Save draft' : 'Save'}</Button>
              {nextStep ? <Button onClick={() => setStep(nextStep[0])}>Next: {nextStep[1]}</Button> : <Button disabled={!canSave} onClick={() => save(true)}>{saveLabel}</Button>}
            </>
          )}
          {!wide && <Button variant="ghost" className="-mr-3 text-link" disabled={!canSave || (!dirty && !isNew)} onClick={() => save()}>{isNew ? 'Save draft' : 'Save'}</Button>}
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
              <span>Step {idx + 1} of {STEPS.length} · <b className="font-semibold text-foreground">{STEPS[idx][1]}</b></span>
              <span className="truncate pl-3 font-mono">{draft.name}</span>
            </div>
          </div>
        )}
      </div>

      {body}

      {!wide && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
          {idx > 0 && <Button variant="outline" className="h-12" onClick={() => setStep(STEPS[idx - 1][0])}>Back</Button>}
          {nextStep
            ? <Button className="h-12 flex-1" onClick={() => setStep(nextStep[0])}>Next: {nextStep[1]}</Button>
            : <Button className="h-12 flex-1" disabled={!canSave} onClick={() => save(true)}>{saveLabel}</Button>}
        </div>
      )}

      {removed && (
        <div role="status" className={cn('fixed inset-x-0 z-30 mx-auto flex w-[calc(100%-32px)] max-w-[420px] items-center gap-3 rounded-card border border-border bg-raised px-4 py-2.5 shadow-lg', wide ? 'bottom-6' : 'bottom-[88px]')}>
          <span className="min-w-0 flex-1 truncate text-[14px]">Removed “{removed.title || removed.item?.label || 'Song'}”</span>
          <Button variant="link" className="text-[14px]" onClick={undoRemove}>Undo</Button>
        </div>
      )}
      {noteFor != null && (
        <NoteEditor open key={noteFor} title={items[noteFor]?.label || 'Moment'} value={items[noteFor]?.note}
          onCancel={() => setNoteFor(null)} onDone={(text) => { patchItem(noteFor, { note: text }); setNoteFor(null); }} />
      )}
    </div>
  );
}

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

/** Desktop: a library song's chart in the right column, before adding it. */
function DeskPreview({ song, onAdd, onBack, slotN, setlists, draftId, nameOf, today }) {
  const view = resolveSongView(song);
  const lp = lastLine(lastPlayed(song.id, setlists, today, draftId), song, nameOf);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 border-b border-border px-5 pb-3 pt-4">
        <Button variant="link" className="self-start text-[14px]" onClick={onBack}>‹ Add songs</Button>
        <b className="text-[20px] font-semibold">{song.title}</b>
        <span className="text-[13px] text-muted-foreground">
          {[view?.key && `usually ${view.key}`, view?.tempo && `${view.tempo} BPM`, view?.time, typeof lp === 'string' ? lp.toLowerCase() : `last ${lp.date}`].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><ChartPreview view={view} /></div>
      <div className="px-5 pb-5 pt-2"><Button className="h-11 w-full" onClick={onAdd}>Add as song {slotN}</Button></div>
    </div>
  );
}
