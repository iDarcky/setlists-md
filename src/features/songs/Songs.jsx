import { useDeferredValue, useMemo, useState } from 'react';
import { searchSongs } from '@/lib/search';
import {
  playStats, nextSetlistSongs, playLine, sortSongs, filterSongs, filterOptions, songKey, NO_FILTERS,
} from '@/lib/songsData';
import SongsView from './SongsView';
import { AddSongSheet, TagSheet, ChurchPickerSheet } from './SongsSheets';

// Songs: works out the rows from the library and the setlists, and hands them
// to SongsView. Members read; leaders add, tag, delete, and move or copy songs
// to another church they lead (only offered when they lead two or more).

export default function Songs({
  songs = [], setlists = [], readOnly = false, onOpenSong, onEditSong,
  onSearchCatalog, onImport, onBlank, onTagSongs, onDeleteSongs, onMoveSongs, onCopySongs, otherChurches = [],
}) {
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [tagIds, setTagIds] = useState(null);
  const [moveCopy, setMoveCopy] = useState(null); // { action, ids }
  const q = useDeferredValue(query);

  const stats = useMemo(() => playStats(setlists, now), [setlists, now]);
  const next = useMemo(() => nextSetlistSongs(setlists, now), [setlists, now]);
  const options = useMemo(() => filterOptions(songs), [songs]);
  const allTags = useMemo(() => [...new Set(songs.flatMap(s => s.tags || []))].sort(), [songs]);

  const rows = useMemo(() => {
    const found = q.trim() ? searchSongs(songs, q) : sortSongs(songs, sort, stats);
    return filterSongs(found, filters, stats, now).map(song => ({
      song,
      keyName: songKey(song),
      line: playLine(stats[song.id], now),
      stat: stats[song.id],
      next: next.ids.has(song.id),
    }));
  }, [songs, q, sort, stats, filters, now, next]);

  const leader = !readOnly;
  const canMoveCopy = leader && otherChurches.length > 0;

  return (
    <>
      <SongsView
        leader={leader}
        total={songs.length}
        rows={rows}
        nextLabel={next.label}
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        filters={filters}
        onFilters={setFilters}
        options={options}
        onOpen={onOpenSong}
        onEdit={leader ? onEditSong : null}
        onAdd={leader ? () => setAddOpen(true) : null}
        onTag={leader && onTagSongs ? (ids) => setTagIds(ids) : null}
        onDelete={leader ? onDeleteSongs : null}
        onMove={canMoveCopy && onMoveSongs ? (ids) => setMoveCopy({ action: 'move', ids }) : null}
        onCopy={canMoveCopy && onCopySongs ? (ids) => setMoveCopy({ action: 'copy', ids }) : null}
      />
      {leader && (
        <>
          <AddSongSheet open={addOpen} onOpenChange={setAddOpen} onSearch={onSearchCatalog} onImport={onImport} onBlank={onBlank} />
          <TagSheet
            open={!!tagIds}
            onOpenChange={(o) => { if (!o) setTagIds(null); }}
            count={tagIds?.length || 0}
            tags={allTags}
            onAdd={(t) => onTagSongs?.(tagIds, { add: [t] })}
          />
          <ChurchPickerSheet
            open={!!moveCopy}
            onOpenChange={(o) => { if (!o) setMoveCopy(null); }}
            action={moveCopy?.action}
            count={moveCopy?.ids.length || 0}
            churches={otherChurches}
            onPick={(id) => (moveCopy?.action === 'move' ? onMoveSongs : onCopySongs)?.(moveCopy.ids, id)}
          />
        </>
      )}
    </>
  );
}
