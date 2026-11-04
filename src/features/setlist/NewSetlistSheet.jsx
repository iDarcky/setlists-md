import { useMemo, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { templatesOf, templateTitle, draftFromTemplate, draftFromSetlist, recentSetlists, dayLabel, blankTemplate } from '@/lib/newSetlist';
import { TemplateEditor, TemplatesSheet } from './TemplateEditor';
import { readNewDraft, writeNewDraft } from '@/lib/setlistDraft';

// "+ New setlist" (canvas → New setlist v2, V2Popup): pick a template, copy a
// past setlist (its shape: moments stay, songs become empty slots), or start
// empty. With no template yet, a card asks a leader to set one up first. The next free date
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

const countLine = (items = []) => {
  const songs = items.filter(i => i && i.type !== 'break').length;
  const moments = items.filter(i => i?.type === 'break').length;
  return [songs && `${songs} ${songs === 1 ? 'song' : 'songs'}`, moments && `${moments} ${moments === 1 ? 'moment' : 'moments'}`].filter(Boolean).join(', ');
};

export function NewSetlistBody({ setlists = [], onCreate, onEditTemplates, onNewTemplate, space = 'personal' }) {
  const templates = useMemo(() => templatesOf(setlists), [setlists]);
  const recent = useMemo(() => recentSetlists(setlists), [setlists]);
  const drafts = useMemo(() => Object.fromEntries(templates.map(t => [t.id, draftFromTemplate(t, setlists)])), [templates, setlists]);
  // A setlist started here earlier and never saved (the app was closed).
  const [kept] = useState(() => { const d = readNewDraft(space); return d && !setlists.some(s => s.id === d.id) ? d : null; });
  const [pick, setPick] = useState(kept ? 'kept' : (templates[0]?.id || 'blank'));
  const [copyId, setCopyId] = useState(null);
  const canContinue = pick !== 'copy' || !!copyId;
  const create = () => {
    if (pick === 'kept' && kept) { onCreate(kept); return; }
    if (kept) writeNewDraft(space, null);
    if (pick === 'copy') {
      const src = recent.find(s => s.id === copyId);
      if (src) { onCreate(draftFromSetlist(src, setlists)); return; }
    }
    const tpl = templates.find(t => t.id === pick) || null;
    onCreate(tpl ? drafts[tpl.id] : draftFromTemplate(null, setlists));
  };
  return (
    <div className="flex flex-col gap-3 font-sans">
      {!templates.length && onNewTemplate && (
        <div className="flex flex-col gap-2 rounded-card border border-link bg-selected px-4 py-3">
          <b className="text-[16px]">Set up your Sunday once</b>
          <p className="m-0 text-[14px] text-muted-foreground">A template fills in the day, time, rehearsal, band and order of service every week.</p>
          <Button className="h-11 self-start" onClick={onNewTemplate}>New template</Button>
        </div>
      )}
      <p className="m-0 -mt-1 text-[13px] text-muted-foreground">{templates.length ? 'Pick a template. Everything in it can be changed after.' : 'Or start without one.'}</p>
      <div role="radiogroup" aria-label="Start from" className="flex flex-col gap-2">
        {kept && (
          <Row on={pick === 'kept'} onPick={() => setPick('kept')} title="Continue your setlist"
            sub={[kept.name, dayLabel(kept.date), `${(kept.items || []).filter(i => i?.songId).length} songs`].filter(Boolean).join(' · ')} />
        )}
        {templates.map(t => {
          const d = drafts[t.id];
          return (
            <Row key={t.id} on={pick === t.id} onPick={() => setPick(t.id)} title={templateTitle(t)}
              sub={[dayLabel(d.date), d.time, d.location].filter(Boolean).join(' · ')}
              name={d.name && d.name !== templateTitle(t) ? d.name : ''} />
          );
        })}
        {recent.length > 0 && (
          <Row on={pick === 'copy'} onPick={() => { setPick('copy'); if (!copyId) setCopyId(recent[0].id); }} title="Copy a past setlist"
            sub="Its times and moments, songs left empty" />
        )}
        {pick === 'copy' && (
          <div role="radiogroup" aria-label="Setlist to copy" className="ml-8 flex flex-col">
            {recent.map(sl => (
              <button key={sl.id} type="button" role="radio" aria-checked={copyId === sl.id} onClick={() => setCopyId(sl.id)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 border-0 border-t border-solid border-border bg-transparent px-1 py-2 text-left font-sans text-foreground outline-none first:border-t-0 focus-visible:bg-raised">
                <span className={cn('size-4 shrink-0 rounded-full border-2', copyId === sl.id ? 'border-[5px] border-link' : 'border-input')} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{sl.name || sl.service || 'Setlist'}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{[dayLabel(sl.date), sl.time, countLine(sl.items)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <Row on={pick === 'blank'} onPick={() => setPick('blank')} title="Empty setlist" sub="No band, no order" />
      </div>
      {onEditTemplates && templates.length > 0 && <Button variant="link" className="self-start text-[14px]" onClick={onEditTemplates}>Edit templates</Button>}
      <Button className="h-12" disabled={!canContinue} onClick={create}>Continue</Button>
    </div>
  );
}

export default function NewSetlistSheet({ open, onOpenChange, setlists = [], onCreate, onSaveTemplate, onDeleteTemplate, space = 'personal' }) {
  const [list, setList] = useState(false);
  const [edit, setEdit] = useState(null);
  // The "Set up your Sunday" card: after saving, go straight on into a new
  // setlist made from that template.
  const [thenCreate, setThenCreate] = useState(false);
  const saved = useMemo(() => templatesOf(setlists), [setlists]);
  return (
    <>
      <Sheet open={open && !list && !edit} onOpenChange={onOpenChange} title="New setlist" className="h-auto max-h-[90dvh] sm:max-w-[480px]">
        {open && <NewSetlistBody space={space} setlists={setlists} onCreate={onCreate} onEditTemplates={onSaveTemplate ? () => setList(true) : null}
          onNewTemplate={onSaveTemplate ? () => { setThenCreate(true); setEdit(blankTemplate()); } : null} />}
      </Sheet>
      <TemplatesSheet open={open && list} onOpenChange={setList} templates={saved}
        onEdit={(t) => { setList(false); setEdit(t); }} onNew={() => { setList(false); setEdit(blankTemplate()); }} />
      {open && edit && (
        <TemplateEditor template={edit} setlists={setlists} onCancel={() => { setEdit(null); setThenCreate(false); }}
          onSave={(tpl, meta) => {
            onSaveTemplate?.(tpl, meta);
            setEdit(null);
            if (thenCreate) { setThenCreate(false); onCreate(draftFromTemplate(tpl, setlists)); }
          }}
          onDelete={templatesOf(setlists).some(t => t.id === edit.id) && onDeleteTemplate ? () => { onDeleteTemplate(edit.id); setEdit(null); } : null} />
      )}
    </>
  );
}
