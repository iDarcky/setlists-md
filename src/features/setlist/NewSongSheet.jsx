import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { parseImportFiles, songFromPaste, IMPORT_ACCEPT } from '@/lib/importFiles';
import { markToCheck } from '@/lib/importCheck';
import { ImportReviewSheet } from '@/features/songs/ImportSheets';

// "New song" from the setlist's Add songs list (QA 11 Nov: a song the library
// doesn't have yet meant leaving the setlist, importing it on Songs, then
// coming back). Two ways in, and both end with the song in the library,
// tagged "To check", and in the setlist — without leaving it.
//
//   Import a file  PDF (Melodia), ChordPro, OpenSong, .md or a .zip
//   Paste the song a title and the whole song in one box; sections are found
//
// `onCreate(songs)` gets the new song objects; the caller adds them to the
// library and to the setlist.

const Svg = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const FileIcon = () => <Svg><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" /></Svg>;
const PasteIcon = () => <Svg><path d="M9 4h6v3H9z" /><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2M9 12h6M9 16h4" /></Svg>;

function Option({ icon, title, text, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-card border border-border bg-card px-4 py-3.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[15px] font-semibold">{title}</b>
        <span className="text-[13px] text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

export function NewSongBody({ mode, setMode, title, setTitle, text, setText, busy, error, onImport, onPaste }) {
  if (mode === 'paste') {
    return (
      <div className="flex flex-col gap-3">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title" aria-label="Song title" className="h-11" autoFocus={!title} />
        <textarea value={text} onChange={e => setText(e.target.value)} autoFocus={!!title}
          aria-label="The song"
          placeholder={'Paste or type the whole song.\n\nVerse 1\nAmazing grace, how sweet the sound\n\nChorus\n…'}
          className="min-h-[240px] w-full resize-y rounded-control border border-input bg-transparent px-3.5 py-3 font-sans text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
        <p className="m-0 text-[13px] text-muted-foreground">Sections are found from lines like “Verse 1”, “Chorus”, “Strofa” or “Refren”. Chords over the lyrics are kept.</p>
        {error && <p role="alert" className="m-0 text-[14px] text-danger-text">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setMode('pick')}>Back</Button>
          <Button className="flex-1" disabled={!title.trim() && !text.trim()} onClick={onPaste}>Add to setlist</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <Option icon={<FileIcon />} title={busy ? 'Reading…' : 'Import a file'} text="A PDF from Melodia, ChordPro, OpenSong, .md, or a .zip of many." onClick={onImport} disabled={busy} />
      <Option icon={<PasteIcon />} title="Paste the song" text="A title and the whole song in one box." onClick={() => setMode('paste')} />
      {error && <p role="alert" className="m-0 text-[14px] text-danger-text">{error}</p>}
      <p className="m-0 pt-1 text-[13px] text-muted-foreground">It goes into Songs tagged “To check” and into this setlist. Only add songs your church has a licence for (CCLI).</p>
    </div>
  );
}

export default function NewSongSheet({ open, onOpenChange, initialTitle = '', onCreate }) {
  const [mode, setMode] = useState('pick');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const fileRef = useRef(null);

  // Each opening starts clean, with the search words as the title.
  useEffect(() => {
    if (!open) return;
    setMode('pick'); setTitle(initialTitle || ''); setText(''); setError(''); setBusy(false);
  }, [open, initialTitle]);

  const finish = (list) => {
    onCreate?.(list.map(markToCheck));
    onOpenChange?.(false);
  };

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setError('');
    try {
      const { songs: parsed, failed, error: err } = await parseImportFiles(files);
      if (!parsed.length) { setError(err || 'No songs found in that file.'); return; }
      if (parsed.length === 1 && !failed.length) { finish(parsed); return; }
      setReview({ items: parsed.map(song => ({ song, existing: null })), failed, source: files.length === 1 ? files[0].name : `${files.length} files` });
      onOpenChange?.(false);
    } catch {
      setError('Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const paste = () => {
    const song = songFromPaste(title, text);
    if (!song) { setError('Type a title or paste the song first.'); return; }
    finish([song]);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title={mode === 'paste' ? 'Paste the song' : 'New song'} className="h-auto max-h-[92dvh] sm:max-w-[520px]">
        <NewSongBody mode={mode} setMode={(m) => { setError(''); setMode(m); }} title={title} setTitle={setTitle} text={text} setText={setText}
          busy={busy} error={error} onImport={() => fileRef.current?.click()} onPaste={paste} />
      </Sheet>
      <input ref={fileRef} type="file" multiple accept={IMPORT_ACCEPT} className="hidden"
        onChange={(e) => { const f = e.target.files; readFiles(f).finally(() => { e.target.value = ''; }); }} />
      <ImportReviewSheet
        key={review ? review.source + review.items.length : 'none'}
        open={!!review}
        onOpenChange={(o) => { if (!o) setReview(null); }}
        items={review?.items}
        failed={review?.failed}
        source={review?.source}
        onAdd={(list) => { setReview(null); onCreate?.(list.map(markToCheck)); }}
      />
    </>
  );
}
