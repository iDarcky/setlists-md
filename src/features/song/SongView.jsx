import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Sheet } from '@/ui/shadcn/sheet';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { youtubeId } from '@/lib/coverArt';
import { ChevronDownIcon, CheckIcon, PlusIcon, BackIcon } from '@/app/navIcons';
import { Cover, Fact, MetaLine, Played, SongMap } from './SongParts';

// The song page, built from zero (canvas → "Song, edit and chart"). Pure view:
// Song.jsx works out the facts, /design renders this with samples.
//
// Details first, the chart one tap away: title, then Key ▾ and arrangement ▾
// (small popovers, not drawers), the numbers, then one ink "Open chart". Under
// it: how often you play it, the next service, Listen, credits.

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
// Group names in sentence case (QA 11 Nov: the capitals read as generated).
const group = 'm-0 px-1 pt-4 text-[13px] font-medium text-muted-foreground';
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
export function KeyChip({ shown, original, semis = 0, onStep, onReset, onEveryone, variant = 'chip' }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'inline' ? (
          // In the one-line numbers: "Key G", the key gold and dotted, a tap changes it.
          <button type="button" aria-label={`Key ${shown}, change`} className="inline-flex h-8 min-h-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[6px] border-0 bg-transparent px-1 -mx-1 font-sans text-[14px] outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
            <b className="font-semibold text-foreground">Key</b>
            <span className="border-b border-dotted border-warning-text font-mono font-semibold text-warning-text">{shown}</span>
            {semis !== 0 && <span className="text-[12px] text-muted-foreground">(was {original})</span>}
          </button>
        ) : (
          <button type="button" aria-label={`Key ${shown}, change`} className={cn(chip, 'bg-warning-fill text-warning-text', semis !== 0 && 'ring-1 ring-warning-text')}>
            <span className="text-[12px] font-medium opacity-80">Key</span>
            <span className="font-mono text-[15px] font-semibold">{shown}</span>
            <ChevronDownIcon size={14} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="flex w-[290px] flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-control bg-raised p-1">
          <button type="button" aria-label="Down a semitone" onClick={() => onStep?.(-1)} className={cn(iconBtn, 'text-[22px]')}>−</button>
          <span className="flex items-baseline gap-1.5">
            <b className="font-mono text-[24px] font-semibold text-warning-text">{shown}</b>
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
export function ArrangementChip({ arrangements = [], current, onPick, onNew, onRename, variant = 'chip' }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(null); // the draft name while renaming
  const cur = arrangements.find(a => a.id === current) || arrangements[0];
  if (!cur || (arrangements.length < 2 && !onNew)) return null;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNaming(null); }}>
      <PopoverTrigger asChild>
        {variant === 'pill' ? (
          // The outlined pill MultiTracks uses for "Original master".
          <button type="button" aria-label={`Arrangement ${cur.name}, change`}
            className="inline-flex h-7 min-h-0 max-w-[180px] cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-foreground bg-transparent px-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">{cur.name}</span>
            <ChevronDownIcon size={12} />
          </button>
        ) : (
          <button type="button" aria-label={`Arrangement ${cur.name}, change`} className={cn(chip, 'max-w-[200px] bg-raised text-foreground')}>
            <span className="text-muted-foreground"><LayersIcon /></span>
            <span className="truncate">{cur.name}</span>
            <ChevronDownIcon size={14} />
          </button>
        )}
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
            <span className="font-mono text-[14px] font-semibold text-warning-text">{a.key}</span>
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

function About({ rows }) {
  if (!rows.length) return null;
  return (
    <>
      <h2 className={group}>Credits</h2>
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
    !song.album && song.year && ['Year', song.year],
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

/** Chart · Lyrics · Details: underlined, like MultiTracks. */
const TABS = [['chords', 'Chart'], ['lyrics', 'Lyrics'], ['details', 'Details']];
function Tabs({ value, onChange, right }) {
  return (
    <div className="flex items-end border-b border-border">
      <div role="tablist" aria-label="Show" className="flex flex-1 gap-1">
        {TABS.map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange?.(id)}
            className={cn('h-11 min-h-0 cursor-pointer border-0 bg-transparent px-3 font-sans text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === id ? 'font-medium text-foreground shadow-[inset_0_-2px_0_var(--foreground)]' : 'text-muted-foreground hover:text-foreground')}>
            {name}
          </button>
        ))}
      </div>
      {right}
    </div>
  );
}

/**
 * The song page (QA 11 Nov rebuild, mockup "Song page"): cover, title and
 * artist with ▶ and ⋯; one line of numbers with the arrangement as an
 * outlined pill and the key tappable; the play sentence for leaders; the
 * song map; then Chart · Lyrics · Details.
 *
 * @param {object} p
 * @param {object} p.song  resolved view of the picked arrangement
 * @param {{shown,original,semis,onStep,onReset,onEveryone}} p.keyCtl
 * @param {{plays,last,usualKey,usualTempo,next}} p.facts
 */
export default function SongView({
  song, keyCtl, arrangements = [], arrangementId, onArrangement, onNewArrangement,
  facts = { plays: 0, last: null, usualKey: '', next: null }, flow = [], leader = false,
  onBack, backLabel = 'Songs', onEdit, menu = [], onFullScreen,
  show = 'chords', onShow, chart,
  embedded = false, layout = 'auto', listenOpen: listenInit = false,
}) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [listen, setListen] = useState(listenInit);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!song) return null;
  const about = aboutRows(song);
  const hasYoutube = !!youtubeId(song.youtube);
  const length = song.duration || song.length;
  // Same box as the chart's own `wide-container` (12px a side, 1600 max).
  const page = 'wide-container flex flex-col !px-3';
  const round = 'flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-foreground bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

  const lead = (
    <div className="font-sans text-foreground">
      <div className="bg-[radial-gradient(120%_90%_at_15%_0%,rgba(122,168,156,.18)_0%,transparent_70%)]">
        <div className={page}>
          <div className="-mx-1 flex items-center pt-2">
            {onBack && <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className={iconBtn}><BackIcon size={20} /></button>}
            <span className="flex-1" />
            {onEdit && <button type="button" aria-label="Edit song" onClick={onEdit} className={iconBtn}><EditIcon /></button>}
          </div>
          <div className={cn('flex items-end gap-4 pt-1', wide && 'gap-6')}>
            <Cover song={song} size={wide ? 160 : 104} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className={cn('m-0 font-semibold tracking-[-0.4px]', wide ? 'text-[34px] leading-10' : 'text-[26px] leading-[30px]')}>{song.title || 'Untitled'}</h1>
              {song.artist && <span className={cn('text-muted-foreground', wide ? 'text-[18px]' : 'text-[16px]')}>{song.artist}</span>}
              <div className="flex gap-2.5 pt-2.5">
                {hasYoutube && <button type="button" aria-label="Listen" title="Listen" onClick={() => { onShow?.('details'); setListen(true); }} className={round}><PlayFill size={18} /></button>}
                {menu.length > 0 && <button type="button" aria-label="More" onClick={() => setMenuOpen(true)} className={round}><MoreIcon /></button>}
              </div>
            </div>
          </div>
          <MetaLine className="pt-4">
            <ArrangementChip variant="pill" arrangements={arrangements} current={arrangementId} onPick={onArrangement} onNew={onNewArrangement} />
            {keyCtl ? <KeyChip variant="inline" {...keyCtl} /> : <Fact label="Key">{song.key}</Fact>}
            <Fact label="BPM">{song.tempo}</Fact>
            <Fact label="Time">{song.time}</Fact>
            <Fact label="Length">{length}</Fact>
            <Fact label="Capo">{Number(song.capo) > 0 ? song.capo : null}</Fact>
          </MetaLine>
          {leader && <Played facts={facts} className="pt-3" />}
          <SongMap codes={flow} className="pb-4 pt-3.5" />
        </div>
      </div>
      <div className={page}>
        <Tabs value={show} onChange={onShow}
          right={show !== 'details' && onFullScreen ? <button type="button" aria-label="Full screen" title="Full screen" onClick={onFullScreen} className={cn(iconBtn, 'mb-0.5 text-muted-foreground')}><FullIcon /></button> : null} />
      </div>
    </div>
  );

  const details = (
    <div className={cn(page, 'gap-2.5 pb-10 font-sans text-foreground', wide && 'max-w-[720px]')}>
      {hasYoutube && <><h2 className={group}>Listen</h2><Listen url={song.youtube} title={song.title} open={listen} onOpen={() => setListen(true)} onClose={() => setListen(false)} compact /></>}
      {song.notes && (
        <>
          <h2 className={group}>Notes for the band</h2>
          <p className="m-0 whitespace-pre-wrap rounded-card border border-border bg-card px-4 py-3 text-[15px] leading-[22px]">{song.notes}</p>
        </>
      )}
      <About rows={about} />
      {!hasYoutube && !song.notes && !about.length && <p className="m-0 px-1 pt-6 text-[15px] text-muted-foreground">No details yet.{onEdit ? ' Add a YouTube link, notes or credits in Edit.' : ''}</p>}
    </div>
  );

  return (
    <div data-slot="song" className={cn('flex flex-col bg-background', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      {show === 'details' || !chart
        ? <div className="min-h-0 flex-1 overflow-y-auto">{lead}<div className="pt-2" />{details}</div>
        : chart(<>{lead}<div className="pt-3" /></>, <div className="pb-10" />)}
      <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} title={song.title} items={menu} />
    </div>
  );
}
