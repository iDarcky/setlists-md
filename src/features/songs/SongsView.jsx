import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, Plus, Search, Tag, Trash2, X, Music } from 'lucide-react';
import BackToTop from '@/ui/BackToTop';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/ui/shadcn/popover';
import { highlightSegments } from '@/lib/search';
import { useLongPress } from '@/lib/useLongPress';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useRevealList } from '@/hooks/useRevealList';
import { SORTS, groupByLetter } from '@/lib/songsData';
import { Cover } from '@/features/song/SongParts';
import { SongPreview } from './SongsDesk';

// Songs, rebuilt from zero (2026-11-15, canvas → Songs boards). The job is
// FINDING a song: one list, A–Z in letter groups with a letter strip on a
// phone, search behind an icon that opens over the title (always open on a
// wide screen), and one quick chip, "To check", for leaders. Pure view:
// Songs.jsx works out the rows.

const STROKE = 1.8;
const Icon = ({ as: As, size = 18 }) => <As size={size} strokeWidth={STROKE} aria-hidden="true" />;

function Title({ text, query }) {
  if (!query) return text;
  return highlightSegments(text, query).map((s, i) => (s.hit
    ? <mark key={i} className="rounded-[3px] bg-selected text-foreground">{s.text}</mark>
    : <Fragment key={i}>{s.text}</Fragment>));
}

function Row({ row, query, picked, selecting, selected, onTap, onLongPress }) {
  const { bind, consumeClick } = useLongPress(onLongPress);
  const { song, keyName, tempo, last, check } = row;
  return (
    <button
      type="button"
      {...bind}
      onClick={() => { if (consumeClick()) return; onTap?.(song); }}
      aria-pressed={selecting ? selected : undefined}
      aria-current={picked ? 'true' : undefined}
      className={cn(
        'flex min-h-16 w-full cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-3.5 py-2.5 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised focus-visible:bg-raised',
        (selected || picked) && 'bg-selected hover:bg-selected',
      )}
    >
      {selecting && (
        <span aria-hidden="true" className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-input', selected && 'border-foreground bg-foreground text-background')}>
          {selected && <Check size={14} strokeWidth={2.4} />}
        </span>
      )}
      <Cover song={song} size={44} className="rounded-control shadow-[0_0_0_1px_var(--border)]" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[16px] font-medium leading-[22px]"><Title text={song.title || 'Untitled'} query={query} /></span>
          {check && <span className="flex h-5 shrink-0 items-center whitespace-nowrap rounded-full bg-warning-fill px-2 text-[12px] font-medium text-warning-text">To check</span>}
        </span>
        {song.artist && <span className="truncate text-[14px] leading-5 text-muted-foreground">{song.artist}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {(keyName || tempo) && <span className="text-[14px] font-medium leading-5 tabular-nums">{[keyName, tempo].filter(Boolean).join(' · ')}</span>}
        <span className={cn('text-[12px] leading-4 text-muted-foreground', last.tone === 'next' && 'font-medium text-link', last.tone === 'stale' && 'text-[var(--chord)]')}>{last.text}</span>
      </span>
    </button>
  );
}

const Label = ({ children, id }) => (
  <h2 id={id} className="m-0 scroll-mt-20 px-1 text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground">{children}</h2>
);

/** The letter strip: tap or slide a finger along it to jump. */
function LetterStrip({ letters, onJump }) {
  const last = useRef(null);
  const at = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const l = el?.dataset?.letter;
    if (l && l !== last.current) { last.current = l; onJump(l); }
  };
  return (
    <nav
      aria-label="Jump to letter"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); last.current = null; at(e); }}
      onPointerMove={(e) => { if (e.buttons) at(e); }}
      className="fixed right-0.5 top-1/2 z-20 flex -translate-y-1/2 touch-none select-none flex-col items-center py-1"
    >
      {letters.map(l => (
        <button key={l} type="button" data-letter={l} onClick={() => onJump(l)} aria-label={`Songs starting with ${l}`}
          className="flex h-[18px] min-h-0 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0 font-sans text-[12px] font-semibold leading-none text-link outline-none">
          {l}
        </button>
      ))}
    </nav>
  );
}

