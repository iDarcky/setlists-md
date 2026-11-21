import { useMemo, useRef, useState } from 'react';
import { parseImportFiles, scannedFiles, IMPORT_ACCEPT } from '@/lib/importFiles';
import { markToCheck } from '@/lib/importCheck';
import { matchSongByTitle } from '@/lib/setlistLinks';
import { libraryArtists } from '@/features/song-edit/newSongDetails';
import { NewSongSheet } from './NewSongSheet';
import { ImportPickSheet, ImportReviewSheet } from './ImportSheets';
import { ImportScanSheet } from './ImportScanSheet';

/**
 * Adding songs: the New song sheet, the import picker and the review sheet,
 * opened in place on whichever page asked. Home's + used to jump to Songs and
 * open the sheet there, so closing it left you on another tab (owner,
 * 2026-11-15: "it's not ok"). The + menu picks New song or Import directly,
 * so there is no "Add a song" chooser any more (owner, 2026-11-20).
 *
 * @param {null|'new'|'import'} mode  which sheet is up
 * @param {(mode) => void} onMode
 * @param {string} [newTitle]  New song starts with this name (a setlist's search)
 * @param {string} [addTo]     a setlist's name: "Add 3 songs to Sunday"
 * @param {React.ReactNode} [newNote]  one line on the New song sheet
 */
export default function AddSongFlow({
  mode, onMode, songs = [], onImportSongs, onImportSetlistFile, onEditImported, onBlank,
  newTitle = '', addTo = '', newNote = null,
}) {
  const fileRef = useRef(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState([]); // [{ name, state }]: the Reading list
  const [importError, setImportError] = useState('');
  const [review, setReview] = useState(null); // { items, failed, source }
  const [scan, setScan] = useState(null); // { scans, next }: photos of pages, before the review
  const [pasteTitle, setPasteTitle] = useState(null); // a scan to type in once the review is done
  const artists = useMemo(() => libraryArtists(songs), [songs]);
  const [sheetTitle, setSheetTitle] = useState('');
  const newSong = (title) => { setSheetTitle(title); onMode('new'); };

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setReading(true);
    setImportError('');
    setProgress(files.filter(f => !/\.zip$/i.test(f.name)).map(f => ({ name: f.name, state: 'waiting' })));
    const onFile = (name, state) => setProgress(list => list.map(f => (f.name === name ? { ...f, state } : f)));
    try {
      const { songs: parsed, setlistFile, failed, error } = await parseImportFiles(files, onFile);
      if (setlistFile) { onMode(null); onImportSetlistFile?.(setlistFile); return; }
      const scans = scannedFiles(failed);
      if (!parsed.length && !scans.length) { setImportError(error || 'No songs found in those files.'); onMode('import'); return; }
      onMode(null);
      const list = {
        items: parsed.map(song => ({ song, existing: matchSongByTitle(songs, song.title) || null })),
        failed: failed.filter(f => !scans.some(n => f.startsWith(n))),
        source: files.length === 1 ? files[0].name : `${files.length} files`,
      };
      // One song: no list to tick, so open it in the editor to check before it
      // is added (nothing is saved until Add).
      const single = parsed.length === 1 && !failed.length && onEditImported && !addTo;
      if (scans.length) { setScan({ scans, next: parsed.length ? list : null }); return; }
      if (single) { onEditImported(parsed[0]); return; }
      setReview(list);
    } catch {
      setImportError('Could not read one or more files.');
    } finally {
      setReading(false);
      setProgress([]);
    }
  };
  // After the scan sheet: the songs that were read, then (if asked) the scan
  // as a new song to paste the words into.
  const afterScan = (paste) => {
    const next = scan?.next;
    setScan(null);
    const title = paste ? paste.replace(/\.pdf$/i, '') : null;
    if (next) { setReview(next); setPasteTitle(title); } else if (title) newSong(title);
  };
  const closeReview = () => {
    setReview(null);
    if (pasteTitle) { const t = pasteTitle; setPasteTitle(null); newSong(t); }
  };

  return (
    <>
      <NewSongSheet
        open={mode === 'new'}
        onOpenChange={(o) => { onMode(o ? 'new' : null); if (!o) setSheetTitle(''); }}
        onNext={(d) => onBlank?.(d)}
        songs={songs}
        artists={artists}
        initialTitle={sheetTitle || newTitle}
        note={newNote}
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
            onOpenChange={(o) => { if (o) onMode('import'); else { onMode(null); setImportError(''); } }}
            onFiles={readFiles}
            onChoose={() => fileRef.current?.click()}
            busy={reading}
            progress={progress}
            error={importError}
          />
          <ImportScanSheet
            open={!!scan}
            scans={scan?.scans || []}
            readCount={scan?.next?.items.length || 0}
            onSkip={() => afterScan(null)}
            onPaste={(name) => afterScan(name)}
          />
          <ImportReviewSheet
            key={review ? review.source + review.items.length : 'none'}
            open={!!review}
            onOpenChange={(o) => { if (!o) closeReview(); }}
            items={review?.items}
            failed={review?.failed}
            source={review?.source}
            onAdd={(list) => onImportSongs?.(list.map(markToCheck))}
            onEditFirst={addTo ? null : onEditImported}
            addTo={addTo}
          />
        </>
      )}
    </>
  );
}
