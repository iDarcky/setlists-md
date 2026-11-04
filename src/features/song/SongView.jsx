import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { youtubeId } from '@/lib/coverArt';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, PlusIcon, BackIcon, CalendarIcon } from '@/app/navIcons';

// The song page, built from zero (canvas → "Song, edit and chart"). Pure view:
// Song.jsx works out the facts, /design renders this with samples.
//
// Details first, the chart one tap away: title, then Key ▾ and arrangement ▾
// (small popovers, not drawers), the numbers, then one ink "Open chart". Under
// it: how often you play it, the next service, Listen, how it goes, credits.

const Svg = ({ size = 20, children, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const EditIcon = ({ size = 20 }) => <Svg size={size}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>;
export const MoreIcon = ({ size = 20 }) => <Svg size={size}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></Svg>;
export const ChartIcon = ({ size = 18 }) => <Svg size={size}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></Svg>;
export const FullIcon = ({ size = 18 }) => <Svg size={size}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Svg>;
export const LayersIcon = ({ size = 16 }) => <Svg size={size}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>;
const PlayFill = ({ size = 22 }) => <Svg size={size} fill="currentColor"><path d="M8 5v14l11-7z" /></Svg>;
const XIcon = ({ size = 18 }) => <Svg size={size}><path d="M6 6l12 12M18 6 6 18" /></Svg>;

const chip = 'inline-flex h-9 min-h-0 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-control border-0 px-2.5 font-sans text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring';
const fact = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-raised px-2.5 text-[14px] text-foreground';
const label = 'm-0 px-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
const iconBtn = 'flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

/** Chords / Lyrics: what the chart below the details shows. */
const SHOW = [['chords', 'Chords'], ['lyrics', 'Lyrics']];
export function ShowSwitch({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-control bg-raised p-1">
      {SHOW.map(([id, name]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange?.(id)}
          className={cn('flex h-8 min-h-0 cursor-pointer items-center justify-center rounded-[7px] border-0 px-3.5 font-sans text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === id ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,.25)]' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
          {name}
        </button>
      ))}
    </div>
  );
}

/** Key ▾: − / + by semitone. Leaders can make the new key the song's own. */
export function KeyChip({ shown, original, semis = 0, onStep, onReset, onEveryone }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Key ${shown}, change`} className={cn(chip, 'bg-warning-fill text-[var(--chord)]', semis !== 0 && 'ring-1 ring-[var(--chord)]')}>
          <span className="text-[12px] font-medium opacity-80">Key</span>
          <span className="font-mono text-[15px] font-semibold">{shown}</span>
          <ChevronDownIcon size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[290px] flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-control bg-raised p-1">
          <button type="button" aria-label="Down a semitone" onClick={() => onStep?.(-1)} className={cn(iconBtn, 'text-[22px]')}>−</button>
          <span className="flex items-baseline gap-1.5">
            <b className="font-mono text-[24px] font-semibold text-[var(--chord)]">{shown}</b>
            {semis !== 0 && <span className="text-[13px] text-muted-foreground">was {original}</span>}
          </span>
          <button type="button" aria-label="Up a semitone" onClick={() => onStep?.(1)} className={cn(iconBtn, 'text-[22px]')}>+</button>
        </div>
        {semis === 0 ? (
          <p className="m-0 px-1 text-[13px] leading-[18px] text-muted-foreground">Changes the key on this phone only, until you close the song.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 px-1 text-[13px] leading-[18px] text-muted-foreground">Only you see {shown}. {onEveryone ? 'Everyone else still sees ' + original + '.' : ''}</p>
            {onEveryone && <Button size="sm" onClick={onEveryone}>Make {shown} the key for everyone</Button>}
            <Button size="sm" variant="ghost" onClick={onReset}>Back to {original}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Arrangement ▾: each with its key and tempo; leaders can copy one into a new one. */
export function ArrangementChip({ arrangements = [], current, onPick, onNew, onRename }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(null); // the draft name while renaming
  const cur = arrangements.find(a => a.id === current) || arrangements[0];
  if (!cur || (arrangements.length < 2 && !onNew)) return null;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNaming(null); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Arrangement ${cur.name}, change`} className={cn(chip, 'max-w-[200px] bg-raised text-foreground')}>
          <span className="text-muted-foreground"><LayersIcon /></span>
          <span className="truncate">{cur.name}</span>
          <ChevronDownIcon size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[260px] flex-col p-1.5">
        {naming != null ? (
          <form className="flex flex-col gap-2 p-1.5" onSubmit={(e) => { e.preventDefault(); if (naming.trim()) onRename(naming.trim()); setNaming(null); setOpen(false); }}>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-foreground">Arrangement name
              <Input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} maxLength={40} className="h-10" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNaming(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!naming.trim()}>Save</Button>
            </div>
          </form>
        ) : (<>
        {arrangements.map(a => (
          <button key={a.id} type="button" onClick={() => { onPick?.(a.id); setOpen(false); }}
            className={cn('flex h-12 min-h-0 w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:bg-raised', a.id === cur.id && 'bg-selected hover:bg-selected')}>
            <span className="w-4 shrink-0 text-link">{a.id === cur.id && <CheckIcon size={16} />}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">{a.name}</span>
              <span className="truncate text-[12px] text-muted-foreground">{[a.tempo && `${a.tempo} BPM`, a.capo ? `capo ${a.capo}` : null, a.isDefault && 'default'].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="font-mono text-[14px] font-semibold text-[var(--chord)]">{a.key}</span>
          </button>
        ))}
        {onNew && (
          <>
            <div className="mx-1 my-1 h-px bg-border" />
            <button type="button" onClick={() => { onNew(); setOpen(false); }}
              className="flex h-11 min-h-0 w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[15px] font-medium text-link outline-none hover:bg-raised focus-visible:bg-raised">
              <span className="w-4"><PlusIcon size={16} /></span>New arrangement
            </button>
          </>
        )}
        {onRename && (
          <button type="button" onClick={() => setNaming(cur.name || '')}
            className="flex h-11 min-h-0 w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[15px] font-medium text-foreground outline-none hover:bg-raised focus-visible:bg-raised">
            <span className="w-4" />Rename “{cur.name}”
          </button>
        )}
        </>)}
      </PopoverContent>
    </Popover>
  );
}

/** YouTube's own player, opened in place. It must stay visible: YouTube does not allow audio only. */
function Listen({ url, title, open, onOpen, onClose, compact }) {
  const id = youtubeId(url);
  if (!id) return null;
  if (!open) {
    return (
      <button type="button" onClick={onOpen}
        className="flex min-h-0 w-full cursor-pointer items-center gap-3 rounded-card border border-border bg-card p-2.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
        <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-raised bg-cover bg-center text-white', compact ? 'h-12 w-20' : 'h-14 w-24')}
          style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/mqdefault.jpg)` }}>
          <span className="absolute inset-0 bg-black/30" /><span className="relative"><PlayFill /></span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">Listen</span>
          <span className="truncate text-[13px] text-muted-foreground">YouTube · plays here</span>
        </span>
      </button>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="relative aspect-video min-h-[200px] w-full bg-black">
        <iframe
          title={`${title} on YouTube`}
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
      <div className="flex items-center gap-2 py-1.5 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</span>
        <button type="button" aria-label="Close the player" onClick={onClose} className={iconBtn}><XIcon /></button>
      </div>
    </div>
  );
}

function Stats({ facts, short }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        [facts.plays ? `${facts.plays}×` : '0', short ? 'played' : 'played here'],
        [facts.last || '—', short ? 'last' : 'last time'],
        [facts.usualKey || '—', 'usual key', true],
        [facts.usualTempo || '—', 'usual BPM'],
      ].map(([v, k, isKey]) => (
        <div key={k} className="flex flex-col gap-0.5 rounded-card border border-border bg-card px-3 py-2.5">
          <b className={cn('text-[20px] font-semibold leading-6 tracking-[-0.3px]', isKey && 'font-mono text-[var(--chord)]')}>{v}</b>
          <span className="text-[12px] text-muted-foreground">{k}</span>
        </div>
      ))}
    </div>
  );
}

function NextService({ next, onOpen }) {
  if (!next) return null;
  return (
    <button type="button" onClick={onOpen ? () => onOpen(next.setlist) : undefined} disabled={!onOpen}
      className="flex min-h-0 w-full cursor-pointer items-center gap-3 rounded-card border border-link bg-selected px-3 py-2.5 text-left font-sans text-foreground outline-none disabled:cursor-default focus-visible:ring-2 focus-visible:ring-ring">
      <span className="text-link"><CalendarIcon size={18} /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[15px] font-semibold">{next.label} · {next.name}</b>
        <span className="text-[13px] text-muted-foreground">Song {next.position} in the setlist</span>
      </span>
      {onOpen && <span className="text-muted-foreground"><ChevronRightIcon size={16} /></span>}
    </button>
  );
}

function Flow({ codes }) {
  if (!codes?.length) return null;
  return (
    <>
      <h2 className={label}>How it goes</h2>
      <div className="flex flex-wrap gap-1">
        {codes.map((c, n) => (
          <span key={n} className="flex h-7 min-w-8 items-center justify-center rounded-[7px] bg-selected px-1.5 text-[12px] font-semibold text-link">{c}</span>
        ))}
      </div>
    </>
  );
}

function About({ rows }) {
  if (!rows.length) return null;
  return (
    <>
      <h2 className={label}>About</h2>
      <div className="overflow-hidden rounded-card border border-border bg-card">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-12 items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
            <span className="w-[92px] shrink-0 text-[14px] text-muted-foreground">{k}</span>
            <span className="min-w-0 flex-1 text-[15px]">{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const split = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);

function aboutRows(song) {
  const themes = split(song.themes);
  return [
    song.writers && ['Writers', song.writers],
    (song.copyright || song.ccli) && ['Copyright', [song.copyright, song.ccli && `CCLI ${song.ccli}`].filter(Boolean).join(' · ')],
    song.album && ['Album', [song.album, song.year].filter(Boolean).join(' · ')],
    song.scripture && ['Bible', song.scripture],
    themes.length > 0 && ['Themes', (
      <span className="flex flex-wrap gap-1.5">{themes.map(t => <span key={t} className="rounded-full bg-raised px-2.5 py-0.5 text-[13px]">{t}</span>)}</span>
    )],
  ].filter(Boolean);
}

/** The menu behind ⋯: one row per action. */
export function MenuSheet({ open, onOpenChange, title, items = [] }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-auto sm:max-w-[400px]">
      <div className="flex flex-col overflow-hidden rounded-card border border-border">
        {items.map(it => (
          <button key={it.label} type="button" onClick={() => { onOpenChange?.(false); it.onClick?.(); }}
            className={cn('flex min-h-[52px] w-full cursor-pointer flex-col justify-center border-0 border-t border-border bg-transparent px-4 py-2 text-left font-sans text-[15px] font-medium text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised', it.danger && 'text-danger-text')}>
            {it.label}
            {it.sub && <span className="text-[13px] font-normal text-muted-foreground">{it.sub}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * @param {object} p
 * @param {object} p.song  resolved view of the picked arrangement
 * @param {{shown,original,semis,onStep,onReset,onEveryone}} p.keyCtl
 * @param {{plays,last,usualKey,usualTempo,next}} p.facts
 */
export default function SongView({
  song, keyCtl, arrangements = [], arrangementId, onArrangement, onNewArrangement,
  facts = { plays: 0, last: null, usualKey: '', next: null }, flow = [],
  onBack, backLabel = 'Songs', onEdit, menu = [], onFullScreen, onOpenSetlist,
  show = 'chords', onShow, chart,
  embedded = false, layout = 'auto', listenOpen: listenInit = false,
}) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [listen, setListen] = useState(listenInit);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!song) return null;
  const about = aboutRows(song);
  const by = [song.artist, song.year].filter(Boolean).join(' · ');
  // Same box as the chart's own `wide-container` (12px a side, 1600 max), so
  // the title, the numbers and the first chord all start on one line.
  const page = 'wide-container flex flex-col !px-3';

  // One page, one scroll (owner, 2026-11-04): the details on top, the chart
  // right under them, how it goes and the credits after the song. The chart is
  // passed in (`chart(lead, tail)`): Song.jsx gives it the Reader, which draws
  // `lead` and `tail` inside its own scroller; /design can give it a sample.
  const lead = (
    <div className={cn(page, 'font-sans text-foreground')}>
      <div className="-ml-2.5 -mr-1 flex h-[52px] items-center justify-between gap-1">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex h-11 min-h-0 cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent pl-0.5 pr-2 font-sans text-[15px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-muted-foreground"><BackIcon size={20} /></span>{backLabel}
          </button>
        ) : <span />}
        <span className="flex items-center gap-0.5">
          {onEdit && <button type="button" aria-label="Edit song" onClick={onEdit} className={iconBtn}><EditIcon /></button>}
          {menu.length > 0 && <button type="button" aria-label="More" onClick={() => setMenuOpen(true)} className={iconBtn}><MoreIcon /></button>}
        </span>
      </div>
      <div className="flex flex-col gap-1 pb-3.5 pt-1">
        <h1 className={cn('m-0 font-semibold tracking-[-0.6px]', wide ? 'text-[34px] leading-10' : 'text-[28px] leading-[34px]')}>{song.title || 'Untitled'}</h1>
        {by && <span className="text-[15px] text-muted-foreground">{by}</span>}
      </div>
      <div className="flex flex-wrap gap-2 pb-4">
        {keyCtl && <KeyChip {...keyCtl} />}
        <ArrangementChip arrangements={arrangements} current={arrangementId} onPick={onArrangement} onNew={onNewArrangement} />
        {song.tempo && <span className={fact}>{song.tempo} <small className="text-[12px] font-medium text-muted-foreground">BPM</small></span>}
        {song.time && <span className={fact}>{song.time}</span>}
        {Number(song.capo) > 0 && <span className={fact}>Capo {song.capo}</span>}
      </div>
      <div className={cn('grid gap-2.5 pb-4', wide && 'grid-cols-[minmax(0,1fr)_340px] items-start')}>
        <div className="flex flex-col gap-2.5">
          <Stats facts={facts} short={wide} />
          <NextService next={facts.next} onOpen={onOpenSetlist} />
        </div>
        <Listen url={song.youtube} title={song.title} open={listen} onOpen={() => setListen(true)} onClose={() => setListen(false)} compact />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pb-1 pt-3">
        <ShowSwitch value={show} onChange={onShow} />
        {onFullScreen && <Button variant="ghost" onClick={onFullScreen}><FullIcon />Full screen</Button>}
      </div>
    </div>
  );
  const tail = (flow.length > 0 || about.length > 0) ? (
    <div className={cn(page, 'gap-2.5 border-t border-border pb-10 pt-4 font-sans text-foreground')}>
      <Flow codes={flow} />
      <About rows={about} />
    </div>
  ) : <div className="pb-10" />;

  return (
    <div data-slot="song" className={cn('flex flex-col bg-background', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      {chart ? chart(lead, tail) : <div className="min-h-0 flex-1 overflow-y-auto">{lead}{tail}</div>}
      <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} title={song.title} items={menu} />
    </div>
  );
}
