import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/ui/shadcn/page-header';
import { EmptyState } from '@/ui/shadcn/empty-state';
import { Plus, Music, SearchX } from 'lucide-react';
import { chipClass } from '@/ui/shadcn/chip';
import { ListRow, KeyBadge } from '@/ui/shadcn/list-row';
import { SectionLabel } from '@/ui/shadcn/section-label';
import { Search } from '@/ui/blocks/Search';
import BackToTop from '@/ui/BackToTop';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { useLongPress } from '@/lib/useLongPress';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useRevealList } from '@/hooks/useRevealList';
import { SongsTable, SongPreview } from './SongsDesk';
import { SORTS, filterCount } from '@/lib/songsData';
import { CheckIcon } from '@/app/navIcons';

// Songs, built from zero (canvas → Songs page). Pure view: Songs.jsx works out
// the rows, /design renders this with samples.
//
// One list: search, a few quick chips, the sort, then a row per song with how
// often and when it was last played, and its key. Leaders long-press (or tap
// Select) to tag, delete, or move/copy to another church they lead.

const SlidersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);

const Svg = ({ size = 20, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const TagIcon = () => <Svg><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>;
const MoveIcon = () => <Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
const CopyIcon = () => <Svg><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
const TrashIcon = () => <Svg><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>;


function Row({ row, nextLabel, selecting, selected, onOpen, onToggle, onLongPress }) {
  const { bind, consumeClick } = useLongPress(onLongPress);
  const { song, keyName, line, next } = row;
  return (
    <ListRow
      {...bind}
      onClick={() => { if (consumeClick()) return; (selecting ? onToggle : onOpen)?.(song); }}
      aria-pressed={selecting ? selected : undefined}
      selected={selected}
      weight="strong"
      leading={selecting ? (
        <span aria-hidden="true" className={cn('flex size-[22px] items-center justify-center rounded-[6px] border-[1.5px] border-input text-background', selected && 'border-foreground bg-foreground')}>
          {selected && <CheckIcon size={14} />}
        </span>
      ) : null}
      title={song.title || 'Untitled'}
      sub={<>{song.artist ? `${song.artist} · ` : ''}<span className={cn(line.stale && 'text-[var(--chord)]')}>{line.text}</span></>}
      trailing={(next && nextLabel) || keyName ? <>
        {next && nextLabel && <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold bg-selected text-link">{nextLabel}</span>}
        {keyName && <KeyBadge>{keyName}</KeyBadge>}
      </> : null}
    />
  );
}

// A–Z on a phone: one card per first letter (# for numbers and symbols).
function groupRows(rows, sort) {
  if (sort !== 'az') return [{ letter: null, rows }];
  const out = [];
  for (const r of rows) {
    const c = (r.song.title || '').trim().charAt(0).normalize('NFD').charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(c) ? c : '#';
    const last = out[out.length - 1];
    if (last && last.letter === letter) last.rows.push(r); else out.push({ letter, rows: [r] });
  }
  return out;
}

const flipIn = (filters, group, v) => ({ ...filters, [group]: filters[group].includes(v) ? filters[group].filter(x => x !== v) : [...filters[group], v] });

function KeyGrid({ keys, picked, onFlip }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {keys.map(k => (
        <button key={k} type="button" aria-pressed={picked.includes(k)} onClick={() => onFlip(k)}
          className={cn(chipClass(picked.includes(k)), 'px-0 font-mono font-semibold')}>
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
        <button key={t} type="button" aria-pressed={picked.includes(t)} onClick={() => onFlip(t)} className={chipClass(picked.includes(t))}>{t}</button>
      ))}
    </div>
  );
}

/** A quick chip that drops down its own choices (Key, Theme). */

/** Sort and filter, in one sheet. Changes apply as you tap; the button closes. */
export function FilterSheet({ open, onOpenChange, sort, onSort, filters, onFilters, options, shown }) {
  const flip = (group, v) => onFilters?.(flipIn(filters, group, v));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sort and filter" className="h-auto max-h-[calc(100dvh-64px)] sm:max-w-[440px]">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <SectionLabel as="h4" className="px-1">Sort by</SectionLabel>
          <div role="radiogroup" aria-label="Sort by" className="overflow-hidden rounded-card material-base">
            {SORTS.map(s => (
              <ListRow key={s.value} size="compact" weight={sort === s.value ? 'medium' : 'regular'} role="radio" aria-checked={sort === s.value}
                onClick={() => onSort?.(s.value)} title={s.label}
                trailing={sort === s.value ? <span className="text-link"><CheckIcon size={18} /></span> : null} />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <SectionLabel as="h4" className="px-1">Played</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!!filters.stale} onClick={() => onFilters?.({ ...filters, stale: !filters.stale })} className={chipClass(!!filters.stale)}>Not played lately</button>
          </div>
        </section>
        {options.keys.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionLabel as="h4" className="px-1">Key</SectionLabel>
            <KeyGrid keys={options.keys} picked={filters.keys} onFlip={(k) => flip('keys', k)} />
          </section>
        )}
        {options.themes.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionLabel as="h4" className="px-1">Theme</SectionLabel>
            <ChipSet values={options.themes.slice(0, 16)} picked={filters.themes} onFlip={(t) => flip('themes', t)} />
          </section>
        )}
        <section className="flex flex-col gap-2">
          <SectionLabel as="h4" className="px-1">Tempo</SectionLabel>
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
  onOpen, onEdit, onAdd, onTag, onDelete, onMove, onCopy, toCheck = 0, onCheckNext, embedded = false, layout = 'auto',
}) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [pickedId, setPickedId] = useState(null);
  const picked = rows.find(r => r.song.id === pickedId) || rows[0] || null;
  const [sheet, setSheet] = useState(false);
  const rowRef = useRef(null);
  const [rowWidth, setRowWidth] = useState(320);
  const [searchOpen, setSearchOpen] = useState(!!query);
  useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setRowWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [total]);
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
  // A screenful first, the rest as you scroll (see useRevealList).
  const { count: shown, more, sentinel } = useRevealList(rows.length, { resetKey: `${query}|${sort}|${JSON.stringify(filters)}` });
  const shownRows = shown < rows.length ? rows.slice(0, shown) : rows;

  return (
    <div data-slot="songs" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      {!wide && !selecting && <BackToTop />}
      <div className={cn('mx-auto flex w-full flex-col gap-3', wide ? 'max-w-[1180px]' : 'max-w-[680px]', selecting ? 'pb-40' : 'pb-8', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6')}>
        {/* Pinned while the list scrolls: title, search, + (like Home). */}
        <PageHeader ref={rowRef} sticky title="Songs" count={total > 0 ? total : null} wide={layout === 'auto' ? undefined : wide}
          className={layout === 'phone' ? '-mx-4 px-4' : '-mx-4 px-4 sm:-mx-6 sm:px-6'}>
            {total > 0 && !selecting && (
              <div data-search="header" className={cn(searchOpen ? cn('absolute inset-y-0 z-10 flex items-center bg-background', layout === 'phone' ? 'inset-x-4' : 'inset-x-4 sm:inset-x-6') : 'shrink-0')}>
                <Search inline keyboard give={30} spring={30} value={query} onValueChange={onQuery} onOpenChange={setSearchOpen}
                  placeholder="Search title, artist, lyrics" width={rowWidth} />
              </div>
            )}
            {selecting ? (
              <Button variant="outline" size="sm" onClick={stopSelect}>Done</Button>
            ) : leader && onAdd ? (
              <Button size="icon" aria-label="Add a song" className="size-11 shrink-0 rounded-control" onClick={onAdd}><Plus size={20} strokeWidth={2} aria-hidden="true" /></Button>
            ) : null}
        </PageHeader>

        {toCheck > 0 && !selecting && onCheckNext && (
          <div role="status" className="flex items-center gap-3 rounded-card material-base px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="text-[15px] font-semibold">{toCheck === 1 ? '1 imported song to check' : `${toCheck} imported songs to check`}</b>
              <span className="text-[13px] text-muted-foreground">Open each one, fix what came out wrong, and keep it.</span>
            </span>
            <Button size="sm" onClick={onCheckNext}>Check next</Button>
          </div>
        )}

        {total === 0 ? (
          <EmptyState className="mt-6" icon={<Music strokeWidth={1.8} />}
            title={leader ? 'Your song library is empty' : 'No songs yet'}
            action={leader && onAdd ? <Button onClick={onAdd}><Plus size={18} strokeWidth={2} aria-hidden="true" />Add a song</Button> : null}>
            {leader ? 'Add the songs your church sings: import the files you already have, or type one in.' : 'When your leaders add songs, they show up here.'}
          </EmptyState>
        ) : (
          <>
            <div className="flex min-h-9 items-center justify-between px-0.5 text-small text-muted-foreground">
              <span>{rows.length === total ? `${total} song${total === 1 ? '' : 's'}` : `${rows.length} of ${total}`}</span>
              <span className="flex items-center gap-3">
                {leader && !selecting && rows.length > 0 && (
                  <button type="button" onClick={() => setSelecting(true)} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-small font-medium text-link">Select</button>
                )}
                {/* Sort and every filter live in one sheet (Key, Theme, Tempo, Not played lately). */}
                <button type="button" onClick={() => setSheet(true)} aria-label={`Sort and filter: ${sortLabel}${nFilters ? `, ${nFilters} filters` : ''}`}
                  className={cn(chipClass(nFilters > 0), 'gap-1.5 text-foreground')}>
                  <SlidersIcon />{sortLabel}{nFilters > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-link px-1.5 text-caption font-semibold text-background">{nFilters}</span>}
                </button>
              </span>
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={<SearchX strokeWidth={1.8} />} title="No songs match">Try fewer filters or another search.</EmptyState>
            ) : wide ? (
              <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
                <SongsTable
                  rows={shownRows}
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
              groupRows(shownRows, sort).map(g => (
              <section key={g.letter || 'all'} className="flex flex-col gap-2">
              {g.letter && <SectionLabel as="h2" className="px-1 pt-1">{g.letter}</SectionLabel>}
              <div className="overflow-hidden rounded-card material-base">
                {g.rows.map(r => (
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
              </section>
              ))
            )}
            {more && <div ref={sentinel} aria-hidden="true" className="h-px" />}
          </>
        )}
      </div>

      {selecting && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-chrome mx-auto flex max-w-[656px] flex-col gap-2 rounded-card material-medium p-2.5 sm:bottom-6">
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
