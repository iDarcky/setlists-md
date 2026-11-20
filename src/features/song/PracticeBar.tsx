import type { ReactNode } from 'react';
import { StickyNote, Type, Music2 } from 'lucide-react';

// Practice's own row, under the reader's click + backing track (approved
// mockup v3, owner 2026-11-20). Two labelled switches: what the chart shows,
// and whether notes show. Notes live HERE and not on the song page. The key
// is not repeated: the reader's top bar already has it.
//
// It sits on the chart's surface, so it takes the chart theme's colours, not
// the app's (a light chart in a dark app must not get a dark bar).

const text = 'var(--chart-text, var(--foreground))';
const muted = 'var(--chart-subtle, var(--muted-foreground))';
const rule = 'var(--chart-rule, var(--border))';

function Toggle({ on, onClick, icon, children, pressed }: {
  on: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  /** For an on/off switch; a two-way switch names its state in its text instead. */
  pressed?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed}
      className="inline-flex h-10 min-h-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-control border bg-transparent px-3 font-sans text-small font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
      style={{ color: on ? text : muted, borderColor: on ? text : rule }}>
      {icon}{children}
    </button>
  );
}

export function PracticeBar({ show, onShow, notes, onNotes, bandNote }: {
  show: 'chords' | 'lyrics';
  onShow: (show: 'chords' | 'lyrics') => void;
  notes: boolean;
  onNotes: (on: boolean) => void;
  /** The arrangement's note for the band, shown while Notes is on. */
  bandNote?: string;
}) {
  const note = bandNote?.trim();
  return (
    <div className="flex w-full flex-col gap-2 py-1">
      {notes && note && (
        <p className="m-0 line-clamp-2 text-small leading-5" style={{ color: text }}>
          <b className="font-semibold">Note: </b>{note}
        </p>
      )}
      <div className="flex gap-2">
        <Toggle on onClick={() => onShow(show === 'chords' ? 'lyrics' : 'chords')}
          icon={show === 'chords' ? <Music2 size={17} strokeWidth={1.8} /> : <Type size={17} strokeWidth={1.8} />}>
          {show === 'chords' ? 'Chords' : 'Lyrics only'}
        </Toggle>
        <Toggle on={notes} pressed={notes} onClick={() => onNotes(!notes)}
          icon={<StickyNote size={17} strokeWidth={1.8} />}>
          Notes
        </Toggle>
      </div>
    </div>
  );
}
