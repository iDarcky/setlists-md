import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { semitonesBetween, keysInQualityOf } from '@/music';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { IconButton } from '@/ui/IconButton';
import { buildSongFlow } from '@/lib/songFlow';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useActiveSection } from '@/hooks/useActiveSection';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import ReaderSection from './ReaderSection';
import ReaderTopBar, { BAR_BUTTON } from './ReaderTopBar';
import { chartSurface, hubSurface } from './readerSurface';
import ReaderPracticeRow, { MetronomeIcon } from './ReaderPracticeRow';
import AaMenu from '@/features/chart/AaMenu';
import ReaderMenu from './ReaderMenu';
import { useWakeLock } from '@/hooks/useWakeLock';
import ChordPopover from '@/features/chart/ChordPopover';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useMetronome } from '@/hooks/useMetronome';
import { clampTempo } from '@/lib/metronome';

/**
 * The chart reader — elements 1–6 only.
 *
 *   1  top bar          menu · title · key · tempo/time · exit
 *   2  structure ribbon fixed, positionable, tracks where you are
 *   3  section heading  sticky, styled, weighted
 *   4  band cue         on the heading's line, `!` reads as loud
 *   5  inline notes     leader-dotted on wide, above the line on narrow
 *   6  chords           unchanged; --chord follows the chart theme
 *
 * Nothing else. No presets, no paging, no tools bar — those come back once
 * the remaining elements are designed, not before.
 *
 * The chart body is still `SectionBlock`; this owns the frame around it.
 */
