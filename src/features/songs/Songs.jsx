import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { parseImportFiles, IMPORT_ACCEPT } from '@/lib/importFiles';
import { matchSongByTitle } from '@/lib/setlistLinks';
import { searchSongs } from '@/lib/search';
import {
  playStats, nextSetlistSongs, playLine, sortSongs, filterSongs, filterOptions, songKey, NO_FILTERS,
} from '@/lib/songsData';
import SongsView from './SongsView';
import { AddSongSheet, TagSheet, ChurchPickerSheet } from './SongsSheets';
import { ImportPickSheet, ImportReviewSheet } from './ImportSheets';

// Songs: works out the rows from the library and the setlists, and hands them
// to SongsView. Members read; leaders add, tag, delete, and move or copy songs
// to another church they lead (only offered when they lead two or more).

export default function Songs({
  songs = [], setlists = [], readOnly = false, onOpenSong, onEditSong,
  onSearchCatalog, onImportSongs, onImportSetlistFile, onEditImported, onBlank, onTagSongs, onDeleteSongs, onMoveSongs, onCopySongs, otherChurches = [],
}) {
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [tagIds, setTagIds] = useState(null);
  const [moveCopy, setMoveCopy] = useState(null); // { action, ids }
  const q = useDeferredValue(query);
  const wide = useMediaQuery('(min-width: 640px)');
  const fileRef = useRef(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [importError, setImportError] = useState('');
  const [review, setReview] = useState(null); // { items, failed, source }

  // A phone has no drag and drop, so Import goes straight to the file picker.
  const startImport = () => {
    setImportError('');
    if (wide) setPickOpen(true); else fileRef.current?.click();
  };
  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setReading(true);
    setImportError('');
    try {
      const { songs: parsed, setlistFile, failed, error } = await parseImportFiles(files);
      if (setlistFile) { setPickOpen(false); onImportSetlistFile?.(setlistFile); return; }
      if (!parsed.length) { setImportError(error || 'No songs found in those files.'); if (!wide) setPickOpen(true); return; }
      setPickOpen(false);
      setReview({
        items: parsed.map(song => ({ song, existing: matchSongByTitle(songs, song.title) || null })),
        failed,
        source: files.length === 1 ? files[0].name : `${files.length} files`,
      });
    } catch {
      setImportError('Could not read one or more files.');
    } finally {
      setReading(false);
    }
  };

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
          <AddSongSheet open={addOpen} onOpenChange={setAddOpen} onSearch={onSearchCatalog} onImport={onImportSongs ? startImport : null} onBlank={onBlank} />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files; readFiles(f).finally(() => { e.target.value = ''; }); }}
          />
          <ImportPickSheet open={pickOpen} onOpenChange={setPickOpen} onFiles={readFiles} onChoose={() => fileRef.current?.click()} busy={reading} error={importError} />
          <ImportReviewSheet
            key={review ? review.source + review.items.length : 'none'}
            open={!!review}
            onOpenChange={(o) => { if (!o) setReview(null); }}
            items={review?.items}
            failed={review?.failed}
            source={review?.source}
            onAdd={(list) => onImportSongs?.(list)}
            onEditFirst={onEditImported}
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
