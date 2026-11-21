import { Button, Sheet } from '@/ui/typed';

// A PDF that is a photo of a page has no text for us to read (no OCR yet).
// Say so plainly and offer the way that works: paste the words (approved
// mockup, import row, owner 2026-11-20).

export function ImportScanSheet({ open, scans, readCount, onSkip, onPaste }: {
  open: boolean;
  /** File names, e.g. "Viața mea.pdf". */
  scans: string[];
  /** How many other songs were read (shown next). */
  readCount: number;
  onSkip: () => void;
  /** Only offered for one scan: a new song named after the file. */
  onPaste: (name: string) => void;
}) {
  const one = scans.length === 1;
  const others = readCount === 0 ? null
    : `The other ${readCount === 1 ? 'song was' : `${readCount} songs were`} read. You’ll see ${readCount === 1 ? 'it' : 'them'} next.`;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onSkip(); }} title="Import songs" className="h-auto sm:max-w-[480px]"
      footer={<>
        <Button variant="outline" className="flex-1" onClick={onSkip}>{one ? 'Skip it' : 'Skip them'}</Button>
        {one && <Button className="flex-[2]" onClick={() => onPaste(scans[0])}>Paste the words instead</Button>}
      </>}>
      <div className="flex flex-col gap-3">
        <div role="status" className="rounded-control bg-warning-fill px-3.5 py-2.5 text-small text-warning-text">
          {one
            ? <><b className="font-semibold">{scans[0]} is a photo of a page.</b> There’s no text in it for us to read.</>
            : <><b className="font-semibold">{scans.length} files are photos of pages:</b> {scans.join(', ')}. There’s no text in them for us to read.</>}
        </div>
        <p className="m-0 text-small text-muted-foreground">PDFs saved from a website or a Word file have text. Scans and phone photos don’t.{one ? '' : ' Add those songs with New song and paste the words.'}</p>
        {others && <p className="m-0 text-small text-muted-foreground">{others}</p>}
      </div>
    </Sheet>
  );
}