export default function Reader({
  song: songProp,
  arrangementId,
  myInstrument = null,
  settings,
  onUpdateSettings,
  onExit,
  embedded = false,
  // The Song Hub's Chart / Lyrics tabs. When the host NAMES a mode it wins over
  // the global `showChords` setting — otherwise a toggle flipped on some other
  // surface silently turns the Chart tab into a second Lyrics tab, which is
  // exactly what it was doing.
  displayMode = null,
  selectedKey,
  onSelectKey,
  footer,
  // Element 10, 'swipe': a horizontal-dominant swipe on the chart advances.
  // Vertical scroll is untouched — the gesture only fires past a threshold
  // where |dx| clearly beats |dy|.
  onSwipeLeft,
  onSwipeRight,
  // The Song Hub owns the Aa button when embedded and hands its anchor rect
  // down, exactly as it did to ChartView.
  aaAnchor: hostAaAnchor,
  onAaClose,
  // Element 8: what hangs under the top bar in place of the ribbon. The setlist
  // knows the set; the reader only knows one song, so the host supplies it.
  underBar = null,
  // The rail opener, for the same reason: only the host knows there IS a set.
  // Sits beside ☰ in the bar's left cluster.
  railButton = null,
  // 'live' | 'practice'. Until now the reader had ONE behaviour and three route
  // names (`setlist-play`, `setlist-performance`, `setlist-practice`), which is
  // why every practice-only decision — writing a note, switching arrangement —
  // had nowhere to attach: the reader could not tell which one it was in.
  mode = 'live',
  // Element 12: a tapped tempo writes back to the song (owner, 2026-08-01), so
  // the reader needs a way to save one. Absent → the tempo stays session-only.
  onUpdateSong = null,
}) {
  const scrollRef = useRef(null);
  const touchRef = useRef(null);
  const onTouchStart = useCallback((e) => {
    const t0 = e.touches?.[0];
    touchRef.current = t0 ? { x: t0.clientX, y: t0.clientY } : null;
  }, []);
  const onTouchEnd = useCallback((e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t1 = e.changedTouches?.[0];
    if (!t1) return;
    const dx = t1.clientX - start.x;
    const dy = t1.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.();
  }, [onSwipeLeft, onSwipeRight]);
  // The chrome is sticky at the top of the scroller, so anything else that
  // pins — the section headings — must pin BELOW it, and any scroll-to must
  // stop below it too. Measured rather than hard-coded: the bar's height
  // changes with the ribbon style and with the phone/desktop padding.
  const headRef = useRef(null);
  const [headH, setHeadH] = useState(0);
  // The ☰ menu, anchored to its button. Standalone this opens `ReaderMenu` —
  // the reader's own four-row menu. EMBEDDED (the Song Hub, the side peek) the
  // host owns the Aa button and passes a rect down, and that still opens
  // `AaMenu`: the hub is a browsing surface with its own fixed look, and giving
  // it the reader's menu would reconnect the two surfaces that were
  // deliberately disconnected (`docs/READER.md` → "The hub view").
  const [ownAaAnchor, setOwnAaAnchor] = useState(null);
  // Element 11 — the chord you tapped, and where it was.
  const [tappedChord, setTappedChord] = useState(null);
  const { allowed: canSeeShapes } = useEntitlement('chord-diagrams');
  const onChordTap = useCallback((chord, rect) => {
    setTappedChord(prev => (prev?.chord === chord ? null : { chord, rect }));
  }, []);
  const wide = useMediaQuery('(min-width: 768px)');

  // Callers should pass a resolved arrangement view; accept a raw v2 song too,
  // because getting it wrong renders a silently blank chart.
  const song = songProp?.arrangements ? resolveSongView(songProp, arrangementId) : songProp;

  // ── Element 12 — practice tools ──────────────────────────────────────────
  // Round 1 is the click plus a tempo, and the backing track plus a speed. No
  // count-in, no section loop, no wake lock — those were explicitly out.
  //
  // Nothing here is persisted, by decision: the tempo re-seeds from the song and
  // the click STOPS on a song change, so there is no stored knob to sync and
  // no way to walk into the next song with a click you forgot was running.
  const [practiceOpen, setPracticeOpen] = useState(false);
  const metronome = useMetronome();

  // The tempo is DERIVED, not re-seeded by an effect. It is stamped with the
  // song it belongs to, so arriving at a new song falls straight back to that
  // song's written tempo — no effect, no render with last song's number in it.
  const songId = song?.id;
  const songTempo = song?.tempo;
  const writtenBpm = clampTempo(songTempo || 100);
  const [tempoSet, setTempoSet] = useState(null);
  const bpm = tempoSet?.id === songId ? tempoSet.bpm : writtenBpm;

  // The icon OPENS the row and nothing more. It used to start the click too,
  // which meant a tap to see the tempo filled a quiet room with a click — the
  // tool announcing itself before being asked. Starting is the row's own play
  // button. Closing still stops, because a click with no visible control is
  // worse than no click.
  const togglePractice = useCallback(() => {
    if (practiceOpen) metronome.stop();
    setPracticeOpen(o => !o);
  }, [practiceOpen, metronome]);

  const setTempo = metronome.setTempo; // stable; the metronome object itself is not
  const changeBpm = useCallback((next) => {
    const v = clampTempo(next);
    setTempoSet({ id: songId, bpm: v });
    setTempo(v);
  }, [songId, setTempo]);

  // A click left running from the last song is worse than silence: it is
  // confidently wrong. Stopping the audio engine is a real external-system
  // sync, so it IS an effect — unlike the tempo, which is derived above.
  const stopClick = metronome.stop;
  useEffect(() => { stopClick(); }, [songId, stopClick]);

  const config = useMemo(
    () => resolveReaderConfig(settings, { wide, embedded, myInstrument }),
    [settings, wide, embedded, myInstrument]
  );

  // The ☰ → "The screen" row. Only where the reader owns the screen: embedded
  // in the hub it is a card in a page, and holding a wake lock for a card is
  // the app quietly deciding your phone shouldn't sleep while you browse.
  useWakeLock(!embedded && settings?.keepAwake === true);

  const { ordered, offsets, repeats } = useMemo(() => buildSongFlow(song), [song]);

  // The active section IS whichever heading is pinned — so the reading line
  // sits at the pin, not a third of the way down. Otherwise the ribbon
  // highlights one section while the pinned heading names another.
  // Scroll-spy is a READER behaviour. Embedded (the Song Hub's chart tab, the
  // editor preview, the side peek) the song sits still and complete, so there is
  // no "where am I" to answer and nothing should be highlighted.
  const activeSection = useActiveSection(
    scrollRef,
    `${song?.id || ''}:${config.columns}:${config.sticky}`,
    config.sticky ? 0.02 : 0.28,
    !embedded,
    // Where headings PIN is the reading line, exactly. Anything else and the
    // ribbon changes at a different moment from the heading it points at.
    config.sticky ? headH : null,
  );

  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      // BORDER box, not content box. `contentRect` excludes the header's
      // 1px bottom border, so `stickyTop` landed a pixel short of the header's
      // real bottom edge and the pinned heading sat under the divider instead
      // of below it. `borderBoxSize` is the honest number; the bounding rect is
      // the fallback for engines that don't report it.
      const box = entries[0]?.borderBoxSize?.[0]?.blockSize;
      const h = box ?? el.getBoundingClientRect().height ?? 0;
      // NO rounding. beta.41 did `Math.ceil`, reasoning that the heading should
      // never overlap the divider — which is backwards. On a fractional-DPR
      // phone the header is e.g. 73.33px tall, ceil gives 74, and the heading
      // pins 0.67px BELOW the header's bottom edge, showing a sliver of the
      // chart scrolling behind it. That sliver is the "small line between the
      // hairline and the heading pin", and beta.41 created it rather than
      // fixing it. Abutting sticky edges must OVERLAP, never abut — the
      // heading pins one pixel high (see `ReaderSection`) and paints over the
      // seam.
      setHeadH(prev => (Math.abs(prev - h) > 0.5 ? h : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);

  const jumpTo = useCallback((idx) => {
    const el = document.getElementById(`section-${idx}`);
    const sc = scrollRef.current;
    if (!el) return;
    if (!sc) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    // Land the section BELOW the sticky chrome. scrollIntoView aligns to the
    // container's top edge, which is behind the header, so the heading you
    // jumped to ended up hidden underneath it.
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTo({ top: Math.max(0, top - headH - 8), behavior: 'smooth' });
  }, [headH]);

  // The host's tab choice beats the global setting; standalone, the setting rules.
  const showChords = displayMode ? displayMode !== 'lyrics' : config.display.showChords;

  const transpose = (!selectedKey || !song?.key) ? 0 : semitonesBetween(song.key, selectedKey);

  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

  if (!song) return null;

  const displayKey = selectedKey || song.key;
  // Element 1 is fixed — no customization, by decision. An earlier cut gave it
  // three density states nobody asked for, and a stored 'min' was silently
  // hiding the title.
  const showChrome = !embedded;
  const ribbonSide = config.ribbon === 'left' || config.ribbon === 'right';

  const ribbonNode = config.ribbon !== 'off' && ordered.length > 0 ? (
    <StructureRibbon
      structure={ordered.map(s => s.type)}
      activeIndex={activeSection}
      onSelect={jumpTo}
      style={settings?.ribbonStyle || 'codes'}
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      collapse
      activeFill
      sectionColors={resolveSectionColors(settings)}
      sectionLabels={settings?.sectionLabels}
      customSectionTypes={settings?.customSectionTypes}
    />
  ) : null;

  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-300))' };
  const bottomRibbon = config.ribbon === 'bottom' && !!ribbonNode;

  return (
    <div
      className="h-full flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"
      ref={scrollRef}
      onTouchStart={onSwipeLeft || onSwipeRight ? onTouchStart : undefined}
      onTouchEnd={onSwipeLeft || onSwipeRight ? onTouchEnd : undefined}
      // Both surfaces live in `readerSurface.js` so the break and missing-song
      // screens paint from the SAME object — see the note there. They used to
      // have no remap at all, which left their ☰ and ✕ in app colours on a
      // chart background.
      style={embedded ? hubSurface : chartSurface}
    >
      {/* ── Element 1 — top bar ─────────────────────────────────────────── */}
      {showChrome && (
        <ReaderTopBar
          ref={headRef}
          aboveBar={underBar}
          leading={railButton}
          title={song.title}
          onMenu={(rect) => setOwnAaAnchor(a => (a ? null : rect))}
          onExit={onExit}
          tools={(
            <IconButton
              size="sm"
              className={BAR_BUTTON}
              aria-label={practiceOpen ? 'Close practice tools' : 'Practice tools'}
              aria-pressed={practiceOpen}
              onClick={togglePractice}
              style={{ color: practiceOpen ? 'var(--chord)' : 'var(--chart-text, var(--ds-gray-1000))' }}
            >
              <MetronomeIcon />
            </IconButton>
          )}
          meta={(
            <span className="shrink-0 flex items-center gap-2 text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
              {onSelectKey ? (
                <Select value={displayKey} onValueChange={onSelectKey}>
                  {/* Identical to the Song Hub's key chip — solid --chord fill,
                      near-black text, mono bold. */}
                  <SelectTrigger
                    aria-label="Key (transpose)"
                    className="!border-0 gap-0.5 font-mono font-bold focus:!ring-0 shrink-0 hover:!opacity-90 !h-7 !min-h-[28px] !w-auto !px-2 !py-0 !rounded-lg text-[13px]"
                    style={{ background: 'var(--chord)', color: '#0a0a0a' }}
                  >
                    <span>{displayKey}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {keysInQualityOf(song.key, settings?.accidentals).map(k => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className="font-mono font-bold text-[13px] rounded-lg px-2 h-7 inline-flex items-center"
                  style={{ background: 'var(--chord)', color: '#0a0a0a' }}
                >
                  {displayKey}
                </span>
              )}
              {song.tempo && <span className="tabular-nums">♩{song.tempo}</span>}
              {song.time && <span className="tabular-nums">{song.time}</span>}
            </span>
          )}
        >
          {/* Element 2 lives INSIDE element 1's sticky block: one piece of
              chrome that travels together, rather than two stacked stickies.
              The order is SET / HEADER / STRUCTURE (owner, 2026-08-01): the set
              bar no longer REPLACES the ribbon, it sits above the bar and the
              ribbon keeps its place below. That reverses element 8b's original
              "never both" — the owner's call, and it is recorded as his in
              docs/READER.md. All three pin together as one block. */}
          {config.ribbon === 'top' && ribbonNode && (
            // No rule between the bar and the ribbon. They are ONE piece of
            // chrome by element 2's decision, and a line here splits what that
            // decision deliberately fused. The divider lives on the bottom of
            // the whole sticky block instead — see `ReaderTopBar`.
            <div className="wide-container overflow-hidden pt-0.5 pb-1" style={{ fontSize: '0.85em' }}>
              {ribbonNode}
            </div>
          )}
        </ReaderTopBar>
      )}

      <div className="flex-1 flex">
        {/* Floating and transparent (owner, 2026-08-01), not a docked column.
            Docked it cost 56px of chart width, which is why it used to collapse
            to 'top' on a phone. Floating, it costs nothing, so the phone can
            have it too — `pointer-events-none` on the strip with the chips
            themselves re-enabling, so the space around them still scrolls the
            chart underneath. */}
        {config.ribbon === 'left' && ribbonNode && (
          <div
            className="absolute left-0 top-0 bottom-0 z-10 w-12 overflow-y-auto no-scrollbar px-1 py-2 pointer-events-none [&_button]:pointer-events-auto"
            style={{ background: 'transparent' }}
          >
            {ribbonNode}
          </div>
        )}

        {/* ── Elements 3–6 — the song ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* The multi-column context MUST be established on the same element
              that carries the width constraint. With `columnCount` on the
              full-width parent and `wide-container` on a child, the columns
              spanned the whole window while the header stayed at 1600px —
              which is why the body never lined up with the bar above it. */}
          <div
            className="wide-container py-3"
            style={{
              fontSize: config.display.lyricFontSize,
              // SectionBlock sizes chords off these vars, not inherited size.
              ['--chart-font-size-lyric']: `${config.display.lyricFontSize}px`,
              ['--chart-font-size-chord']: `${config.display.chordFontSize}px`,
              ['--chart-line-height-lyric']: settings?.lyricLineHeight ?? 1.35,
              ['--chart-section-gap']: `${settings?.sectionSpacing ?? 24}px`,
              ...(config.columns === 2
                ? { columnCount: 2, columnGap: '1.75rem', columnRule: '1px solid var(--chart-rule, var(--ds-gray-300))' }
                : null),
              // Trailing space so the LAST section can still scroll up far
              // enough to pin. Without it the song stops moving as soon as its
              // bottom meets the viewport, so the final section's heading never
              // reaches the sticky position and the ribbon never catches up to
              // it. Only where headings actually pin — `config.sticky` is
              // phone-only by element 3's decision, and on a desktop this would
              // just be a screen of blank paper.
              ...(config.sticky ? { paddingBottom: '60vh' } : null),
            }}
          >
          {/* Element 14, the other half: a real song with nothing in it. A
              blank reader is indistinguishable from a crash, and this is the
              one case where a chart legitimately has nothing to draw — a song
              imported from a title-only list, or one whose body was cleared. */}
          {ordered.length === 0 && (
            <div className="py-16 text-center">
              <p className="m-0 text-copy-14" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>
                This song has no chart yet.
              </p>
            </div>
          )}
          {ordered.map((section, idx) => (
            <ReaderSection
              key={`${section.id || section.type}-${idx}`}
              section={section}
              index={idx}
              config={config}
              songKey={song.key}
              settings={settings}
              transpose={transpose}
              modOffset={offsets[idx]}
              repeatOf={repeats[idx]}
              onJumpToFirst={() => jumpTo(repeats[idx])}
              tabColors={tabColors}
              stickyTop={headH}
              onChordTap={canSeeShapes ? onChordTap : null}
              showChords={showChords}
            />
          ))}
          </div>
        </div>

        {config.ribbon === 'right' && ribbonNode && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 w-12 overflow-y-auto no-scrollbar px-1 py-2 pointer-events-none [&_button]:pointer-events-auto"
            style={{ background: 'transparent' }}
          >
            {ribbonNode}
          </div>
        )}
      </div>

      {/* ── The bottom edge — ONE sticky block, three rows ────────────────
          structure (when it's set to 'bottom') · practice · nav.

          It has to be one block. Two `sticky bottom-0` siblings do NOT stack:
          they both pin to the same edge and the higher z-index covers the
          other. That is exactly what shipped in beta.41 — the bottom ribbon
          was there, pinned, and painted underneath the nav bar, so it looked
          like nothing had changed. A z-index cannot separate two elements that
          want the same 0px. */}
      {(bottomRibbon || footer || (showChrome && practiceOpen)) && (
        <div
          className="sticky bottom-0 z-20 shrink-0 border-t"
          style={{
            ...rule,
            background: 'var(--chart-bg, var(--ds-background-100))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {bottomRibbon && (
            <div
              className={`wide-container overflow-hidden py-1${(footer || practiceOpen) ? ' border-b' : ''}`}
              style={{ ...(footer || practiceOpen ? rule : null), fontSize: '0.85em' }}
            >
              {ribbonNode}
            </div>
          )}
          {showChrome && practiceOpen && (
            <div className={`wide-container py-1${footer ? ' border-b' : ''}`} style={footer ? rule : undefined}>
              <ReaderPracticeRow
                song={song}
                bpm={bpm}
                onBpm={changeBpm}
                onSaveTempo={onUpdateSong ? (v) => onUpdateSong({ ...song, tempo: v }) : null}
                clickRunning={metronome.running}
                onToggleClick={() => (metronome.running ? metronome.stop() : metronome.start(bpm, song.time))}
              />
            </div>
          )}
          {footer && <div className="wide-container flex items-center gap-2 py-1">{footer}</div>}
        </div>
      )}

      {tappedChord && (
        <ChordPopover
          chord={tappedChord.chord}
          anchorRect={tappedChord.rect}
          onClose={() => setTappedChord(null)}
        />
      )}

      {ownAaAnchor && (
        <ReaderMenu
          anchorRect={ownAaAnchor}
          onClose={() => setOwnAaAnchor(null)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          song={song}
          config={config}
          mode={mode}
          lyricSize={config.display.lyricFontSize}
          onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
          chordSize={config.display.chordFontSize}
          onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
        />
      )}

      {/* The hub's Aa button, unchanged. See the note on `ownAaAnchor`. */}
      {hostAaAnchor && (
        <AaMenu
          anchorRect={hostAaAnchor}
          onClose={() => onAaClose?.()}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          lyricSize={config.display.lyricFontSize}
          onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
          chordSize={config.display.chordFontSize}
          onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
          columns={settings?.defaultColumns ?? 'auto'}
          onColumns={(v) => onUpdateSettings?.('defaultColumns', v)}
          notation={config.display.notation}
          onNotation={(v) => onUpdateSettings?.('notation', v)}
        />
      )}
    </div>
  );
}
