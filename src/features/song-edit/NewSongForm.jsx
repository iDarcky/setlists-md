import { useState } from 'react';
import { menuItemClass } from '@/ui/shadcn/menu';
import { cn } from '@/ui/shadcn/utils';
import { Input } from '@/ui/shadcn/input';
import { toggleVariants } from '@/ui/shadcn/toggle';
import { normalizeText } from '@/lib/search';
import { sameSongLine } from './newSongDetails';


// A new song's details: name, artist, key and BPM (required), then Time as
// chips. No More: length and YouTube live on the Info tab (owner, 2026-11-20).
// One form, two homes: the New song sheet (continue where you are, then the
// editor gets the whole screen), and the editor's own first step when a new
// song is opened from anywhere else.

const menuRow = menuItemClass;
const ph = 'placeholder:text-muted-foreground/50';

// `group`: a row of buttons (key, time), so a div, not a <label>: tapping a
// label's text would press its first button.
export function Field({ label, children, hint, required = false, group = false }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="flex min-w-0 flex-col gap-1.5" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="text-small font-medium text-muted-foreground">{label}{required && <span aria-hidden className="text-foreground"> *</span>}{hint && <span className="font-normal"> · {hint}</span>}</span>
      {children}
    </Tag>
  );
}


/**
 * Pick a key in three small rows: the letter, then natural / flat / sharp,
 * then major / minor. Seven letters read faster than 24 buttons.
 */
const KEY_RE = /^([A-G])([b#]?)(m?)$/;
const NO_KEY = new Set(['E#', 'B#', 'Fb', 'Cb']);
export function KeyGrid({ value, onPick }) {
  const m = KEY_RE.exec(value || '');
  const [acc, setAcc] = useState(m ? m[2] : '');
  const [minor, setMinor] = useState(m ? m[3] === 'm' : false);
  const letter = m ? m[1] : null;
  const put = (l, a, mi) => { if (!l) return; const k = NO_KEY.has(l + a) ? l : l + a; onPick(k + (mi ? 'm' : '')); };
  // The app's own chips (ui/shadcn/toggle): picked = soft fill + accent edge.
  const chip = (on, extra) => ({ 'data-state': on ? 'on' : 'off', className: cn(toggleVariants({ variant: 'chip' }), 'min-w-11 justify-center', extra) });
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Key letter" className="grid grid-cols-[repeat(7,minmax(0,2.75rem))] gap-1.5">
        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(l => (
          <button key={l} type="button" role="radio" aria-checked={letter === l} {...chip(letter === l, 'min-w-0 px-0 text-body')} onClick={() => put(l, acc, minor)}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <div role="radiogroup" aria-label="Sharp or flat" className="flex gap-1.5">
          {[['', '♮', 'Natural'], ['b', '♭', 'Flat'], ['#', '♯', 'Sharp']].map(([a, sym, label]) => (
            <button key={label} type="button" role="radio" aria-checked={acc === a} aria-label={label} title={label} disabled={!!letter && a !== '' && NO_KEY.has(letter + a)}
              {...chip(acc === a, 'text-heading')} onClick={() => { setAcc(a); put(letter, a, minor); }}>{sym}</button>
          ))}
        </div>
        <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
        <div role="radiogroup" aria-label="Major or minor" className="flex gap-1.5">
          {[[false, 'Major'], [true, 'Minor']].map(([mi, label]) => (
            <button key={label} type="button" role="radio" aria-checked={minor === mi} {...chip(minor === mi)} onClick={() => { setMinor(mi); put(letter, acc, mi); }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Artist, with the library's own artists offered as you type. */
export function ArtistInput({ value, onChange, artists, className }) {
  const [open, setOpen] = useState(false);
  // Several artists go in one field with commas: suggest for the one being typed.
  const v = value || '';
  const cut = v.lastIndexOf(',');
  const before = cut >= 0 ? v.slice(0, cut + 1) : '';
  const q = normalizeText(v.slice(cut + 1)).trim();
  const have = new Set(before.split(',').map(x => normalizeText(x).trim()).filter(Boolean));
  // Empty: every artist, most used first. Typing: the ones that match, accents
  // ignored. All of them, in a list that scrolls (owner, 2026-11-18).
  const hits = artists.filter(a => { const n = normalizeText(a); return !have.has(n) && (q ? n.includes(q) && n !== q : true); });
  const pick = (a) => { onChange(before ? `${before.replace(/\s*$/, '')} ${a}` : a); setOpen(false); };
  return (
    <div className="relative">
      <Input value={v} maxLength={120} placeholder="Artist or band, commas between several" className={className} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} />
      {open && hits.length > 0 && (
        <div role="listbox" className="absolute inset-x-0 top-full z-menu mt-1 flex max-h-[min(264px,40dvh)] flex-col overflow-y-auto overscroll-contain rounded-card material-menu p-1.5">
          {hits.map(a => <button key={a} type="button" role="option" aria-selected="false" className={cn(menuRow, 'shrink-0')} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)}>{a}</button>)}
        </div>
      )}
    </div>
  );
}

/** Time as chips: the four a worship band plays, then Other for the rest. */
const TIMES = ['4/4', '3/4', '6/8', '12/8'];
export function TimeChips({ value, onChange }) {
  const [other, setOther] = useState(!!value && !TIMES.includes(value));
  const chip = (on, extra) => ({ 'data-state': on ? 'on' : 'off', className: cn(toggleVariants({ variant: 'chip' }), 'min-w-12 justify-center', extra) });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div role="radiogroup" aria-label="Time signature" className="flex flex-wrap gap-1.5">
        {TIMES.map(t => (
          <button key={t} type="button" role="radio" aria-checked={!other && value === t} {...chip(!other && value === t, 'font-mono')}
            onClick={() => { setOther(false); onChange(t); }}>{t}</button>
        ))}
        <button type="button" role="radio" aria-checked={other} {...chip(other)}
          onClick={() => { setOther(true); if (TIMES.includes(value)) onChange(''); }}>Other</button>
      </div>
      {other && <Input autoFocus maxLength={5} value={value ?? ''} placeholder="5/4" aria-label="Other time" className={cn(ph, 'w-20 font-mono')} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/** The fields. `value` holds title, artist, key, tempo, time. */
export function NewSongForm({ value, onChange, artists = [], sameTitle = null, autoFocus = true }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" required><Input value={value.title ?? ''} maxLength={120} onChange={set('title')} autoFocus={autoFocus && !value.title} placeholder="Amazing Grace" className={ph} /></Field>
      {sameTitle && <p className="-mt-2.5 m-0 text-small text-[var(--chord)]">{sameSongLine(sameTitle)}</p>}
      <Field label="Artist" required><ArtistInput value={value.artist} artists={artists} className={ph} onChange={(artist) => onChange({ ...value, artist })} /></Field>
      <Field label="Original key" required group><KeyGrid value={value.key || ''} onPick={(key) => onChange({ ...value, key })} /></Field>
      <Field label="BPM" required><Input inputMode="numeric" maxLength={3} value={value.tempo ?? ''} placeholder="72" className={cn(ph, 'w-28')}
        onChange={(e) => onChange({ ...value, tempo: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) || null })} /></Field>
      <Field label="Time" group><TimeChips value={value.time ?? ''} onChange={(time) => onChange({ ...value, time })} /></Field>
    </div>
  );
}
