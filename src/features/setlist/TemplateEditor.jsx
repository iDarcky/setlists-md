import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { Switch as SharedSwitch } from '@/ui/shadcn/switch';
import { Button } from '@/ui/shadcn/button';
import { BottomActions } from '@/ui/shadcn/bottom-actions';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { BackIcon, ChevronRightIcon, EditIcon, PlusIcon } from '@/app/navIcons';
import { partName, ADDABLE_PARTS } from '@/lib/bandParts';
import { WEEKDAYS, splitPattern, nextNumber, formatName, patternFromName, templateTitle, blankTemplate, placeholderItem, isPlaceholder, TEMPLATE_KIND } from '@/lib/newSetlist';
import { Chip, TimeInput } from './WhenPickers';
import { useDragReorder, moveItem } from './useDragReorder';
import { Grip } from './SetlistEdit';

// Service templates (canvas → New setlist, NS7Template): when, where, the
// rehearsal, the setlist NAME with its running number, the band's parts and
// the order as "Song" placeholders and moments. A template only shapes NEW
// setlists; editing it never touches one already made.

const Caps = ({ children, right }) => (
  <div className="flex items-center justify-between pt-2">
    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</span>
    {right}
  </div>
);
const Row = ({ label, children }) => (
  <div className="flex min-h-[52px] items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
    <span className="w-[84px] shrink-0 text-[14px] text-muted-foreground">{label}</span>
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
  </div>
);
const Switch = ({ on, onChange, label }) => <SharedSwitch checked={on} onCheckedChange={onChange} label={label} />;

