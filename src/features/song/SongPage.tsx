import { useState } from 'react';
import { ArrowLeft, MoreHorizontal, Pencil, Play } from 'lucide-react';
import { cn } from '@/ui/shadcn/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { Button } from '@/ui/typed';
import { SwipeTabs } from '@/features/song-edit/SwipeTabs';
import { StartChart } from '@/features/song-edit/StartChart';
import { SongAbout } from './SongAbout';
import { ArrangementChip, Cover, KeyChip, MenuSheet, SongChart, SongMap } from './typed';
import type { Arrangement, Facts, KeyControl, MenuEntry, SectionCode, SongView } from './typed';

// The song page (approved mockup v3, owner 2026-11-20, after three rounds of
// questions). What it holds and why:
//
//   - The header says each fact ONCE: the arrangement and the key are the two
//     you can change, so they are the two with a ▾; tempo and time are text.
//   - Chart | About, swiped like the editor. The chart is plain text in the
//     app's theme (it must not look like the reader) and carries no notes:
//     notes belong in Practice. The section chips are a map, not buttons.
//   - About is how the band plays it (played, usual key and tempo), then the
//     arrangements, links, credits and tags. From the iPad in landscape up it
//     is a column beside the chart instead of a tab.
//   - One labelled Practice: floating at the bottom on a phone, in the header
//     on a wide screen. It replaces the unlabelled ⤢ and ▶.

const iconBtn = 'flex size-11 min-h-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring';

export type SongPageProps = {
  song: SongView;
  facts: Facts;
  flow: SectionCode[];
  keyCtl: KeyControl;
  semis: number;
  sharps: boolean;
  arrangements: Arrangement[];
  arrangementId?: string;
  onArrangement: (id: string) => void;
  onNewArrangement: (() => void) | null;
  /** Leaders only. `start` opens the editor on paste or write. */
  onEdit: ((start?: { mode: 'paste' | 'write'; text?: string }) => void) | null;
  onPractice: () => void;
  onBack?: () => void;
  backLabel?: string;
  menu: MenuEntry[];
  layout?: 'auto' | 'phone' | 'desk';
  embedded?: boolean;
};

export function SongPage({
  song, facts, flow, keyCtl, semis, sharps, arrangements, arrangementId, onArrangement, onNewArrangement,
  onEdit, onPractice, onBack, backLabel = 'Songs', menu, layout = 'auto', embedded = false,
}: SongPageProps) {
  // Two columns from the iPad in landscape up (1024px), as the editor does.
  const desk = useMediaQuery('(min-width: 1024px)');
  const wide = layout === 'desk' || (layout === 'auto' && desk);
  // Two chart columns only where each still holds a whole line.
  const roomy = useMediaQuery('(min-width: 1280px)') && layout !== 'phone';
  const [tab, setTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasChart = flow.length > 0;
  const leader = !!onEdit;

  const practice = hasChart && (wide ? (
    <Button onClick={onPractice} className="shrink-0 px-5"><Play size={16} fill="currentColor" />Practice</Button>
  ) : (
    // Floats over the chart, under the thumb; the pages leave room for it.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-chrome flex justify-center bg-gradient-to-t from-background via-background/80 to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6">
      <Button size="lg" onClick={onPractice} className="pointer-events-auto h-12 w-full max-w-[360px] rounded-full text-body shadow-lg">
        <Play size={18} fill="currentColor" />Practice
      </Button>
    </div>
  ));

  const chart = hasChart ? (
    <div className={cn(!wide && 'pb-28')}>
      <SongMap codes={flow} className="px-3 pt-3" />
      <SongChart song={song} semis={semis} sharps={sharps} show="chords" layout={wide && roomy ? 'desk' : 'phone'} notes={false} />
    </div>
  ) : leader ? (
    <div className="px-4 pt-5">
      <StartChart wide={wide} onPaste={(text) => onEdit?.({ mode: 'paste', text })} onWrite={() => onEdit?.({ mode: 'write' })} />
    </div>
  ) : (
    <p className="m-0 px-5 pt-10 text-center text-body text-muted-foreground">No chart yet. A leader can add the words and chords.</p>
  );
  const about = <SongAbout song={song} facts={facts} arrangements={arrangements} leader={leader} />;

  const header = (
    <>
      <div className="flex min-h-14 shrink-0 items-center gap-1 px-2 pt-1">
        {onBack && <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className={cn(iconBtn, 'text-muted-foreground')}><ArrowLeft size={20} strokeWidth={1.8} /></button>}
        <span className="flex-1" />
        {onEdit && <button type="button" aria-label="Edit song" title="Edit song" onClick={() => onEdit()} className={iconBtn}><Pencil size={19} strokeWidth={1.8} /></button>}
        {menu.length > 0 && <button type="button" aria-label="More" title="More" onClick={() => setMenuOpen(true)} className={iconBtn}><MoreHorizontal size={20} strokeWidth={1.8} /></button>}
      </div>
      <div className={cn('flex shrink-0 gap-6 px-4 pb-3', wide && 'items-end justify-between px-6 pb-5')}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Cover song={song} size={wide ? 72 : 64} />
            <div className="flex min-w-0 flex-col">
              <h1 className={cn('m-0 truncate font-semibold tracking-[-0.3px]', wide ? 'text-[28px] leading-9' : 'text-title leading-7')}>{song.title || 'Untitled'}</h1>
              {song.artist && <span className="truncate text-body text-muted-foreground">{song.artist}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ArrangementChip arrangements={arrangements} current={arrangementId} onPick={onArrangement} onNew={onNewArrangement} />
            <KeyChip {...keyCtl} />
            {song.tempo && <span className="px-1.5 text-small font-medium text-muted-foreground">{song.tempo} BPM</span>}
            {song.time && <span className="px-1.5 text-small font-medium text-muted-foreground">{song.time}</span>}
            {Number(song.capo) > 0 && <span className="px-1.5 text-small font-medium text-muted-foreground">Capo {song.capo}</span>}
          </div>
        </div>
        {wide && practice}
      </div>
    </>
  );

  return (
    <div data-slot="song" className={cn('relative flex flex-col bg-background font-sans text-foreground', embedded ? 'absolute inset-0' : 'h-full min-h-0')}>
      {header}
      {wide ? (
        <div className="flex min-h-0 flex-1 border-t border-border">
          <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-10">{chart}</main>
          <aside aria-label="About this song" className="w-[360px] shrink-0 overflow-y-auto border-l border-border">{about}</aside>
        </div>
      ) : (
        <>
          <SwipeTabs labels={['Chart', 'About']} index={tab} onIndex={setTab} pages={[chart, about]} />
          {practice}
        </>
      )}
      <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} title={song.title} items={menu} />
    </div>
  );
}
