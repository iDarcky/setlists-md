import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { toggleVariants } from '@/ui/shadcn/toggle';
import { normalizeText } from '@/lib/search';


// A new song's details: name, artist, key and BPM (required), then Time and,
// behind More, Length and YouTube. One form, two homes: step two of the
// "Add a song" sheet (user, 13 Nov: continue where you are, then the editor
// gets the whole screen), and the editor's own first step when a new song is
// opened from anywhere else.

const menuRow = 'flex h-11 min-h-0 w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[15px] text-foreground outline-none hover:bg-raised focus-visible:bg-raised';
const ph = 'placeholder:text-muted-foreground/50';

export function Field({ label, children, hint, required = false }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">{label}{required && <span aria-hidden className="text-foreground"> *</span>}{hint && <span className="font-normal"> · {hint}</span>}</span>
      {children}
    </label>
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
          <button key={l} type="button" role="radio" aria-checked={letter === l} {...chip(letter === l, 'min-w-0 px-0 text-[15px]')} onClick={() => put(l, acc, minor)}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <div role="radiogroup" aria-label="Sharp or flat" className="flex gap-1.5">
          {[['', '♮', 'Natural'], ['b', '♭', 'Flat'], ['#', '♯', 'Sharp']].map(([a, sym, label]) => (
            <button key={label} type="button" role="radio" aria-checked={acc === a} aria-label={label} title={label} disabled={!!letter && a !== '' && NO_KEY.has(letter + a)}
              {...chip(acc === a, 'text-[18px]')} onClick={() => { setAcc(a); put(letter, a, minor); }}>{sym}</button>
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
  // Empty: your most used artists. Typing: the ones that match, accents ignored.
  const hits = artists.filter(a => { const n = normalizeText(a); return !have.has(n) && (q ? n.includes(q) && n !== q : true); }).slice(0, 6);
  const pick = (a) => { onChange(before ? `${before.replace(/\s*$/, '')} ${a}` : a); setOpen(false); };
  return (
    <div className="relative">
      <Input value={v} maxLength={120} placeholder="Artist or band, commas between several" className={className} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} />
      {open && hits.length > 0 && (
        <div role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-control border border-border bg-card p-1.5 shadow-lg">
          {hits.map(a => <button key={a} type="button" role="option" aria-selected="false" className={menuRow} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)}>{a}</button>)}
        </div>
      )}
    </div>
  );
}

/** The fields. `value` holds title, artist, key, tempo, time, duration, youtube. */
export function NewSongForm({ value, onChange, artists = [], sameTitle = null, autoFocus = true }) {
  const [more, setMore] = useState(!!(value.duration || value.youtube));
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Name" required><Input value={value.title ?? ''} maxLength={120} onChange={set('title')} autoFocus={autoFocus && !value.title} placeholder="Amazing Grace" className={ph} /></Field>
      {sameTitle && <p className="-mt-2 m-0 text-[13px] text-[var(--chord)]">You already have {sameTitle.title}{sameTitle.artist ? ` by ${sameTitle.artist}` : ''}.</p>}
      <Field label="Artist" required><ArtistInput value={value.artist} artists={artists} className={ph} onChange={(artist) => onChange({ ...value, artist })} /></Field>
      <Field label="Original key" required><KeyGrid value={value.key || ''} onPick={(key) => onChange({ ...value, key })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="BPM" required><Input inputMode="numeric" maxLength={3} value={value.tempo ?? ''} placeholder="72" className={ph}
          onChange={(e) => onChange({ ...value, tempo: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) || null })} /></Field>
        <Field label="Time"><Input maxLength={5} value={value.time ?? ''} placeholder="4/4" className={ph} onChange={set('time')} /></Field>
      </div>
      {more ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Length"><Input maxLength={5} value={value.duration ?? ''} placeholder="3:45" className={ph} onChange={set('duration')} /></Field>
          <div className="col-span-2"><Field label="YouTube link"><Input value={value.youtube ?? ''} maxLength={300} inputMode="url" placeholder="youtube.com/watch?v=…" className={ph} onChange={set('youtube')} /></Field></div>
          <p className="col-span-2 m-0 text-[13px] text-muted-foreground">Credits, tags and the rest are on the Info tab, any time.</p>
        </div>
      ) : (
        <Button type="button" variant="outline" className="self-start" onClick={() => setMore(true)}>More</Button>
      )}
    </div>
  );
}
