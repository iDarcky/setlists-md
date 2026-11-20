import { useCallback, useMemo, useState } from 'react';
import { resolveSongView, withArrangement, addArrangement } from '@/arrangements';
import { buildSongFlow } from '@/lib/songFlow';
import { transposeKey, keyPrefersSharps, semitonesBetween } from '@/music';
import { songFacts } from '@/lib/songPage';
import { sectionTone as sectionToneJs } from '@/lib/sectionTone';
import { transposeArrangement } from '@/lib/transposeArrangement';
import { readerSettingKey } from '@/lib/readerConfig';
import { FullscreenReader } from './typed';
import { printSong } from '@/pdf/printSetlist';
import { useWakeLock } from '@/hooks/useWakeLock';
import { SongPage } from './SongPage';
import { PracticeBar } from './PracticeBar';
import type { Arrangement, Facts, MenuEntry, SectionCode, SongView } from './typed';

// The song page: works out the facts from the library and setlists and hands
// them to SongPage. Practice opens the reader full screen, in practice mode,
// in the key picked here (owner, 2026-11-20).

type StoredArrangement = { id: string; name?: string; key?: string; tempo?: number | string; capo?: number | string };
type StoredSong = SongView & { id: string; arrangements?: StoredArrangement[]; defaultArrangementId?: string };
type ResolvedSong = SongView & { _arrangementId?: string };
type Settings = Record<string, unknown> & { keepAwake?: boolean; accidentals?: string; customSectionTypes?: unknown };
// JS default `custom = null` reads to TypeScript as "only null".
const sectionTone = sectionToneJs as (type?: string, custom?: unknown) => SectionCode;
type EditStart = { mode: 'paste' | 'write'; text?: string };

export default function Song({
  song: songInput, setlists = [], onBack, onEdit, onPlay, onDelete,
  onUpdateSong, settings, onUpdateSettings, onTransposed,
  layout = 'auto', embedded = false,
}: {
  song: StoredSong;
  setlists?: unknown[];
  onBack?: () => void;
  onEdit?: ((arrangementId?: string, start?: EditStart) => void) | null;
  onPlay?: ((arrangementId?: string) => void) | null;
  onDelete?: (() => void) | null;
  onUpdateSong?: ((song: StoredSong) => void) | null;
  settings?: Settings;
  onUpdateSettings?: (key: string, value: unknown) => void;
  onTransposed?: () => void;
  layout?: 'auto' | 'phone' | 'desk';
  embedded?: boolean;
}) {
  const [now] = useState(() => Date.now());
  const [arrId, setArrId] = useState<string | undefined>(songInput?.arrangements ? songInput.defaultArrangementId : undefined);
  const [semis, setSemis] = useState(0);
  const [practice, setPractice] = useState(false);
  // Practice's own switches. Notes start ON: Practice is where they live.
  const [show, setShow] = useState<'chords' | 'lyrics'>('chords');
  const [notes, setNotes] = useState(true);
  useWakeLock(settings?.keepAwake === true);

  const song: ResolvedSong | null = useMemo(
    () => (songInput?.arrangements ? resolveSongView(songInput, arrId) : songInput),
    [songInput, arrId],
  );
  const accidentals = settings?.accidentals;
  const original = song?.key || 'C';
  const sharps = accidentals === 'sharps' ? true : accidentals === 'flats' ? false : keyPrefersSharps(transposeKey(original, semis));
  const shown = semis ? transposeKey(original, semis, sharps) : original;

  const step = useCallback((d: number) => {
    setSemis(s => { const n = s + d; return n > 6 ? n - 12 : n < -5 ? n + 12 : n; });
    onTransposed?.();
  }, [onTransposed]);
  // The reader's own key control (in Practice) names a key.
  const pickKey = useCallback((k: string) => {
    let d = semitonesBetween(original, k);
    if (d > 6) d -= 12; else if (d < -5) d += 12;
    setSemis(d);
    onTransposed?.();
  }, [original, onTransposed]);

  const arrangements: Arrangement[] = useMemo(() => (songInput?.arrangements || []).map(a => ({
    id: a.id, name: a.name || 'Untitled arrangement', key: a.key, tempo: a.tempo, capo: a.capo, isDefault: a.id === songInput.defaultArrangementId,
  })), [songInput]);
  const pickArrangement = (id: string) => { setArrId(id); setSemis(0); };

  const canEdit = !!onUpdateSong && Array.isArray(songInput?.arrangements);
  const everyone = canEdit && song ? () => {
    onUpdateSong!(withArrangement(songInput, song._arrangementId, (a: never) => transposeArrangement(a, semis)));
    setSemis(0);
  } : null;
  const newArrangement = canEdit && song ? () => {
    const base = songInput.arrangements!.find(a => a.id === song._arrangementId);
    const { song: next, arrangementId } = addArrangement(songInput, `${base?.name || 'Arrangement'} copy`, base);
    onUpdateSong!(next);
    setArrId(arrangementId);
    setSemis(0);
  } : null;

  const facts: Facts = useMemo(() => songFacts(songInput, setlists, now), [songInput, setlists, now]);
  const flow: SectionCode[] = useMemo(
    () => (song ? (buildSongFlow(song).ordered || []).map((sec: { type?: string } | null) => sectionTone(sec?.type, settings?.customSectionTypes)) : []),
    [song, settings?.customSectionTypes],
  );
  // The reader's notes switches, set for Practice only; the saved settings are untouched.
  const practiceSettings = useMemo(() => ({
    ...settings,
    [readerSettingKey('notes')]: notes ? 'on' : 'off',
    [readerSettingKey('inlineNotes')]: notes ? 'on' : 'off',
  }), [settings, notes]);

  if (!song) return null;

  // Move / copy to another church were listed here but never passed in by App:
  // they never showed (owner, 2026-11-20: keep what is used).
  const menu = [
    onPlay && { label: 'Start a campfire with this song', sub: 'One song big, then pick what to sing next', onClick: () => onPlay(arrId) },
    { label: 'Print or save as PDF', onClick: () => printSong(song, { transpose: semis }) },
    onDelete && { label: 'Delete song', danger: true, onClick: onDelete },
  ].filter(Boolean) as MenuEntry[];

  return (
    <>
      <SongPage
        song={song}
        facts={facts}
        flow={flow}
        keyCtl={{ shown, original, semis, onStep: step, onReset: () => setSemis(0), onEveryone: everyone }}
        semis={semis}
        sharps={sharps}
        arrangements={arrangements}
        arrangementId={song._arrangementId}
        onArrangement={pickArrangement}
        onNewArrangement={newArrangement}
        onEdit={onEdit ? (start) => onEdit(arrId, start) : null}
        onPractice={() => setPractice(true)}
        onBack={onBack}
        menu={menu}
        layout={layout}
        embedded={embedded}
      />
      {practice && (
        <FullscreenReader
          song={song}
          settings={practiceSettings}
          onUpdateSettings={onUpdateSettings}
          mode="practice"
          practiceAlways
          displayMode={show}
          selectedKey={shown}
          onSelectKey={pickKey}
          footer={<PracticeBar show={show} onShow={setShow} notes={notes} onNotes={setNotes} bandNote={song.notes} />}
          onClose={() => setPractice(false)}
        />
      )}
    </>
  );
}
