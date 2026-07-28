import { useMemo, useRef, useState, useCallback } from 'react';
import { semitonesBetween, keysInQualityOf } from '@/music';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { buildSongFlow } from '@/lib/songFlow';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { resolveReaderConfig, setReaderKnob, resetReaderPreset } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useActiveSection } from '@/hooks/useActiveSection';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import { IconButton } from '@/ui/IconButton';
import BottomSheet from '@/ui/BottomSheet';
import ReaderSection from './ReaderSection';
import ReaderNotes from './ReaderNotes';
import ReaderCustomizeSheet from './ReaderCustomizeSheet';

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16M4 10h16M4 15h10" />
  </svg>
);

// How far you have to pull before releasing exits.
const PULL_EXIT = 96;

/**
 * The reader. One surface, configured — not three.
 *
 * Everything that used to be forked across `ChartView`, `SetlistPlayer`,
 * `PerformanceView` and `PracticeView` resolves through
 * `resolveReaderConfig`; a preset is just a saved bundle of those settings.
 *
 * The chart body is still `SectionBlock`. This owns the frame.
 */
export default function Reader({
  song: songProp,
  arrangementId,
  settings,
  onUpdateSettings,
  preset = 'live',
  onPresetChange,
  onExit,
  embedded = false,
  setlist = false,
  selectedKey,
  onSelectKey,
  header,     // extra nodes for the header (setlist pager, song counter…)
  footer,     // extra nodes for the footer (tools, pager dots…)
}) {
  const scrollRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef(null);
  const wide = useMediaQuery('(min-width: 768px)');

  // Callers should hand over a resolved arrangement view, but accept a raw v2
  // song too — the failure mode of getting this wrong is a silently blank
  // chart, which is the worst thing that can happen on a stage.
  const song = songProp?.arrangements ? resolveSongView(songProp, arrangementId) : songProp;

  const touch = useMediaQuery('(pointer: coarse)');
  const config = useMemo(
    () => resolveReaderConfig(settings, preset, { embedded, wide, setlist, touch }),
    [settings, preset, embedded, wide, setlist, touch]
  );

  const { ordered, offsets, repeats } = useMemo(() => buildSongFlow(song), [song]);
  // With sticky headings the active section is, by definition, whichever
  // heading is currently pinned — so the reading line sits at the pin, not a
  // third of the way down. Without this the ribbon highlights one section while
  // the pinned heading names another.
  const activeSection = useActiveSection(
    scrollRef,
    `${song?.id || ''}:${config.columns}:${config.stickyHeadings}`,
    config.stickyHeadings ? 0.02 : 0.28,
  );

  const transpose = (!selectedKey || !song?.key) ? 0 : semitonesBetween(song.key, selectedKey);

  // Only include keys the user actually set, so TabBlock's own defaults still
  // apply for the rest. The React compiler memoizes this.
  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

  const showPullGesture = !embedded && (config.exitStyle === 'pull' || config.exitStyle === 'both');

  // Pull-to-exit: only when the chart is already scrolled to the top, so it
  // can never fight a normal scroll. No permanent affordance — the ✕ is the
  // discoverable exit; this is the fast one.
  const onTouchStart = useCallback((e) => {
    if (!showPullGesture) return;
    pullStart.current = (scrollRef.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  }, [showPullGesture]);

  const onTouchMove = useCallback((e) => {
    if (pullStart.current == null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    setPull(dy > 0 ? Math.min(dy, PULL_EXIT * 1.5) : 0);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullStart.current != null && pull >= PULL_EXIT) onExit?.();
    pullStart.current = null;
    setPull(0);
  }, [pull, onExit]);

  const jumpTo = useCallback((idx) => {
    const el = document.getElementById(`section-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const setKnob = useCallback((knob, value) => {
    onUpdateSettings?.('readerConfig', setReaderKnob(settings, preset, knob, value));
  }, [onUpdateSettings, settings, preset]);

  const reset = useCallback(() => {
    onUpdateSettings?.('readerConfig', resetReaderPreset(settings, preset));
  }, [onUpdateSettings, settings, preset]);

  if (!song) return null;

  const displayKey = selectedKey || song.key;
  // Three genuinely different states, not two with a spare label:
  //   min  — controls only, no title
  //   std  — title
  //   full — title plus a spelled-out meta row underneath
  const showTitle = config.headerDensity === 'std' || config.headerDensity === 'full';
  const showMetaRow = config.headerDensity === 'full';
  const showExitButton = config.exitStyle === 'x' || config.exitStyle === 'both';
  const ribbonSide = config.structurePosition === 'left' || config.structurePosition === 'right';

  const ribbonNode = config.structurePosition !== 'off' && ordered.length > 0 ? (
    <StructureRibbon
      structure={ordered.map(s => s.type)}
      activeIndex={activeSection}
      onSelect={jumpTo}
      style={settings?.ribbonStyle || 'codes'}
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      // Consecutive duplicates merge to ×N; a chorus separated by a verse stays
      // its own chip, so ribbon position still maps to song position.
      collapse
      activeFill
      // Same resolved palette the headings use, or the ribbon chip and the
      // section it points at drift apart again.
      sectionColors={resolveSectionColors(settings)}
      sectionLabels={settings?.sectionLabels}
      customSectionTypes={settings?.customSectionTypes}
    />
  ) : null;

  const chart = (
    <div
      ref={scrollRef}
      className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-3.5 py-3.5"
      style={{
        fontSize: config.display.lyricFontSize,
        // SectionBlock sizes chords off these vars, not off inherited font-size
        // — without them the chord-size setting does nothing.
        ['--chart-font-size-lyric']: `${config.display.lyricFontSize}px`,
        ['--chart-font-size-chord']: `${config.display.chordFontSize}px`,
        ...(config.columns === 2
          ? { columnCount: 2, columnGap: '1.75rem', columnRule: '1px solid var(--chart-rule, var(--ds-gray-300))' }
          : null),
      }}
    >
      {ordered.map((section, idx) => (
        <ReaderSection
          key={`${section.id || section.type}-${idx}`}
          section={section}
          index={idx}
          style={config.sectionStyle}
          transpose={transpose}
          modOffset={offsets[idx]}
          config={{ ...config, songKey: song.key }}
          settings={settings}
          repeatOf={repeats[idx]}
          onJumpToFirst={() => jumpTo(repeats[idx])}
          tabColors={tabColors}
          keepWhole={config.columnFlow === 'section'}
          stickyTop={0}
        />
      ))}
    </div>
  );

  return (
    <div
      className="h-full flex flex-col overflow-hidden relative"
      style={{ background: 'var(--chart-bg, var(--ds-background-100))', color: 'var(--chart-text, var(--ds-gray-1000))' }}
      onTouchStart={showPullGesture ? onTouchStart : undefined}
      onTouchMove={showPullGesture ? onTouchMove : undefined}
      onTouchEnd={showPullGesture ? onTouchEnd : undefined}
    >
      {/* Pull-to-exit shows only while the gesture is happening. A permanent
          coloured strip is chrome, and chrome is what this pass is removing. */}
      {pull > 0 && (
        <div
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-center pointer-events-none"
          style={{ height: Math.min(pull, PULL_EXIT) }}
        >
          <span className="text-label-11 font-semibold text-[var(--ds-red-900)]">
            {pull >= PULL_EXIT ? 'Release to exit' : 'Pull to exit'}
          </span>
        </div>
      )}

      {!embedded && (
        <div
          className="shrink-0 flex flex-col border-b"
          style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}
        >
        <div className="flex items-center gap-2 px-3 py-1.5">
          <IconButton size="sm" aria-label="Customize" onClick={() => setSheetOpen(true)}>
            <MenuIcon />
          </IconButton>

          {showTitle && (
            <span className="min-w-0 flex-1 truncate text-label-13 font-semibold">
              {song.title}
            </span>
          )}

          {header}

          <span className="ml-auto shrink-0 flex items-center gap-2 text-label-11 tabular-nums text-[var(--chart-subtle,var(--ds-gray-700))]">
            {/* Order matters: the key is the only control here that changes
                what you see, and it must NOT sit next to the exit. Tempo and
                time signature are inert, so they make the buffer between a
                mis-tap and leaving the service. */}
            {/* Transpose is one tap, in every preset — someone may need to move
                a key mid-service. In Live the change is deliberately session-
                only: nothing here writes back to the stored song. */}
            {onSelectKey ? (
              <Select value={displayKey} onValueChange={onSelectKey}>
                <SelectTrigger
                  aria-label="Key (transpose)"
                  className="h-6 w-auto min-w-0 gap-0.5 border-none bg-transparent px-1.5 text-label-12 font-bold text-[var(--chord)] focus:ring-0"
                >
                  {displayKey}
                </SelectTrigger>
                <SelectContent>
                  {keysInQualityOf(song.key, settings?.accidentals).map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="font-bold text-[var(--chord)] text-label-12">{displayKey}</span>
            )}
            {song.tempo && <span className="tabular-nums">♩{song.tempo}</span>}
            {song.time && <span className="tabular-nums">{song.time}</span>}
          </span>

          {config.notePosition === 'peek' && (
            <IconButton size="sm" aria-label="Notes" onClick={() => setNotesOpen(true)}>
              <NoteIcon />
            </IconButton>
          )}

          {showExitButton && (
            <IconButton size="sm" aria-label="Exit" onClick={onExit}>
              <CloseIcon />
            </IconButton>
          )}
        </div>

        {showMetaRow && (
          <div className="flex items-center gap-3 px-3 pb-1.5 text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
            {song.capo ? <span>Capo {song.capo}</span> : null}
            <span>{ordered.length} sections</span>
            {song.ccli && <span>CCLI {song.ccli}</span>}
          </div>
        )}
        </div>
      )}

      {config.structurePosition === 'top' && ribbonNode && (
        <div className="shrink-0 px-3 py-1.5 border-b overflow-hidden" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
          {ribbonNode}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {config.structurePosition === 'left' && ribbonNode && (
          <div className="shrink-0 w-14 overflow-y-auto border-r px-1.5 py-2" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
            {ribbonNode}
          </div>
        )}

        {chart}

        {config.structurePosition === 'right' && ribbonNode && (
          <div className="shrink-0 w-14 overflow-y-auto border-l px-1.5 py-2" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
            {ribbonNode}
          </div>
        )}
      </div>

      {config.structurePosition === 'bottom' && ribbonNode && (
        <div className="shrink-0 px-3 py-1.5 border-t overflow-hidden" style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}>
          {ribbonNode}
        </div>
      )}

      {footer && (
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-t"
          style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}
        >
          {footer}
        </div>
      )}

      {/* 'peek' keeps notes off the page until asked for — the third real
          option, not a synonym for "off". */}
      <BottomSheet open={notesOpen} onClose={() => setNotesOpen(false)} title="Notes & cues">
        <ReaderNotes
          ordered={ordered}
          settings={settings}
          songNotes={song.notes}
          activeSection={activeSection}
          onSelect={(i) => { setNotesOpen(false); jumpTo(i); }}
          inSheet
        />
      </BottomSheet>

      <ReaderCustomizeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        config={config}
        preset={preset}
        narrow={!wide}
        onPresetChange={(p) => { onPresetChange?.(p); }}
        onKnobChange={setKnob}
        onReset={reset}
      />
    </div>
  );
}
