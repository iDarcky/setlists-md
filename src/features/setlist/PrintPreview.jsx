import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { cn } from '@/ui/shadcn/utils';
import { PRINT_LOOK, applyPrintLook, fitPrintPreview } from '@/pdf/printSetlist';

// The print preview: a top bar (Close · title · Print), then — for Charts — the
// look strip a leader asked to have back ("can't I change things when I print
// any more? make it bigger, no chords…"): Text size, Chords or Lyrics only,
// Columns, Repeats. Each change paints the preview at once, through classes on
// the print document's <body>, so the page never reloads or loses its scroll.
// The look is remembered on this device.

const KEY = 'setlists-md:print-look';

function readLook() {
  let look = { ...PRINT_LOOK };
  try {
    // The drawer's old "Two columns for charts" switch becomes the first Columns choice.
    const old = JSON.parse(localStorage.getItem('setlists-md:print-choice') || '{}');
    if (old.twoColumns === false) look.cols = 1;
    look = { ...look, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch { /* private mode or a bad value: the defaults */ }
  return look;
}

function saveLook(look) {
  try { localStorage.setItem(KEY, JSON.stringify(look)); } catch { /* private mode */ }
}

const SIZES = [['s', 'Small', 12], ['m', 'Normal', 14], ['l', 'Large', 17], ['xl', 'Extra large', 20]];

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex h-10 rounded-control border border-border bg-raised p-0.5">
        {options.map(o => {
          const on = o.value === value;
          return (
            <button key={String(o.value)} type="button" role="radio" aria-checked={on} aria-label={o.aria || undefined}
              onClick={() => onChange(o.value)}
              className={cn('flex h-full min-h-0 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border-0 px-3 font-sans text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'bg-background text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Cols = ({ n }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    {n === 1 ? <path d="M6 6h12M6 10h12M6 14h12M6 18h8" /> : <path d="M3 6h7M3 10h7M3 14h7M14 6h7M14 10h7M14 14h7M3 18h5M14 18h5" />}
  </svg>
);

// What goes ON the printout — band notes, who leads each song. These were two
// switches in the Print sheet before the preview; the owner wanted them beside
// the page they change (QA 11 Nov): "options inside the print menu".
export function ContentStrip({ look, onChange, hasLeads = true }) {
  const set = (k) => (v) => onChange({ ...look, [k]: v });
  return (
    <>
      <Segmented label="Band notes" value={look.notes !== false} onChange={set('notes')}
        options={[{ value: true, label: 'Show' }, { value: false, label: 'Hide' }]} />
      {hasLeads && (
        <Segmented label="Who leads" value={look.leads !== false} onChange={set('leads')}
          options={[{ value: true, label: 'Show' }, { value: false, label: 'Hide' }]} />
      )}
    </>
  );
}

export function LookStrip({ look, onChange, content = false, hasLeads = true }) {
  const set = (k) => (v) => onChange({ ...look, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:items-end sm:justify-center sm:gap-5">
      {content && <ContentStrip look={look} onChange={onChange} hasLeads={hasLeads} />}
      <Segmented label="Text size" value={look.size} onChange={set('size')}
        options={SIZES.map(([value, aria, px]) => ({ value, aria, label: <span style={{ fontSize: px, lineHeight: 1 }} className="font-semibold">A</span> }))} />
      <Segmented label="Chart" value={look.chords !== false} onChange={set('chords')}
        options={[{ value: true, label: 'Chords' }, { value: false, label: 'Lyrics only' }]} />
      <Segmented label="Columns" value={look.cols === 1 ? 1 : 2} onChange={set('cols')}
        options={[{ value: 1, aria: 'One column', label: <><Cols n={1} />1</> }, { value: 2, aria: 'Two columns', label: <><Cols n={2} />2</> }]} />
      <Segmented label="Repeated parts" value={!!look.repeats} onChange={set('repeats')}
        options={[{ value: false, label: 'Once' }, { value: true, label: 'Every time' }]} />
    </div>
  );
}

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const PrintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" /></svg>
);

/**
 * The screen. `build(look)` returns the print document; it is built once, and
 * later look changes are painted onto it. `embedded` sizes it to its parent
 * (the /design page) instead of the window.
 */
export function PrintPreviewView({ title, kind, charts, build, onClose, embedded = false, initialLook, content = false, hasLeads = true }) {
  const [look, setLook] = useState(() => initialLook || readLook());
  const frameRef = useRef(null);
  // Built with the look it opened with; later LOOK changes are painted, not
  // rebuilt. Notes and who-leads change what is ON the page, so those two
  // rebuild it.
  const contentKey = `${look.notes !== false}|${look.leads !== false}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => build(look), [contentKey]);

  useEffect(() => { applyPrintLook(frameRef.current?.contentDocument, look); }, [look]);

  // Keep the A4 page fitted to the window as it turns or resizes.
  useEffect(() => {
    const fit = () => fitPrintPreview(frameRef.current?.contentDocument);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (embedded) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [embedded, onClose]);

  const change = (next) => { setLook(next); if (!embedded) saveLook(next); };
  const print = () => {
    const w = frameRef.current?.contentWindow;
    w?.focus();
    w?.print();
  };

  return (
    <div role="dialog" aria-modal={embedded ? undefined : true} aria-label="Print preview"
      className={cn('flex flex-col bg-background font-sans text-foreground', embedded ? 'h-full' : 'fixed inset-0 z-[999999]')}>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-3 pb-3 pt-[max(8px,env(safe-area-inset-top))] sm:px-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><XIcon /></Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[16px] font-semibold">{title}</span>
            <span className="text-caption text-muted-foreground">{kind || (charts ? 'Charts' : 'Order sheet')} · print or save as PDF</span>
          </div>
          <Button onClick={print}><PrintIcon />Print</Button>
        </div>
        {charts
          ? <LookStrip look={look} onChange={change} content={content} hasLeads={hasLeads} />
          : content && (
            <div className="grid grid-cols-2 gap-x-3 sm:flex sm:justify-center sm:gap-5">
              <ContentStrip look={look} onChange={change} hasLeads={hasLeads} />
            </div>
          )}
      </div>
      <iframe ref={frameRef} title="Print preview" srcDoc={html}
        onLoad={() => { const d = frameRef.current?.contentDocument; applyPrintLook(d, look); fitPrintPreview(d); }}
        className="min-h-0 w-full flex-1 border-0 bg-[#E9E6E0]" />
    </div>
  );
}
