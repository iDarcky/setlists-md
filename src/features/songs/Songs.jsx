import { useDeferredValue, useMemo, useState } from 'react';
import { needsCheck } from '@/lib/importCheck';
import { searchSongs } from '@/lib/search';
import {
  playStats, nextSetlistSongs, sortSongs, songKey, songTempo, lastPlayed,
} from '@/lib/songsData';
import SongsView from './SongsView';
import { TagSheet, ChurchPickerSheet } from './SongsSheets';
import AddSongFlow from './AddSongFlow';

// Songs: works out the rows from the library and the setlists, and hands them
// to SongsView. Members read; leaders add, tag, delete, and move or copy songs
// to another church they lead (only offered when they lead two or more).

export default function Songs({
  songs = [], setlists = [], readOnly = false, onOpenSong, onEditSong,
  onSearchCatalog, onImportSongs, onImportSetlistFile, onEditImported, onCheckNext, onBlank, onTagSongs, onDeleteSongs, onMoveSongs, onCopySongs, otherChurches = [],
}) {
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [checkOnly, setCheckOnly] = useState(false);
  const [adding, setAdding] = useState(null); // null | 'add' | 'import'
  const [tagIds, setTagIds] = useState(null);
  const [moveCopy, setMoveCopy] = useState(null); // { action, ids }
  const q = useDeferredValue(query);

  const stats = useMemo(() => playStats(setlists, now), [setlists, now]);
  const next = useMemo(() => nextSetlistSongs(setlists, now), [setlists, now]);
  const allTags = useMemo(() => [...new Set(songs.flatMap(s => s.tags || []))].sort(), [songs]);

  const leader = !readOnly;
  const toCheck = leader && onCheckNext ? songs.filter(needsCheck).length : 0;
  const onlyCheck = checkOnly && toCheck > 0;

  const rows = useMemo(() => {
    const found = q.trim() ? searchSongs(songs, q) : sortSongs(songs, sort, stats);
    return found
      .filter(song => !onlyCheck || needsCheck(song))
      .map(song => ({
        song,
        keyName: songKey(song),
        tempo: songTempo(song),
        last: lastPlayed(stats[song.id], now, next.ids.has(song.id) ? next.label : ''),
        check: leader && needsCheck(song),
        stat: stats[song.id],
        next: next.ids.has(song.id),
      }));
  }, [songs, q, sort, stats, now, next, onlyCheck, leader]);

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
        onOpen={onOpenSong}
        onEdit={leader ? onEditSong : null}
        toCheck={toCheck}
        checkOnly={onlyCheck}
        onCheckOnly={setCheckOnly}
        onCheckNext={onCheckNext}
        onAdd={leader ? () => setAdding('add') : null}
        onTag={leader && onTagSongs ? (ids) => setTagIds(ids) : null}
        onDelete={leader ? onDeleteSongs : null}
        onMove={canMoveCopy && onMoveSongs ? (ids) => setMoveCopy({ action: 'move', ids }) : null}
        onCopy={canMoveCopy && onCopySongs ? (ids) => setMoveCopy({ action: 'copy', ids }) : null}
      />
      {leader && (
        <>
          <AddSongFlow
            mode={adding}
            onMode={setAdding}
            songs={songs}
            onSearchCatalog={onSearchCatalog}
            onImportSongs={onImportSongs}
            onImportSetlistFile={onImportSetlistFile}
            onEditImported={onEditImported}
            onBlank={onBlank}
          />
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
