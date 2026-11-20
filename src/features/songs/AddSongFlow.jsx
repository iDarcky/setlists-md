import { useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { parseImportFiles, IMPORT_ACCEPT } from '@/lib/importFiles';
import { markToCheck } from '@/lib/importCheck';
import { matchSongByTitle } from '@/lib/setlistLinks';
import { libraryArtists } from '@/features/song-edit/newSongDetails';
import { AddSongSheet } from './SongsSheets';
import { ImportPickSheet, ImportReviewSheet } from './ImportSheets';

/**
 * Adding songs: the Add a song sheet, the import picker and the review sheet,
 * opened in place on whichever page asked. Home's + used to jump to Songs and
 * open the sheet there, so closing it left you on another tab (owner,
 * 2026-11-15: "it's not ok").
 *
 * @param {null|'add'|'new'|'import'} mode  which sheet is up ('new' skips
 *   the Add a song chooser and opens the details form)
 * @param {(mode) => void} onMode
 */
export default function AddSongFlow({
  mode, onMode, songs = [], onSearchCatalog, onImportSongs, onImportSetlistFile, onEditImported, onBlank,
}) {
  const wide = useMediaQuery('(min-width: 640px)');
  const fileRef = useRef(null);
  const [reading, setReading] = useState(false);
  const [importError, setImportError] = useState('');
  const [review, setReview] = useState(null); // { items, failed, source }
  const artists = useMemo(() => libraryArtists(songs), [songs]);

  // A phone has no drag and drop, so Import goes straight to the file picker.
  const startImport = () => {
    setImportError('');
    if (wide) onMode('import'); else { onMode(null); fileRef.current?.click(); }
  };
  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setReading(true);
    setImportError('');
    try {
      const { songs: parsed, setlistFile, failed, error } = await parseImportFiles(files);
      if (setlistFile) { onMode(null); onImportSetlistFile?.(setlistFile); return; }
      if (!parsed.length) { setImportError(error || 'No songs found in those files.'); onMode('import'); return; }
      onMode(null);
      // One song: no list to tick, so open it in the editor to check before it
      // is added (nothing is saved until Add).
      if (parsed.length === 1 && !failed.length && onEditImported) { onEditImported(parsed[0]); return; }
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

  return (
    <>
      <AddSongSheet
        open={mode === 'add' || mode === 'new'}
        direct={mode === 'new'}
        onOpenChange={(o) => onMode(o ? mode : null)}
        onSearch={onSearchCatalog}
        onImport={onImportSongs ? startImport : null}
        onBlank={onBlank}
        songs={songs}
        artists={artists}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => { const f = e.target.files; readFiles(f).finally(() => { e.target.value = ''; }); }}
      />
      {onImportSongs && (
        <>
          <ImportPickSheet
            open={mode === 'import'}
            onOpenChange={(o) => onMode(o ? 'import' : null)}
            onFiles={readFiles}
            onChoose={() => fileRef.current?.click()}
            busy={reading}
            error={importError}
          />
          <ImportReviewSheet
            key={review ? review.source + review.items.length : 'none'}
            open={!!review}
            onOpenChange={(o) => { if (!o) setReview(null); }}
            items={review?.items}
            failed={review?.failed}
            source={review?.source}
            onAdd={(list) => onImportSongs?.(list.map(markToCheck))}
            onEditFirst={onEditImported}
          />
        </>
      )}
    </>
  );
}
