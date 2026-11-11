import { useCallback, useMemo, useState } from 'react';
import { resolveSongView, withArrangement, addArrangement } from '@/arrangements';
import { buildSongFlow } from '@/lib/songFlow';
import { transposeKey, keyPrefersSharps, semitonesBetween } from '@/music';
import { songFacts } from '@/lib/songPage';
import { sectionTone } from '@/lib/sectionTone';
import { transposeArrangement } from '@/lib/transposeArrangement';
import FullscreenReader from '@/features/reader/FullscreenReader';
import { printSong } from '@/pdf/printSetlist';
import { useWakeLock } from '@/hooks/useWakeLock';
import SongView from './SongView';
import SongChart from './SongChart';

// The song page: works out the facts from the library and setlists and hands
// them to SongView, which puts the details on top of the Reader in one scroll
// (owner, 2026-11-04: "details top and then the chart"); ⤢ opens the
// full-screen Reader. Replaces SongHub (canvas → "Song, edit and
// chart", 2026-10-30): details first, the chart one tap away.

export default function Song({
  song: songInput, setlists = [], onBack, onEdit, onPlay, onMoveSong, onCopySong, onDelete,
  onUpdateSong, onOpenSetlist, settings, onUpdateSettings, onTransposed, onUpgrade = null,
  initialShow = 'chords', layout = 'auto', embedded = false,
}) {
  const [now] = useState(() => Date.now());
  const [arrId, setArrId] = useState(songInput?.arrangements ? songInput.defaultArrangementId : undefined);
  const [semis, setSemis] = useState(0);
  const [show, setShow] = useState(initialShow); // 'chords' | 'lyrics' | 'details'
  const [full, setFull] = useState(false);
  useWakeLock(settings?.keepAwake === true);

  const song = useMemo(
    () => (songInput?.arrangements ? resolveSongView(songInput, arrId) : songInput),
    [songInput, arrId],
  );
  const accidentals = settings?.accidentals;
  const original = song?.key || 'C';
  const sharps = accidentals === 'sharps' ? true : accidentals === 'flats' ? false : keyPrefersSharps(transposeKey(original, semis));
  const shown = semis ? transposeKey(original, semis, sharps) : original;

  const step = useCallback((d) => {
    setSemis(s => { const n = s + d; return n > 6 ? n - 12 : n < -5 ? n + 12 : n; });
    onTransposed?.();
  }, [onTransposed]);
  // The Reader's own key control (in full screen) still names a key.
  const pickKey = useCallback((k) => {
    let d = semitonesBetween(original, k);
    if (d > 6) d -= 12; else if (d < -5) d += 12;
    setSemis(d);
    onTransposed?.();
  }, [original, onTransposed]);

  const arrangements = useMemo(() => (songInput?.arrangements || []).map(a => ({
    id: a.id, name: a.name || 'Untitled arrangement', key: a.key, tempo: a.tempo, capo: a.capo, isDefault: a.id === songInput.defaultArrangementId,
  })), [songInput]);
  const pickArrangement = (id) => { setArrId(id); setSemis(0); };

  const canEdit = !!onUpdateSong && Array.isArray(songInput?.arrangements);
  const everyone = canEdit ? () => {
    onUpdateSong(withArrangement(songInput, song._arrangementId, a => transposeArrangement(a, semis)));
    setSemis(0);
  } : null;
  const newArrangement = canEdit ? () => {
    const base = songInput.arrangements.find(a => a.id === song._arrangementId);
    const { song: next, arrangementId } = addArrangement(songInput, `${base?.name || 'Arrangement'} copy`, base);
    onUpdateSong(next);
    setArrId(arrangementId);
    setSemis(0);
  } : null;

  const facts = useMemo(() => songFacts(songInput, setlists, now), [songInput, setlists, now]);
  const flow = useMemo(() => (song ? (buildSongFlow(song).ordered || []).map(sec => sectionTone(sec?.type, settings?.customSectionTypes)) : []), [song, settings?.customSectionTypes]);

  if (!song) return null;

  const keyCtl = { shown, original, semis, onStep: step, onReset: () => setSemis(0), onEveryone: everyone };
  const menu = [
    onPlay && { label: 'Start a campfire with this song', sub: 'One song big, then pick what to sing next', onClick: () => onPlay(arrId) },
    { label: 'Print or save as PDF', onClick: () => printSong(song, { transpose: semis }) },
    onMoveSong && { label: 'Move to another church', onClick: onMoveSong },
    onCopySong && { label: 'Copy to another church', onClick: onCopySong },
    onDelete && { label: 'Delete song', danger: true, onClick: onDelete },
  ].filter(Boolean);
  const shared = { keyCtl, arrangements, arrangementId: song._arrangementId, onArrangement: pickArrangement, onNewArrangement: newArrangement };

  return (
    <>
      <SongView
        song={song}
        layout={layout}
        embedded={embedded}
        {...shared}
        facts={facts}
        flow={flow}
        leader={!!onEdit}
        onBack={onBack}
        onEdit={onEdit ? () => onEdit(arrId) : null}
        menu={menu}
        show={show}
        onShow={setShow}
        onFullScreen={() => setFull(true)}
        onOpenSetlist={onOpenSetlist}
        chart={(lead, tail) => (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {lead}
            <SongChart song={song} semis={semis} sharps={sharps} show={show} layout={layout} customSectionTypes={settings?.customSectionTypes} heading={settings?.readerHeading} />
            {tail}
          </div>
        )}
      />
      {full && (
        <FullscreenReader
          song={song}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onUpgrade={onUpgrade}
          displayMode={show === 'lyrics' ? 'lyrics' : 'chords'}
          selectedKey={shown}
          onSelectKey={pickKey}
          onClose={() => setFull(false)}
        />
      )}
    </>
  );
}