function SortMenu({ sort, onSort, onSelect }) {
  const [open, setOpen] = useState(false);
  const label = SORTS.find(s => s.value === sort)?.label || 'A–Z';
  const item = 'flex h-9 w-full min-h-0 cursor-pointer items-center justify-between gap-3 rounded-control border-0 bg-transparent px-2.5 text-left font-sans text-[14px] font-medium text-foreground outline-none hover:bg-raised focus-visible:bg-raised';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Sort: ${label}`} className="flex h-8 min-h-0 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2.5 font-sans text-[14px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {label}<ChevronDown size={14} strokeWidth={STROKE} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-1.5">
        <div role="radiogroup" aria-label="Sort">
          {SORTS.map(s => (
            <button key={s.value} type="button" role="radio" aria-checked={sort === s.value} className={item}
              onClick={() => { onSort?.(s.value); setOpen(false); }}>
              {s.label}{sort === s.value && <span className="text-link"><Check size={16} strokeWidth={2} aria-hidden="true" /></span>}
            </button>
          ))}
        </div>
        {onSelect && (
          <>
            <div className="mx-1.5 my-1 h-px bg-border" />
            <button type="button" className={item} onClick={() => { setOpen(false); onSelect(); }}>Select songs</button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SearchBox({ query, onQuery, autoFocus, onCancel, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="relative block flex-1">
        <span className="sr-only">Search songs</span>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Icon as={Search} /></span>
        <Input
          type="text" inputMode="search" enterKeyHint="search" autoFocus={autoFocus}
          value={query} onChange={(e) => onQuery?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel?.(); }}
          placeholder="Title, artist or lyrics" className="pl-10 pr-10"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => onQuery?.('')}
            className="absolute right-1 top-1/2 flex size-9 min-h-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X size={16} strokeWidth={STROKE} aria-hidden="true" />
          </button>
        )}
      </label>
      {onCancel && <Button variant="ghost" className="h-11 px-2 text-muted-foreground" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}

/**
 * @param {object} p
 * @param {Array<{song, keyName, tempo, last:{text,tone}, check:boolean}>} p.rows
 * @param {boolean} [p.leader]  can add and change songs
 */
export default function SongsView({
  leader = false, total = 0, rows = [], nextLabel = '', query = '', onQuery,
  sort = 'az', onSort, toCheck = 0, checkOnly = false, onCheckOnly, onCheckNext,
  onOpen, onEdit, onAdd, onTag, onDelete, onMove, onCopy, embedded = false, layout = 'auto',
}) {
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  const [searching, setSearching] = useState(!!query);
  const [pickedId, setPickedId] = useState(null);
  const picked = rows.find(r => r.song.id === pickedId) || rows[0] || null;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [jumpTo, setJumpTo] = useState(null);
  const grouped = sort === 'az' && !query.trim();

  const toggle = (song) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(song.id)) next.delete(song.id); else next.add(song.id);
    return next;
  });
  const startSelect = (song) => { if (!leader || !onTag && !onDelete) return; setSelecting(true); setSelected(new Set(song ? [song.id] : [])); };
  const stopSelect = () => { setSelecting(false); setSelected(new Set()); };
  const run = async (fn) => { await fn?.([...selected]); stopSelect(); };
  const closeSearch = () => { onQuery?.(''); setSearching(false); };

  // A screenful first, the rest as you scroll. A jump to a letter draws them all.
  const { count, more, sentinel } = useRevealList(rows.length, { resetKey: `${query}|${sort}|${checkOnly}` });
  const shownRows = jumpTo || count >= rows.length ? rows : rows.slice(0, count);
  const groups = grouped ? groupByLetter(shownRows) : [{ letter: null, rows: shownRows }];
  const letters = grouped ? groupByLetter(rows).map(g => g.letter) : [];
  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(`songs-letter-${jumpTo}`)?.scrollIntoView({ block: 'start' });
  }, [jumpTo]);

  const tap = (song) => {
    if (selecting) toggle(song);
    else if (wide) setPickedId(song.id);
    else onOpen?.(song);
  };

  const header = !wide && (searching || query) ? (
    <SearchBox query={query} onQuery={onQuery} autoFocus onCancel={closeSearch} className="pt-1" />
  ) : (
    <header className="flex items-center gap-2 pt-1">
      <h1 className={cn('m-0 font-semibold tracking-[-0.5px]', wide ? 'text-[28px] leading-9' : 'text-[24px] leading-8')}>Songs</h1>
      {total > 0 && <span className="mt-1 text-[14px] text-muted-foreground">{total}</span>}
      <span className="flex-1" />
      {selecting ? (
        <Button variant="outline" onClick={stopSelect}>Done</Button>
      ) : (
        <>
          {total > 0 && (wide
            ? <SearchBox query={query} onQuery={onQuery} className="w-[300px]" />
            : <Button variant="outline" size="icon" aria-label="Search songs" onClick={() => setSearching(true)} className="size-11 rounded-control"><Icon as={Search} /></Button>)}
          {leader && onAdd && total > 0 && <Button className="h-11" onClick={onAdd}><Plus size={18} strokeWidth={2} aria-hidden="true" />Add song</Button>}
        </>
      )}
    </header>
  );

  const list = rows.length === 0 ? (
    <div className="flex flex-col items-center gap-1 rounded-card border border-border bg-card px-5 py-7 text-center">
      <b className="text-[16px] font-semibold">No songs match</b>
      <p className="m-0 text-[14px] text-muted-foreground">{query ? 'Try another word, or part of the lyrics.' : 'Nothing to check right now.'}</p>
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      {groups.map(g => (
        <section key={g.letter || 'all'} aria-labelledby={g.letter ? `songs-letter-${g.letter}` : undefined} className="flex flex-col gap-2">
          {g.letter && <Label id={`songs-letter-${g.letter}`}>{g.letter}</Label>}
          <div className="overflow-hidden rounded-card border border-border bg-card">
            {g.rows.map(r => (
              <Row
                key={r.song.id}
                row={r}
                query={query.trim()}
                picked={wide && !selecting && picked?.song.id === r.song.id}
                selecting={selecting}
                selected={selected.has(r.song.id)}
                onTap={tap}
                onLongPress={() => startSelect(r.song)}
              />
            ))}
          </div>
        </section>
      ))}
      {more && !jumpTo && <div ref={sentinel} aria-hidden="true" className="h-px" />}
    </div>
  );

  return (
    <div data-slot="songs" className={cn('bg-background font-sans text-foreground', embedded && 'absolute inset-0 overflow-y-auto')}>
      {!wide && !selecting && <BackToTop />}
      <div className={cn('mx-auto flex w-full flex-col gap-4', wide ? 'max-w-[1180px]' : 'max-w-[680px]', selecting ? 'pb-40' : 'pb-8', layout === 'phone' ? 'px-4 pt-1' : 'px-4 pt-1 sm:px-6 sm:pt-6', !wide && letters.length > 1 && 'pr-7 sm:pr-8')}>
        {header}

        {total === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-card border border-border bg-raised"><Icon as={Music} size={24} /></span>
            <h2 className="m-0 text-[18px] font-semibold leading-[26px]">No songs yet</h2>
            <p className="m-0 max-w-[300px] text-[14px] leading-5 text-muted-foreground">
              {leader ? 'Bring in the songs your band plays: import PDFs or chord files, or type one in.' : 'When your leaders add songs, they show up here.'}
            </p>
            {leader && onAdd && <Button className="mt-2" onClick={onAdd}><Plus size={18} strokeWidth={2} aria-hidden="true" />Add songs</Button>}
          </div>
        ) : (
          <>
            {!selecting && (
              <div className="flex items-center gap-2">
                {leader && toCheck > 0 && (
                  <button type="button" aria-pressed={checkOnly} onClick={() => onCheckOnly?.(!checkOnly)}
                    className={cn('flex h-8 min-h-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 font-sans text-[14px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', checkOnly && 'border-transparent bg-warning-fill text-warning-text')}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-text" />To check · {toCheck}
                  </button>
                )}
                {checkOnly && onCheckNext && <Button size="sm" onClick={onCheckNext}>Check next</Button>}
                <span className="flex-1" />
                {query ? (
                  <span className="text-[14px] text-muted-foreground">{rows.length} of {total}</span>
                ) : (
                  <SortMenu sort={sort} onSort={onSort} onSelect={leader && (onTag || onDelete) ? () => startSelect(null) : null} />
                )}
              </div>
            )}
            {wide ? (
              <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
                {list}
                <SongPreview row={picked} nextLabel={nextLabel} onOpen={onOpen} onEdit={leader ? onEdit : null} />
              </div>
            ) : list}
          </>
        )}
      </div>

      {!wide && !selecting && letters.length > 1 && <LetterStrip letters={letters} onJump={setJumpTo} />}

      {selecting && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 mx-auto flex max-w-[656px] flex-col gap-2 rounded-sheet border border-border bg-card p-2.5 shadow-[0_8px_30px_rgba(0,0,0,.35)] sm:bottom-6">
          <div className="flex items-center justify-between px-1 text-[14px] font-semibold">
            <span>{selected.size} selected</span>
            <button type="button" onClick={stopSelect} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-[14px] font-medium text-link">Cancel</button>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1.5">
            {[[onTag, 'Tag', Tag], [onMove, 'Move', ArrowRight], [onCopy, 'Copy', Copy], [onDelete, 'Delete', Trash2, true]]
              .filter(([fn]) => fn)
              .map(([fn, label, I, danger]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!selected.size}
                  onClick={() => run(fn)}
                  className={cn('flex h-14 min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-0 bg-raised px-1 font-sans text-[12px] font-semibold text-foreground outline-none hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40', danger && 'text-danger')}
                >
                  <Icon as={I} />{label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
