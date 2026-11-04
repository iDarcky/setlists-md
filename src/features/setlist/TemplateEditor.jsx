import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { ChevronRightIcon, PlusIcon } from '@/app/navIcons';
import { partName, ADDABLE_PARTS } from '@/lib/bandParts';
import { WEEKDAYS, splitPattern, nextNumber, templateTitle, blankTemplate, placeholderItem, isPlaceholder, TEMPLATE_KIND } from '@/lib/newSetlist';
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
const Switch = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={cn('relative h-[26px] w-11 min-h-0 shrink-0 cursor-pointer rounded-full border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-link' : 'bg-raised')}>
    <span className={cn('absolute top-[3px] size-5 rounded-full bg-background transition-[left]', on ? 'left-[21px]' : 'left-[3px]')} />
  </button>
);

export function TemplateEditor({ template, setlists = [], onSave, onCancel, onDelete }) {
  const [t, setT] = useState(() => ({ ...blankTemplate(), ...template, items: (template?.items || []).map(it => ({ ...it })) }));
  const [addPart, setAddPart] = useState(false);
  const set = (p) => setT(x => ({ ...x, ...p }));
  // Numbered names are "<template name> #<n>": one switch and a start number.
  const numbered = !!splitPattern(t.namePattern);
  const baseTitle = (t.templateName || '').trim() || 'Sunday Morning';
  const pattern = `${baseTitle} #{n}`;
  const next = numbered ? nextNumber(pattern, setlists, '', t.startNumber) || Number(t.startNumber) || 1 : null;
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
    onSave({ ...t, namePattern: numbered ? `${name} #{n}` : '', templateName: name, name, service: name, isTemplate: true, templateKind: TEMPLATE_KIND, updatedAt: Date.now() }, { previousService: template?.service || templateTitle(template) || '' });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Template · ${title}`} className="fixed inset-0 z-[70] flex flex-col bg-background font-sans text-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <b className="truncate text-[16px]">{t.templateName || 'New template'}</b>
        <Button disabled={!canSave} onClick={save}>Save</Button>
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

          <Caps right={<Switch label="Number the setlists" on={numbered} onChange={v => set({ namePattern: v ? pattern : '' })} />}>Number the setlists</Caps>
          {numbered ? (
            <div className="rounded-card border border-border bg-card">
              <Row label="Start at">
                <Input type="text" inputMode="numeric" pattern="[0-9]*" aria-label="Start at number" value={next} onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()}
                  onChange={e => set({ startNumber: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} className="h-10 w-[96px] font-mono" />
              </Row>
              <p className="m-0 border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
                Setlists are called <b className="font-mono text-foreground">{baseTitle} #{next}</b>, then #{next + 1}, and so on.
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
                    <Input type="number" inputMode="numeric" min={0} max={120} aria-label="Minutes" placeholder="min" value={it.duration || ''}
                      onChange={e => setItems(xs => xs.map((x, j) => (j === i ? { ...x, duration: Math.max(0, Math.min(120, Number(e.target.value) || 0)) } : x)))} className="h-9 w-[64px]" />
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
        {!templates.length && <p className="m-0 px-4 py-5 text-[14px] text-muted-foreground">No templates yet. A template holds a service’s day, time, rehearsal, band parts and order.</p>}
      </div>
      <Button onClick={onNew}><PlusIcon size={16} />New template</Button>
      <p className="m-0 text-[13px] text-muted-foreground">Templates are made here only. Renaming one renames the service on the setlists made with it.</p>
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
