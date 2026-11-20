import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Button, Sheet } from '@/ui/typed';
import { NewSongForm as NewSongFormJs } from '@/features/song-edit/NewSongForm';
import { detailsMissing, EMPTY_DETAILS } from '@/features/song-edit/newSongDetails';
import { normalizeText } from '@/lib/search';

// New song: Name, Artist, Key, BPM (required) and Time chips, then Next: Chart
// opens the editor with them filled in (approved mockup v2, screens 4 and 5;
// owner 2026-11-20: no More). The same sheet everywhere a song is started:
// the + menu on Home and Songs, and a setlist's search ("New song "Oceans"").

export interface SongDetails {
  title: string;
  artist: string;
  key: string;
  tempo: number | null;
  time: string;
}

interface LibrarySong { title?: string; artist?: string }

const NewSongForm = NewSongFormJs as unknown as ComponentType<{
  value: SongDetails;
  onChange: (v: SongDetails) => void;
  artists: string[];
  sameTitle: LibrarySong | null;
}>;

const FORM_ID = 'new-song-details';

export function NewSongSheet({ open, onOpenChange, onNext, songs = [], artists = [], initialTitle = '', note = null, nextLabel = 'Next: Chart' }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext: (details: SongDetails) => void;
  songs?: LibrarySong[];
  artists?: string[];
  /** Typed into a search before: "Oceans". */
  initialTitle?: string;
  /** One line over the form, e.g. where the song will go. */
  note?: ReactNode;
  nextLabel?: string;
}) {
  const fresh = (): SongDetails => ({ ...(EMPTY_DETAILS as SongDetails), title: initialTitle });
  const [details, setDetails] = useState<SongDetails>(fresh);
  const [opened, setOpened] = useState(open);
  // Each opening starts clean (and picks up a new initialTitle).
  if (open !== opened) { setOpened(open); if (open) setDetails(fresh()); }

  const missing = detailsMissing(details) as string | null;
  const t = normalizeText(details.title || '').trim();
  const sameTitle = t ? songs.find(x => normalizeText(x.title || '').trim() === t) || null : null;
  const next = () => { if (missing) return; onOpenChange(false); onNext(details); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New song" className="sm:max-w-[480px]"
      footer={<>
        <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit" form={FORM_ID} className="flex-[2]" disabled={!!missing}>{nextLabel}</Button>
      </>}>
      <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); next(); }}>
        {note && <div className="rounded-card bg-raised px-3.5 py-2.5 text-small">{note}</div>}
        <NewSongForm value={details} onChange={setDetails} artists={artists} sameTitle={sameTitle} />
        {missing && <p className="m-0 text-small text-muted-foreground">Still needs {missing}.</p>}
      </form>
    </Sheet>
  );
}
