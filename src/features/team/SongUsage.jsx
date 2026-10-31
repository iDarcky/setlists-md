import { useMemo, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Sheet } from '@/ui/shadcn/sheet';
import { BackIcon, ChevronDownIcon } from '@/app/navIcons';
import { USAGE_RANGES, shortDate, songUsage, usualKey, leaderSplit } from '@/lib/songUsage';

// Song usage (canvas → "Team, church and song usage"): leaders only. Songs,
// most played first, or Services, newest first. Filters: time, service,
// leader. A song opens every time it was played. On a wide screen the songs
// are a table with sortable columns.

const RANGE_WORDS = { '1m': 'in the last month', '3m': 'in 3 months', '6m': 'in 6 months', '12m': 'in the last year', all: 'in all' };

function Filter({ label, value, onChange, options }) {
  const current = options.find(o => o.value === value);
  return (
    <label className={cn('relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium', value !== options[0].value ? 'border-foreground bg-raised' : 'border-chip-border')}>
      <span>{current?.label}</span><ChevronDownIcon size={14} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

const Stat = ({ n, label }) => (
  <div className="flex flex-1 flex-col gap-0.5 rounded-card border border-border bg-card px-3.5 py-3">
    <span className="text-[22px] font-semibold leading-7 tabular-nums">{n}</span>
    <span className="text-[13px] text-muted-foreground">{label}</span>
  </div>
);

function SongRow({ row, max, nameOf, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(row)}
      className="flex w-full cursor-pointer flex-col gap-1.5 border-0 border-t border-border bg-transparent py-3 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised/50 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{row.title}</span>
        <span className="text-[15px] font-semibold tabular-nums">{row.plays}×</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <span className="block h-full rounded-full bg-link" style={{ width: `${Math.max(6, (row.plays / max) * 100)}%` }} />
      </span>
      <span className="truncate text-[13px] text-muted-foreground">{[`Last ${shortDate(row.last)}`, leaderSplit(row.leaders, nameOf)].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

function ServiceRow({ s, nameOf }) {
  const d = new Date(`${s.date}T12:00:00`);
  return (
    <div className="flex gap-3.5 border-t border-border py-3 first:border-t-0">
      <span className="flex w-10 shrink-0 flex-col items-center pt-0.5">
        <span className="text-[18px] font-semibold leading-6 tabular-nums">{d.getDate()}</span>
        <span className="text-[12px] text-muted-foreground">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium">{s.name}</span>
        <span className="truncate text-[13px] text-muted-foreground">{[s.service !== s.name && s.service, (nameOf(s.leaderId) || s.leaderName) && `${nameOf(s.leaderId) || s.leaderName} planned it`].filter(Boolean).join(' · ')}</span>
        <span className="text-[14px] leading-5">{s.songs.map(x => x.key ? `${x.title} (${x.key})` : x.title).join(' · ') || <span className="text-muted-foreground">No songs</span>}</span>
      </span>
    </div>
  );
}

const SORTS = {
  plays: (a, b) => b.plays - a.plays,
  title: (a, b) => a.title.localeCompare(b.title),
  last: (a, b) => (b.last || '').localeCompare(a.last || ''),
  key: (a, b) => usualKey(a.keys).localeCompare(usualKey(b.keys)),
};

function Th({ id, sort, onSort, children, className }) {
  return (
    <th scope="col" aria-sort={id && sort === id ? (id === 'title' || id === 'key' ? 'ascending' : 'descending') : undefined} className={cn('h-10 px-3 text-left text-[13px] font-semibold text-muted-foreground', className)}>
      {id ? <button type="button" onClick={() => onSort(id)} className={cn('inline-flex min-h-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-[13px] font-semibold', sort === id ? 'text-foreground' : 'text-muted-foreground')}>{children}{sort === id && <ChevronDownIcon size={12} />}</button> : children}
    </th>
  );
}

function SongTable({ rows, nameOf, onOpen }) {
  const [sort, setSort] = useState('plays');
  const sorted = useMemo(() => [...rows].sort((a, b) => SORTS[sort](a, b) || b.plays - a.plays), [rows, sort]);
  const th = { sort, onSort: setSort };
  return (
    <table className="w-full border-collapse">
      <thead className="border-b border-border">
        <tr><Th id="title" {...th}>Song</Th><Th id="plays" {...th} className="w-24 text-right">Played</Th><Th id="last" {...th} className="w-28">Last</Th><Th id="key" {...th} className="w-24">Usual key</Th><Th>Planned by</Th></tr>
      </thead>
      <tbody>
        {sorted.map(r => (
          <tr key={r.songId} onClick={() => onOpen(r)} className="cursor-pointer border-b border-border hover:bg-raised/50">
            <td className="h-12 px-3 text-[15px] font-medium"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(r); }} className="min-h-0 cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-[15px] font-medium text-foreground">{r.title}</button></td>
            <td className="px-3 text-right text-[15px] font-semibold tabular-nums">{r.plays}×</td>
            <td className="px-3 text-[14px] text-muted-foreground">{shortDate(r.last)}</td>
            <td className="px-3 text-[14px]">{usualKey(r.keys)}</td>
            <td className="px-3 text-[14px] text-muted-foreground">{leaderSplit(r.leaders, nameOf)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Every time one song was played. */
export function SongPlays({ row, range, nameOf, onOpenSong }) {
  return (
    <div className="flex flex-col gap-4 font-sans">
      <p className="m-0 text-[15px] text-muted-foreground">
        {row.plays} {row.plays === 1 ? 'time' : 'times'} {RANGE_WORDS[range] || ''}{usualKey(row.keys) && ` · usually in ${usualKey(row.keys)}`}
      </p>
      <div className="flex flex-col">
        {row.history.map((h, i) => {
          const d = new Date(`${h.date}T12:00:00`);
          const who = nameOf(h.leaderId) || h.leaderName;
          return (
            <div key={`${h.setlistId}-${i}`} className="flex min-h-14 items-center gap-3.5 border-t border-border py-2 first:border-t-0">
              <span className="flex w-10 shrink-0 flex-col items-center">
                <span className="text-[17px] font-semibold leading-6 tabular-nums">{d.getDate()}</span>
                <span className="text-[12px] text-muted-foreground">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{h.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">{[who && `${who} planned it`, h.key && `in ${h.key}`].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          );
        })}
      </div>
      {onOpenSong && <Button variant="outline" onClick={() => onOpenSong(row.songId)}>Open the song</Button>}
    </div>
  );
}

export default function SongUsage({ setlists = [], songs = [], nameOf = () => '', onBack, onOpenSong, today, initialTab = 'songs' }) {
  const [tab, setTab] = useState(initialTab);
  const [range, setRange] = useState('3m');
  const [service, setService] = useState('all');
  const [leader, setLeader] = useState('all');
  const [open, setOpen] = useState(null);
  const data = useMemo(() => songUsage(setlists, songs, { range, service, leader, today: today || new Date() }), [setlists, songs, range, service, leader, today]);
  const max = data.songs[0]?.plays || 1;

  const filters = (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 @min-[640px]:mx-0 @min-[640px]:px-0">
      <Filter label="Time" value={range} onChange={setRange} options={USAGE_RANGES.map(r => ({ value: r.id, label: r.label }))} />
      <Filter label="Service" value={service} onChange={setService} options={[{ value: 'all', label: 'All services' }, ...data.serviceNames.map(s => ({ value: s, label: s }))]} />
      <Filter label="Leader" value={leader} onChange={setLeader} options={[{ value: 'all', label: 'All leaders' }, ...data.leaderIds.map(id => ({ value: id, label: nameOf(id) || 'Someone' }))]} />
    </div>
  );

  return (
    <div data-slot="song-usage" className="@container min-h-full bg-background font-sans text-foreground">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 pb-32 @min-[640px]:px-6 @min-[1024px]:pb-12">
        <div className="flex h-14 items-center @min-[640px]:mt-4" style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
          <button type="button" onClick={onBack} className="-ml-2 flex h-11 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <BackIcon />Team
          </button>
        </div>
        <h1 className="m-0 text-[26px] font-semibold leading-8 tracking-[-0.6px] @min-[640px]:text-[32px] @min-[640px]:leading-10 @min-[640px]:tracking-[-1px]">Song usage</h1>

        <div role="tablist" className="-mx-4 flex gap-5 border-b border-border px-4 @min-[640px]:-mx-6 @min-[640px]:px-6">
          {[['songs', 'Songs'], ['services', 'Services']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
              className={cn('-mb-px flex h-10 min-h-0 cursor-pointer items-center border-0 border-b-2 bg-transparent px-0 font-sans text-[15px] outline-none', tab === id ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground')}>
              {label}
            </button>
          ))}
        </div>
        {filters}
        <div className="flex gap-2">
          <Stat n={data.totals.services} label={data.totals.services === 1 ? 'service' : 'services'} />
          <Stat n={data.totals.songs} label="different songs" />
          <Stat n={data.totals.newSongs} label={data.totals.newSongs === 1 ? 'new song' : 'new songs'} />
        </div>

        {tab === 'songs' && (data.songs.length ? (
          <>
            <div className="flex flex-col @min-[1024px]:hidden">{data.songs.map(r => <SongRow key={r.songId} row={r} max={max} nameOf={nameOf} onOpen={setOpen} />)}</div>
            <div className="hidden @min-[1024px]:block"><SongTable rows={data.songs} nameOf={nameOf} onOpen={setOpen} /></div>
          </>
        ) : <p className="m-0 py-8 text-center text-[15px] text-muted-foreground">Nothing played in this time.</p>)}

        {tab === 'services' && (data.services.length
          ? <div className="flex flex-col">{data.services.map(s => <ServiceRow key={s.id} s={s} nameOf={nameOf} />)}</div>
          : <p className="m-0 py-8 text-center text-[15px] text-muted-foreground">No services in this time.</p>)}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }} title={open?.title || 'Song'}>
        {open && <SongPlays row={open} range={range} nameOf={nameOf} onOpenSong={onOpenSong ? (id) => { setOpen(null); onOpenSong(id); } : null} />}
      </Sheet>
    </div>
  );
}

