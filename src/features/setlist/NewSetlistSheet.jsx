import { useMemo, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { templatesOf, serviceTemplates, templateTitle, draftFromTemplate, dayLabel, blankTemplate } from '@/lib/newSetlist';
import { TemplateEditor, TemplatesSheet } from './TemplateEditor';

// "+ New setlist" (canvas → New setlist v2, V2Popup): pick a template — each
// service the church runs is one — or an empty setlist. The next free date
// and the automatic name are already worked out; Continue opens Details and
// band with the draft. Nothing is saved until the flow saves it.

function Row({ on, title, sub, name, onPick }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick}
      className={cn('flex w-full cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-link bg-selected' : 'border-border bg-transparent hover:bg-raised/50')}>
      <span className={cn('size-5 shrink-0 rounded-full border-2', on ? 'border-[6px] border-link' : 'border-input')} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16px] font-semibold">{title}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
        {name && <span className="truncate font-mono text-[12px] text-foreground">{name}</span>}
      </span>
    </button>
  );
}

export function NewSetlistBody({ setlists = [], onCreate, onEditTemplates }) {
  const templates = useMemo(() => [...templatesOf(setlists), ...serviceTemplates(setlists)], [setlists]);
  const drafts = useMemo(() => Object.fromEntries(templates.map(t => [t.id, draftFromTemplate(t, setlists)])), [templates, setlists]);
  const [pick, setPick] = useState(templates[0]?.id || 'blank');
  const create = () => {
    const tpl = templates.find(t => t.id === pick) || null;
    onCreate(tpl ? drafts[tpl.id] : draftFromTemplate(null, setlists));
  };
  return (
    <div className="flex flex-col gap-3 font-sans">
      <p className="m-0 -mt-1 text-[13px] text-muted-foreground">Pick a template. Everything in it can be changed after.</p>
      <div role="radiogroup" aria-label="Start from" className="flex flex-col gap-2">
        {templates.map(t => {
          const d = drafts[t.id];
          return (
            <Row key={t.id} on={pick === t.id} onPick={() => setPick(t.id)} title={templateTitle(t)}
              sub={[dayLabel(d.date), d.time, d.location].filter(Boolean).join(' · ')}
              name={d.name && d.name !== templateTitle(t) ? d.name : ''} />
          );
        })}
        <Row on={pick === 'blank'} onPick={() => setPick('blank')} title="Empty setlist" sub="No band, no order" />
      </div>
      {onEditTemplates && <Button variant="link" className="self-start text-[14px]" onClick={onEditTemplates}>Edit templates</Button>}
      <Button className="h-12" onClick={create}>Continue</Button>
    </div>
  );
}

export default function NewSetlistSheet({ open, onOpenChange, setlists = [], onCreate, onSaveTemplate, onDeleteTemplate }) {
  const [list, setList] = useState(false);
  const [edit, setEdit] = useState(null);
  const saved = useMemo(() => [...templatesOf(setlists), ...serviceTemplates(setlists)], [setlists]);
  return (
    <>
      <Sheet open={open && !list && !edit} onOpenChange={onOpenChange} title="New setlist" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
        {open && <NewSetlistBody setlists={setlists} onCreate={onCreate} onEditTemplates={onSaveTemplate ? () => setList(true) : null} />}
      </Sheet>
      <TemplatesSheet open={open && list} onOpenChange={setList} templates={saved}
        onEdit={(t) => { setList(false); setEdit(t); }} onNew={() => { setList(false); setEdit(blankTemplate()); }} />
      {open && edit && (
        <TemplateEditor template={edit} setlists={setlists} onCancel={() => setEdit(null)}
          onSave={(tpl, meta) => { onSaveTemplate?.(tpl, meta); setEdit(null); }}
          onDelete={!edit.virtual && templatesOf(setlists).some(t => t.id === edit.id) && onDeleteTemplate ? () => { onDeleteTemplate(edit.id); setEdit(null); } : null} />
      )}
    </>
  );
}
