import { useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { useLongPress } from '@/lib/useLongPress';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { SongsTable, SongPreview } from './SongsDesk';
import { SORTS, filterCount } from '@/lib/songsData';
import { PlusIcon, ChevronDownIcon, CheckIcon } from '@/app/navIcons';

// Songs, built from zero (canvas → Songs page). Pure view: Songs.jsx works out
// the rows, /design renders this with samples.
//
// One list: search, a few quick chips, the sort, then a row per song with how
// often and when it was last played, and its key. Leaders long-press (or tap
// Select) to tag, delete, or move/copy to another church they lead.

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
const SlidersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);

const Svg = ({ size = 20, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const XIcon = () => <Svg size={16}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
const TagIcon = () => <Svg><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>;
const MoveIcon = () => <Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
const CopyIcon = () => <Svg><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
const TrashIcon = () => <Svg><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>;
const UpIcon = () => <Svg><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;

const chipBase = 'flex h-8 min-h-0 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-border bg-transparent px-3 font-sans text-[13px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const chipOn = 'border-transparent bg-selected font-semibold text-foreground';

function Row({ row, nextLabel, selecting, selected, onOpen, onToggle, onLongPress }) {
  const { bind, consumeClick } = useLongPress(onLongPress);
  const { song, keyName, line, next } = row;
  return (
    <button
      type="button"
      {...bind}
      onClick={() => { if (consumeClick()) return; (selecting ? onToggle : onOpen)?.(song); }}
      aria-pressed={selecting ? selected : undefined}
      className={cn(
        'flex min-h-[60px] w-full cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-4 py-2.5 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised',
        selected && 'bg-selected hover:bg-selected',
      )}
    >
      {selecting && (
        <span aria-hidden="true" className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-input', selected && 'border-foreground bg-foreground text-background')}>
          {selected && <CheckIcon size={14} />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{song.title || 'Untitled'}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {song.artist ? `${song.artist} · ` : ''}<span className={cn(line.stale && 'text-[var(--chord)]')}>{line.text}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {next && nextLabel && <span className="flex h-6 items-center rounded-full bg-selected px-2.5 text-[12px] font-semibold text-link">{nextLabel}</span>}
        {keyName && <span className="flex h-7 min-w-9 items-center justify-center rounded-[6px] bg-raised px-1.5 font-mono text-[13px] font-semibold text-[var(--chord)]">{keyName}</span>}
      </span>
    </button>
  );
}

const flipIn = (filters, group, v) => ({ ...filters, [group]: filters[group].includes(v) ? filters[group].filter(x => x !== v) : [...filters[group], v] });

function KeyGrid({ keys, picked, onFlip }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {keys.map(k => (
        <button key={k} type="button" aria-pressed={picked.includes(k)} onClick={() => onFlip(k)}
          className={cn('h-9 min-h-0 cursor-pointer rounded-control border border-border bg-transparent font-mono text-[13px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', picked.includes(k) && 'border-link bg-selected text-link')}>
          {k}
        </button>
      ))}
    </div>
  );
}

function ChipSet({ values, picked, onFlip }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(t => (
        <button key={t} type="button" aria-pressed={picked.includes(t)} onClick={() => onFlip(t)} className={cn(chipBase, picked.includes(t) && chipOn)}>{t}</button>
      ))}
    </div>
  );
}

/** A quick chip that drops down its own choices (Key, Theme). */
function ChipDrop({ label, active, title, onClear, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chipBase, active && chipOn)}>{label}<ChevronDownIcon size={14} /></button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</span>
          {active && <button type="button" onClick={onClear} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-link">Clear</button>}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** Sort and filter, in one sheet. Changes apply as you tap; the button closes. */
export function FilterSheet({ open, onOpenChange, sort, onSort, filters, onFilters, options, shown }) {
  const flip = (group, v) => onFilters?.(flipIn(filters, group, v));
  const head = 'm-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sort and filter" className="h-auto max-h-[calc(100dvh-64px)] sm:max-w-[440px]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h4 className={head}>Sort by</h4>
          <div role="radiogroup" aria-label="Sort by" className="flex flex-col overflow-hidden rounded-card border border-border">
            {SORTS.map(s => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={sort === s.value}
                onClick={() => onSort?.(s.value)}
                className={cn('flex h-11 min-h-0 cursor-pointer items-center justify-between border-0 border-t border-border bg-transparent px-3.5 text-left font-sans text-[15px] text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised', sort === s.value && 'font-semibold')}
              >
                {s.label}
                {sort === s.value && <span className="text-link"><CheckIcon size={16} /></span>}
              </button>
            ))}
          </div>
        </section>
        {options.keys.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className={head}>Key</h4>
            <KeyGrid keys={options.keys} picked={filters.keys} onFlip={(k) => flip('keys', k)} />
          </section>
        )}
        {options.themes.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className={head}>Theme</h4>
            <ChipSet values={options.themes.slice(0, 16)} picked={filters.themes} onFlip={(t) => flip('themes', t)} />
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h4 className={head}>Tempo</h4>
          <ChipSet values={['Slow', 'Mid', 'Fast']} picked={filters.tempos} onFlip={(t) => flip('tempos', t)} />
        </section>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onOpenChange?.(false)}>Show {shown} song{shown === 1 ? '' : 's'}</Button>
          {filterCount(filters) > 0 && <Button variant="outline" onClick={() => onFilters?.({ keys: [], themes: [], tempos: [], stale: false })}>Clear</Button>}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * @param {object} p
 * @param {Array<{song, keyName, line:{text,stale}, next:boolean}>} p.rows
 * @param {boolean} [p.leader]   can add and change songs
 */
export default function SongsView({
  leader = false, total = 0, rows = [], nextLabel = '', query = '', onQuery,
  sort = 'az', onSort, filters, onFilters, options = { keys: [], themes: [] },
  onOpen, onEdit, onAdd, onTag, onDelete, onMove, onCopy, embedded = false, layout = 'auto',
}) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [pickedId, setPickedId] = useState(null);
  const picked = rows.find(r => r.song.id === pickedId) || rows[0] || null;
  const [sheet, setSheet] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const nFilters = filterCount(filters);
  const toggle = (song) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(song.id)) next.delete(song.id); else next.add(song.id);
    return next;
  });
  const startSelect = (song) => { if (!leader) return; setSelecting(true); setSelected(new Set([song.id])); };
  const stopSelect = () => { setSelecting(false); setSelected(new Set()); };
  const run = async (fn) => { await fn?.([...selected]); stopSelect(); };
  const sortLabel = SORTS.find(s => s.value === sort)?.label || 'A–Z';
  const topRef = useRef(null);
  const [farDown, setFarDown] = useState(false);
  useEffect(() => {
    const el = topRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setFarDown(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '600px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const chipKey = filters.keys.length ? `Key: ${filters.keys.join(', ')}` : 'Key';
  const chipTheme = filters.themes.length ? `Theme: ${filters.themes.join(', ')}` : 'Theme';

  return (
    <div data-slot="songs" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      <div ref={topRef} aria-hidden="true" />
      <div className={cn('mx-auto flex w-full flex-col gap-3', wide ? 'max-w-[1180px]' : 'max-w-[680px]', selecting ? 'pb-40' : 'pb-8', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6')}>
        <header className="flex items-center justify-between gap-2 pb-0.5 pt-1">
          <h1 className={cn('m-0 font-semibold leading-8 tracking-[-0.5px]', wide ? 'text-[28px]' : 'text-[24px]')}>
            Songs {total > 0 && <span className="text-[15px] font-medium tracking-normal text-muted-foreground">{total}</span>}
          </h1>
          {selecting ? (
            <Button variant="outline" size="sm" onClick={stopSelect}>Done</Button>
          ) : leader && onAdd ? (
            <Button size="sm" onClick={onAdd}><PlusIcon size={16} />Add</Button>
          ) : null}
        </header>

        {total === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-7 text-center">
            <b className="text-[17px]">{leader ? 'Your song library is empty' : 'No songs yet'}</b>
            <p className="m-0 max-w-[300px] text-[15px] leading-[21px] text-muted-foreground">
              {leader ? 'Add the songs your church sings: import the files you already have, or type one in.' : 'When your leaders add songs, they show up here.'}
            </p>
            {leader && onAdd && <Button className="mt-1.5 w-full max-w-[300px]" onClick={onAdd}><PlusIcon size={16} />Add a song</Button>}
          </div>
        ) : (
          <>
            <div className={cn('flex flex-col gap-3', wide && 'flex-row items-center gap-2.5')}>
            <label className={cn('relative block', wide && 'w-[340px] shrink-0')}>
              <span className="sr-only">Search songs</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><SearchIcon /></span>
              <Input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={(e) => onQuery?.(e.target.value)} placeholder="Search title, artist, lyrics" className="pl-10 pr-11" />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => onQuery?.('')}
                  className="absolute right-1.5 top-1/2 flex size-8 min-h-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-raised p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  <XIcon />
                </button>
              )}
            </label>
            {!selecting && (
              <div className={cn('flex gap-1.5', wide ? 'flex-wrap' : '-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0')}>
                {options.keys.length > 0 && (
                  <ChipDrop label={chipKey} title="Key" active={filters.keys.length > 0} onClear={() => onFilters?.({ ...filters, keys: [] })}>
                    <KeyGrid keys={options.keys} picked={filters.keys} onFlip={(k) => onFilters?.(flipIn(filters, 'keys', k))} />
                  </ChipDrop>
                )}
                {options.themes.length > 0 && (
                  <ChipDrop label={chipTheme} title="Theme" active={filters.themes.length > 0} onClear={() => onFilters?.({ ...filters, themes: [] })}>
                    <ChipSet values={options.themes.slice(0, 16)} picked={filters.themes} onFlip={(t) => onFilters?.(flipIn(filters, 'themes', t))} />
                  </ChipDrop>
                )}
                <button type="button" aria-pressed={filters.stale} onClick={() => onFilters?.({ ...filters, stale: !filters.stale })} className={cn(chipBase, filters.stale && chipOn)}>Not played lately</button>
                <button type="button" onClick={() => setSheet(true)} className={cn(chipBase, nFilters > 0 && chipOn)}>
                  <SlidersIcon />Filters{nFilters > 0 && <span className="text-[12px] font-bold text-link">{nFilters}</span>}
                </button>
              </div>
            )}
            </div>
            <div className="flex items-center justify-between px-0.5 text-[13px] text-muted-foreground">
              <span>{rows.length === total ? `${total} song${total === 1 ? '' : 's'}` : `${rows.length} of ${total}`}</span>
              <span className="flex items-center gap-3">
                {leader && !selecting && rows.length > 0 && (
                  <button type="button" onClick={() => setSelecting(true)} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-link">Select</button>
                )}
                <button type="button" onClick={() => setSheet(true)} className="flex min-h-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-foreground">
                  {sortLabel}<ChevronDownIcon size={14} />
                </button>
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-card px-5 py-7 text-center">
                <b className="text-[17px]">No songs match</b>
                <p className="m-0 text-[15px] text-muted-foreground">Try fewer filters or another search.</p>
              </div>
            ) : wide ? (
              <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
                <SongsTable
                  rows={rows}
                  picked={picked?.song.id}
                  selecting={selecting}
                  selected={selected}
                  onPick={(song) => setPickedId(song.id)}
                  onOpen={onOpen}
                  onToggle={toggle}
                  sort={sort}
                  onSort={onSort}
                />
                <SongPreview row={picked} nextLabel={nextLabel} onOpen={onOpen} onEdit={leader ? onEdit : null} />
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-border bg-card">
                {rows.map(r => (
                  <Row
                    key={r.song.id}
                    row={r}
                    nextLabel={nextLabel}
                    selecting={selecting}
                    selected={selected.has(r.song.id)}
                    onOpen={onOpen}
                    onToggle={toggle}
                    onLongPress={() => startSelect(r.song)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selecting && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 mx-auto flex max-w-[656px] flex-col gap-2 rounded-[16px] border border-border bg-card p-2.5 shadow-[0_8px_30px_rgba(0,0,0,.35)] sm:bottom-6">
          <div className="flex items-center justify-between px-1 text-[14px] font-semibold">
            <span>{selected.size} selected</span>
            <button type="button" onClick={stopSelect} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-link">Cancel</button>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1.5">
            {[[onTag, 'Tag', <TagIcon key="i" />], [onMove, 'Move', <MoveIcon key="i" />], [onCopy, 'Copy', <CopyIcon key="i" />], [onDelete, 'Delete', <TrashIcon key="i" />, true]]
              .filter(([fn]) => fn)
              .map(([fn, label, icon, danger]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!selected.size}
                  onClick={() => run(fn)}
                  className={cn('flex h-14 min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-0 bg-raised px-1 font-sans text-[12px] font-semibold text-foreground outline-none hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40', danger && 'text-danger')}
                >
                  {icon}{label}
                </button>
              ))}
          </div>
        </div>
      )}

      {!wide && !selecting && farDown && (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+96px)] right-4 z-30 flex size-11 min-h-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card p-0 text-foreground shadow-[0_6px_20px_rgba(0,0,0,.3)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6"
        >
          <UpIcon />
        </button>
      )}

      <FilterSheet
        open={sheet}
        onOpenChange={setSheet}
        sort={sort}
        onSort={onSort}
        filters={filters}
        onFilters={onFilters}
        options={options}
        shown={rows.length}
      />
    </div>
  );
}
