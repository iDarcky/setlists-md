import { useCallback, useMemo, useState } from 'react';
import { resolveSongView, withArrangement, addArrangement } from '@/arrangements';
import { buildSongFlow } from '@/lib/songFlow';
import { transposeKey, keyPrefersSharps, semitonesBetween } from '@/music';
import { songFacts, flowCodes } from '@/lib/songPage';
import { transposeArrangement } from '@/lib/transposeArrangement';
import Reader from '@/features/reader/Reader';
import FullscreenReader from '@/features/reader/FullscreenReader';
import { exportSongPdf } from '@/pdf/exportSongPdf';
import { useWakeLock } from '@/hooks/useWakeLock';
import SongView from './SongView';
import SongChartView from './SongChartView';

// The song page: works out the facts from the library and setlists and hands
// them to SongView; "Open chart" swaps in SongChartView with the Reader, and ⤢
// opens the full-screen Reader. Replaces SongHub (canvas → "Song, edit and
// chart", 2026-10-30): details first, the chart one tap away.

export default function Song({
  song: songInput, setlists = [], onBack, onEdit, onPlay, onMoveSong, onCopySong, onDelete,
  onUpdateSong, onOpenSetlist, settings, onUpdateSettings, onTransposed, onUpgrade = null,
  initialScreen = 'details', layout = 'auto', embedded = false,
}) {
  const [now] = useState(() => Date.now());
  const [arrId, setArrId] = useState(songInput?.arrangements ? songInput.defaultArrangementId : undefined);
  const [semis, setSemis] = useState(0);
  const [screen, setScreen] = useState(initialScreen); // 'details' | 'chart'
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
  const flow = useMemo(() => (song ? flowCodes(buildSongFlow(song).ordered || [], settings?.customSectionTypes) : []), [song, settings?.customSectionTypes]);

  if (!song) return null;

  const keyCtl = { shown, original, semis, onStep: step, onReset: () => setSemis(0), onEveryone: everyone };
  const menu = [
    onPlay && { label: 'Start a campfire with this song', sub: 'One song big, then pick what to sing next', onClick: () => onPlay(arrId) },
    { label: 'Print or save as PDF', onClick: () => exportSongPdf(song, { transpose: semis }) },
    onMoveSong && { label: 'Move to another church', onClick: onMoveSong },
    onCopySong && { label: 'Copy to another church', onClick: onCopySong },
    onDelete && { label: 'Delete song', danger: true, onClick: onDelete },
  ].filter(Boolean);
  const shared = { keyCtl, arrangements, arrangementId: song._arrangementId, onArrangement: pickArrangement, onNewArrangement: newArrangement };

  return (
    <>
      {screen === 'chart' ? (
        <SongChartView embedded={embedded} title={song.title} onBack={() => setScreen('details')} onFullScreen={() => setFull(true)} {...shared}>
          {/* Unmounted while full screen is open: two Readers in the DOM share ids (see SongHub's note). */}
          {!full && (
            <Reader
              embedded
              song={song}
              displayMode="chords"
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              selectedKey={shown}
              onSelectKey={pickKey}
            />
          )}
        </SongChartView>
      ) : (
        <SongView
          song={song}
          layout={layout}
          embedded={embedded}
          {...shared}
          facts={facts}
          flow={flow}
          onBack={onBack}
          onEdit={onEdit ? () => onEdit(arrId) : null}
          menu={menu}
          onOpenChart={() => setScreen('chart')}
          onFullScreen={() => setFull(true)}
          onOpenSetlist={onOpenSetlist}
        />
      )}
      {full && (
        <FullscreenReader
          song={song}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onUpgrade={onUpgrade}
          displayMode="chords"
          selectedKey={shown}
          onSelectKey={pickKey}
          onClose={() => setFull(false)}
        />
      )}
    </>
  );
}
