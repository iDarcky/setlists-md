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
import ReaderTopBar from './ReaderTopBar';
import ReaderPracticeRow, { MetronomeIcon } from './ReaderPracticeRow';
import AaMenu from '@/features/chart/AaMenu';
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
  // The Aa popover, anchored to the ☰ button — the same menu the Song Hub uses,
  // with a Visual tab added for the element-level options.
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
  );

  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect?.height || 0;
      setHeadH(prev => (Math.abs(prev - h) > 1 ? h : prev));
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

  return (
    <div
      className="h-full flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"
      ref={scrollRef}
      onTouchStart={onSwipeLeft || onSwipeRight ? onTouchStart : undefined}
      onTouchEnd={onSwipeLeft || onSwipeRight ? onTouchEnd : undefined}
      style={embedded ? undefined : {
        // A performance surface owns the screen, so it wears the CHART theme
        // and re-maps the app's foreground tokens onto it — the way
        // StageHeader does. Without the re-map, anything reading --bg-1 /
        // --border-1 / --text-* (the structure ribbon, most notably) renders in
        // the APP theme, which put dark pills on white paper.
        //
        // Embedded in the Song Hub it deliberately does NOT: the hub is a
        // browsing surface inside the app, and a white chart card sitting in a
        // dark app reads as broken rather than as a stage.
        background: 'var(--chart-bg, var(--ds-background-100))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
        // NB: none of these may name themselves inside their own fallback.
        // `--ds-gray-1000: var(--chart-text, var(--ds-gray-1000))` is a cycle,
        // and a cyclic custom property is invalid at computed-value time — it
        // becomes unset for the entire subtree, taking the title's colour with
        // it. Every fallback below is a literal.
        '--bg-1': 'var(--chart-bg, #ffffff)',
        '--bg-2': 'var(--chart-bg, #ffffff)',
        '--border-1': 'var(--chart-rule, rgba(0,0,0,.14))',
        '--border-3': 'var(--chart-subtle, rgba(0,0,0,.3))',
        '--text-1': 'var(--chart-text, #111111)',
        '--text-2': 'var(--chart-subtle, #6b6b6b)',
        '--ds-gray-1000': 'var(--chart-text, #111111)',
        '--ds-gray-700': 'var(--chart-subtle, #6b6b6b)',
      }}
    >
      {/* ── Element 1 — top bar ─────────────────────────────────────────── */}
      {showChrome && (
        <ReaderTopBar
          ref={headRef}
          title={song.title}
          onMenu={(rect) => setOwnAaAnchor(a => (a ? null : rect))}
          onExit={onExit}
          tools={(
            <IconButton
              size="sm"
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
              chrome that travels together, rather than two stacked stickies. */}
          {config.ribbon === 'top' && ribbonNode && (
            // A hairline between the bar and the ribbon — the Score mockup's
            // divider, at a fraction of its weight. They are still ONE sticky
            // block; this only separates them to the eye.
            <div
              className="wide-container overflow-hidden pt-1 pb-1 border-t"
              style={{ fontSize: '0.85em', borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}
            >
              {ribbonNode}
            </div>
          )}
        </ReaderTopBar>
      )}

      <div className="flex-1 flex">
        {config.ribbon === 'left' && ribbonNode && (
          <div className="shrink-0 w-14 overflow-y-auto border-r px-1.5 py-2" style={rule}>{ribbonNode}</div>
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
            />
          ))}
          </div>
        </div>

        {config.ribbon === 'right' && ribbonNode && (
          <div className="shrink-0 w-14 overflow-y-auto border-l px-1.5 py-2" style={rule}>{ribbonNode}</div>
        )}
      </div>

      {config.ribbon === 'bottom' && ribbonNode && (
        <div className="shrink-0 border-t overflow-hidden" style={rule}>
          <div className="wide-container py-1.5">{ribbonNode}</div>
        </div>
      )}

      {/* Elements 12 + 10 share ONE sticky block at the bottom edge — the
          practice row above the nav row. Two separate stickies would fight over
          `bottom-0` and the safe-area inset; one block with two rows cannot.
          `sticky bottom-0`, not just last-in-flow: the whole reader is ONE
          scroll container, so a plain flex child sits at the end of the SONG
          rather than at the bottom of the screen. Mirror of the header. */}
      {(footer || (showChrome && practiceOpen)) && (
        <div
          className="sticky bottom-0 z-20 shrink-0 border-t"
          style={{
            ...rule,
            background: 'var(--chart-bg, var(--ds-background-100))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {showChrome && practiceOpen && (
            <div className={`wide-container py-1.5${footer ? ' border-b' : ''}`} style={footer ? rule : undefined}>
              <ReaderPracticeRow
                song={song}
                bpm={bpm}
                onBpm={changeBpm}
                clickRunning={metronome.running}
                onToggleClick={() => (metronome.running ? metronome.stop() : metronome.start(bpm, song.time))}
              />
            </div>
          )}
          {footer && <div className="wide-container flex items-center gap-2 py-1.5">{footer}</div>}
        </div>
      )}

      {tappedChord && (
        <ChordPopover
          chord={tappedChord.chord}
          anchorRect={tappedChord.rect}
          onClose={() => setTappedChord(null)}
        />
      )}

      {(hostAaAnchor || ownAaAnchor) && (
        <AaMenu
          visualEdit
          anchorRect={hostAaAnchor || ownAaAnchor}
          onClose={() => { setOwnAaAnchor(null); onAaClose?.(); }}
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