export function TemplateEditor({ template, setlists = [], onSave, onCancel, onDelete }) {
  const [t, setT] = useState(() => {
    const x = { ...blankTemplate(), ...template, items: (template?.items || []).map(it => ({ ...it })) };
    // A pattern that is not "<name> #{n}" was written by hand: keep it.
    if (x.nameCustom == null && splitPattern(x.namePattern)) x.nameCustom = x.namePattern !== `${(x.templateName || '').trim()} #{n}`;
    return x;
  });
  const [addPart, setAddPart] = useState(false);
  const set = (p) => setT(x => ({ ...x, ...p }));
  // Numbered names: "<template name> #<n>" unless the leader typed their own
  // ("BBPT #424 AM"), whose last number becomes the counter.
  const numbered = !!splitPattern(t.namePattern);
  const baseTitle = (t.templateName || '').trim() || 'Sunday Morning';
  const defaultPattern = `${baseTitle} #{n}`;
  const effPattern = numbered ? (t.nameCustom ? t.namePattern : defaultPattern) : '';
  const width = t.nameCustom ? t.namePad : 1;
  const next = numbered ? nextNumber(effPattern, setlists, '', t.startNumber) || Number(t.startNumber) || 1 : null;
  const [typed, setTyped] = useState(null);
  const typedOk = typed == null || !!patternFromName(typed);
  const typeName = (text) => {
    setTyped(text);
    const p = patternFromName(text);
    if (p) set({ nameCustom: true, namePattern: p.pattern, startNumber: p.number, namePad: p.pad });
  };
  // Band: the stored list repeats a part for two ("vocals", "vocals"); shown
  // as one row per part with a count.
  const partRows = [];
  (t.parts || []).forEach(p => { const row = partRows.find(x => x.part === p); if (row) row.n += 1; else partRows.push({ part: p, n: 1 }); });
  const setCount = (part, n) => {
    const rows = partRows.map(x => (x.part === part ? { ...x, n } : x)).filter(x => x.n > 0);
    set({ parts: rows.flatMap(x => Array(x.n).fill(x.part)) });
  };
  // Rehearsal day as a weekday counted back from the service day.
  const serviceDay = Number.isInteger(t.weekday) ? t.weekday : 0;
  const rehearsalDays = [0, 1, 2, 3, 4, 5, 6].map(n => [n, n === 0 ? `${WEEKDAYS[serviceDay]} (same day)` : WEEKDAYS[(serviceDay - n + 7) % 7]]);
  const items = t.items;
  const setItems = (fn) => setT(x => ({ ...x, items: fn(x.items) }));
  const { listRef, gripProps, rowStyle } = useDragReorder((from, to) => setItems(xs => moveItem(xs, from, to)));
  const title = templateTitle(t);
  const canSave = !!(t.templateName || '').trim();

  const save = () => {
    const name = t.templateName.trim();
    // The template IS the service now: renaming it renames the service, and
    // App carries the new name onto the setlists that had the old one.
    onSave({ ...t, namePattern: numbered ? (t.nameCustom ? t.namePattern : `${name} #{n}`) : '', templateName: name, name, service: name, isTemplate: true, templateKind: TEMPLATE_KIND, updatedAt: Date.now() }, { previousService: template?.service || templateTitle(template) || '' });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Template · ${title}`} className="fixed inset-0 z-[70] flex flex-col bg-background font-sans text-foreground">
      <div className="flex min-h-14 items-center justify-center gap-2 border-b border-border px-4 py-2 sm:justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        {/* Phone: Cancel and Save sit in the bar at the bottom. */}
        <Button variant="ghost" className="hidden sm:inline-flex" onClick={onCancel}>Cancel</Button>
        <b className="truncate text-[16px]">{t.templateName || 'New template'}</b>
        <Button className="hidden sm:inline-flex" disabled={!canSave} onClick={save}>Save</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pb-16 pt-4">
          <div className="rounded-card border border-border bg-card">
            <Row label="Name"><Input value={t.templateName || ''} maxLength={60} placeholder="Sunday Morning" onChange={e => set({ templateName: e.target.value })} className="h-10" /></Row>
            <Row label="Day">{WEEKDAYS.map((d, i) => <Chip key={d} on={t.weekday === i} className="h-8 px-2.5 text-[13px]" onClick={() => set({ weekday: i })}>{d}</Chip>)}</Row>
            <Row label="Time"><TimeInput aria-label="Service time" value={t.time} onChange={v => set({ time: v })} /></Row>
            <Row label="Place"><Input value={t.location || ''} maxLength={80} placeholder="Main hall" onChange={e => set({ location: e.target.value })} className="h-10" /></Row>
          </div>

          <Caps right={<Switch label="Rehearsal" on={t.rehearsalOn !== false && !!t.rehearsalOn} onChange={v => set({ rehearsalOn: v })} />}>Rehearsal</Caps>
          {t.rehearsalOn && (
            <div className="rounded-card border border-border bg-card">
              <Row label="Day">
                {rehearsalDays.map(([n, l]) => <Chip key={n} on={!t.rehearsalPick && (Number(t.rehearsalOffset) || 0) === n} className="h-8 px-3 text-[13px]" onClick={() => set({ rehearsalOffset: n, rehearsalPick: false })}>{l}</Chip>)}
                <Chip on={!!t.rehearsalPick} dashed={!t.rehearsalPick} className="h-8 px-3 text-[13px]" onClick={() => set({ rehearsalPick: true })}>Pick each week</Chip>
              </Row>
              <Row label="Time"><TimeInput aria-label="Rehearsal time" value={t.rehearsalTime} onChange={v => set({ rehearsalTime: v })} /></Row>
              <Row label="Place"><Input value={t.rehearsalLocation || ''} maxLength={80} placeholder={t.location || 'Main hall'} onChange={e => set({ rehearsalLocation: e.target.value })} className="h-10" /></Row>
            </div>
          )}

          <Caps right={<Switch label="Number the setlists" on={numbered} onChange={v => { setTyped(null); set(v ? { namePattern: defaultPattern, nameCustom: false, namePad: 1, startNumber: 1 } : { namePattern: '', nameCustom: false }); }} />}>Number the setlists</Caps>
          {numbered ? (
            <div className="rounded-card border border-border bg-card">
              <Row label="Next one">
                <Input value={typed ?? formatName(effPattern, next, width)} maxLength={60} aria-label="Next setlist's name" aria-invalid={!typedOk || undefined}
                  onChange={e => typeName(e.target.value)} onBlur={() => { if (typedOk) setTyped(null); }} className="h-10 font-mono" />
              </Row>
              <p className="m-0 border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
                {typedOk
                  ? <>Then <b className="font-mono text-foreground">{formatName(effPattern, next + 1, width)}</b>, and so on. You can change how it is written, as long as it has a number.</>
                  : <span className="text-danger">Put a number in the name, like #1.</span>}
              </p>
            </div>
          ) : (
            <p className="m-0 text-[13px] text-muted-foreground">Setlists are called “{baseTitle}”. Turn this on to add a number that goes up each time.</p>
          )}

          <Caps>Band</Caps>
          <div className="rounded-card border border-border bg-card">
            {partRows.map(({ part, n }) => (
              <div key={part} className="flex min-h-[52px] items-center gap-3 border-t border-border px-4 py-1.5 first:border-t-0">
                <span className="flex-1 text-[15px] font-medium">{partName(part)}</span>
                <Button variant="outline" size="icon" className="size-9" aria-label={`One less ${partName(part)}`} onClick={() => setCount(part, n - 1)}>−</Button>
                <span className="w-6 text-center font-mono text-[15px]" aria-label={`${n} ${partName(part)}`}>{n}</span>
                <Button variant="outline" size="icon" className="size-9" aria-label={`One more ${partName(part)}`} onClick={() => setCount(part, n + 1)}>+</Button>
              </div>
            ))}
            {!partRows.length && <p className="m-0 px-4 py-3 text-[14px] text-muted-foreground">Who you need each week, like 1 drums and 2 vocals.</p>}
            <Popover open={addPart} onOpenChange={setAddPart}>
              <PopoverTrigger asChild>
                <button type="button" className="flex min-h-12 w-full cursor-pointer items-center gap-2 border-0 border-t border-solid border-border bg-transparent px-4 text-left font-sans text-[15px] font-medium text-link outline-none focus-visible:bg-raised">
                  <PlusIcon size={16} />Add to band<span aria-hidden="true" className="ml-auto text-muted-foreground">▾</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="z-[80] max-h-[320px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1">
                {ADDABLE_PARTS.filter(p => !partRows.some(x => x.part === p)).map(p => (
                  <button key={p} type="button" onClick={() => { set({ parts: [...(t.parts || []), p] }); setAddPart(false); }}
                    className="flex min-h-11 w-full cursor-pointer items-center rounded-control border-0 bg-transparent px-3 text-left font-sans text-[15px] text-foreground outline-none hover:bg-raised focus-visible:bg-raised">
                    {partName(p)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <Caps>Order</Caps>
          <div ref={listRef} className="rounded-card border border-border bg-card px-2 py-1">
            {items.map((it, i) => (
              <div key={i} data-drag-row style={rowStyle(i)} className={cn('my-1 flex min-h-12 items-center gap-2 rounded-control bg-card pr-1', isPlaceholder(it) ? 'border border-dashed border-input' : 'border border-transparent')}>
                <Grip {...gripProps(i)} />
                {it.type === 'break' ? (
                  <>
                    <Input value={it.label || ''} maxLength={60} placeholder="Moment, e.g. Prayer" aria-label="Moment name"
                      onChange={e => setItems(xs => xs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-9 flex-1" />
                    <Input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} aria-label="Minutes" placeholder="min" value={it.duration || ''}
                      onChange={e => setItems(xs => xs.map((x, j) => (j === i ? { ...x, duration: Math.max(0, Math.min(120, Number(e.target.value.replace(/\D/g, '')) || 0)) } : x)))} className="h-9 w-[64px]" />
                  </>
                ) : (
                  <span className="flex-1 text-[15px] font-semibold">{it.songId ? (it.songTitle || 'Song') : 'Song'}{it.songId && <span className="ml-2 text-[12px] font-normal text-muted-foreground">always this song</span>}</span>
                )}
                <Button variant="ghost" size="icon" className="size-9 text-danger" aria-label="Remove" onClick={() => setItems(xs => xs.filter((_, j) => j !== i))}>✕</Button>
              </div>
            ))}
            {!items.length && <p className="m-0 py-4 text-center text-[14px] text-muted-foreground">An empty order. Add “Song” slots and moments.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setItems(xs => [...xs, placeholderItem()])}><PlusIcon size={16} />Song</Button>
            <Button variant="outline" size="sm" onClick={() => setItems(xs => [...xs, { type: 'break', label: '', note: '', duration: 0 }])}><PlusIcon size={16} />Moment</Button>
          </div>

          {onDelete && <Button variant="outline" className="mt-6 text-danger" onClick={onDelete}>Delete template</Button>}
        </div>
      </div>
      <BottomActions className="sm:hidden">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={!canSave} onClick={save}>Save</Button>
      </BottomActions>
    </div>,
    document.body,
  );
}

/** Every template, with New template. Opens the editor for one. */
export function TemplatesList({ templates = [], onEdit, onNew }) {
  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className="rounded-card border border-border bg-card">
        {templates.map(t => (
          <button key={t.id} type="button" onClick={() => onEdit(t)}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-t border-solid border-border bg-transparent px-4 py-2 text-left font-sans text-foreground outline-none first:border-t-0 focus-visible:bg-raised">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{templateTitle(t)}</span>
              <span className="truncate text-[13px] text-muted-foreground">
                {[Number.isInteger(t.weekday) && `${WEEKDAYS[t.weekday]} ${t.time || ''}`.trim(), t.location, `${(t.items || []).filter(i => i.type !== 'break').length} songs`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <ChevronRightIcon />
          </button>
        ))}
        {!templates.length && <p className="m-0 px-4 py-5 text-[14px] text-muted-foreground">No templates yet.</p>}
      </div>
      <Button onClick={onNew}><PlusIcon size={16} />New template</Button>
    </div>
  );
}

export function TemplatesSheet({ open, onOpenChange, templates = [], onEdit, onNew }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Templates" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
      <TemplatesList templates={templates} onEdit={onEdit} onNew={onNew} />
    </Sheet>
  );
}

const Info = ({ label, value }) => (
  <div className="flex min-h-12 items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
    <span className="flex-1 text-[15px]">{label}</span>
    <span className="text-right text-[15px] text-muted-foreground">{value || '—'}</span>
  </div>
);

/**
 * One template, read-only (owner, 2026-11-14): tapping a template shows it
 * first, so nobody lands in the editor by accident. Edit opens the editor.
 */
export function TemplateView({ template: t, onEdit, onClose, embedded = false }) {
  const parts = [];
  (t.parts || []).forEach(p => { const x = parts.find(r => r.part === p); if (x) x.n += 1; else parts.push({ part: p, n: 1 }); });
  const serviceDay = Number.isInteger(t.weekday) ? t.weekday : null;
  const rehearsalDay = t.rehearsalPick ? 'Picked each week'
    : serviceDay == null ? '' : WEEKDAYS[(serviceDay - (Number(t.rehearsalOffset) || 0) + 7) % 7];
  const numbered = splitPattern(t.namePattern);
  const items = t.items || [];
  const body = (
    <div role="dialog" aria-modal={embedded ? undefined : 'true'} aria-label={`Template · ${templateTitle(t)}`}
      className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'fixed inset-0 z-[70]')}>
      <div className="flex items-center gap-1 px-4 pb-1" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <button type="button" onClick={onClose} aria-label="Templates" title="Templates" className="-ml-2.5 flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><BackIcon /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4 pb-28">
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.5px]">{templateTitle(t)}</h1>
          <p className="m-0 text-[14px] text-muted-foreground">Template{numbered ? ` · setlists are numbered (${formatName(t.namePattern, Number(t.startNumber) || 1, t.namePad)} …)` : ''}</p>

          <Caps>When</Caps>
          <div className="rounded-card border border-border bg-card">
            <Info label="Service" value={[serviceDay != null && WEEKDAYS[serviceDay], t.time].filter(Boolean).join(' ')} />
            {t.rehearsalOn && <Info label="Rehearsal" value={[rehearsalDay, t.rehearsalTime].filter(Boolean).join(' ')} />}
            <Info label="Place" value={t.location} />
          </div>

          <Caps>Band</Caps>
          <div className="rounded-card border border-border bg-card px-4 py-3 text-[15px]">
            {parts.length ? parts.map(x => (x.n > 1 ? `${x.n} ${partName(x.part)}` : partName(x.part))).join(', ') : <span className="text-muted-foreground">No parts picked</span>}
          </div>

          <Caps>Order of service</Caps>
          <div className="rounded-card border border-border bg-card">
            {items.length ? items.map((it, i) => (
              <div key={i} className="flex min-h-11 items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
                <span className="w-5 text-[13px] text-muted-foreground">{i + 1}</span>
                <span className="flex-1 text-[15px]">
                  {it.type === 'break' ? (it.label || 'Moment') : it.songId ? (it.songTitle || 'Song') : (it.label || 'Song')}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {it.type === 'break' ? (it.duration ? `${it.duration} min` : 'Moment') : it.songId ? 'Always this song' : isPlaceholder(it) ? 'Song to pick' : ''}
                </span>
              </div>
            )) : <p className="m-0 px-4 py-4 text-[14px] text-muted-foreground">Nothing in the order yet.</p>}
          </div>
        </div>
      </div>
      {onEdit && (
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-4 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          <div className="mx-auto max-w-[560px]"><Button className="w-full" onClick={onEdit}><EditIcon size={16} />Edit template</Button></div>
        </div>
      )}
    </div>
  );
  return embedded ? body : createPortal(body, document.body);
}
