import { useMemo, useRef, useState, useCallback } from 'react';
import { semitonesBetween, keysInQualityOf } from '@/music';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { buildSongFlow } from '@/lib/songFlow';
import { resolveReaderConfig, setReaderKnob, resetReaderPreset } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useActiveSection } from '@/hooks/useActiveSection';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import { IconButton } from '@/ui/IconButton';
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
  const wide = useMediaQuery('(min-width: 768px)');

  // Callers should hand over a resolved arrangement view, but accept a raw v2
  // song too — the failure mode of getting this wrong is a silently blank
  // chart, which is the worst thing that can happen on a stage.
  const song = songProp?.arrangements ? resolveSongView(songProp, arrangementId) : songProp;

  const config = useMemo(
    () => resolveReaderConfig(settings, preset, { embedded, wide, setlist }),
    [settings, preset, embedded, wide, setlist]
  );

  const { ordered, offsets, repeats } = useMemo(() => buildSongFlow(song), [song]);
  const activeSection = useActiveSection(scrollRef, `${song?.id || ''}:${config.columns}`);

  const transpose = (!selectedKey || !song?.key) ? 0 : semitonesBetween(song.key, selectedKey);

  // Only include keys the user actually set, so TabBlock's own defaults still
  // apply for the rest. The React compiler memoizes this.
  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

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
  const showTitle = config.headerDensity !== 'min';
  const showExitButton = config.exitStyle === 'x' || config.exitStyle === 'both';
  const showPullBar = config.exitStyle === 'pull' || config.exitStyle === 'both';
  const ribbonSide = config.structurePosition === 'left' || config.structurePosition === 'right';

  const ribbonNode = config.structurePosition !== 'off' && ordered.length > 0 ? (
    <StructureRibbon
      structure={ordered.map(s => s.type)}
      activeIndex={activeSection}
      onSelect={jumpTo}
      style={settings?.ribbonStyle || 'codes'}
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      collapse={!ribbonSide}
      sectionColors={settings?.sectionColors}
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
        />
      ))}
    </div>
  );

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--chart-bg, var(--ds-background-100))', color: 'var(--chart-text, var(--ds-gray-1000))' }}
    >
      {/* Pull-to-exit affordance. Always rendered above the header so it can
          never be scrolled away — the old header collapsed and took the only
          exit with it, mid-service. */}
      {showPullBar && !embedded && (
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit"
          className="shrink-0 h-1.5 border-none cursor-pointer p-0"
          style={{ background: 'linear-gradient(90deg, transparent, var(--ds-red-700), transparent)', opacity: 0.5 }}
        />
      )}

      {!embedded && (
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b"
          style={{ borderColor: 'var(--chart-rule, var(--ds-gray-300))' }}
        >
          <IconButton size="sm" aria-label="Customize" onClick={() => setSheetOpen(true)}>
            <MenuIcon />
          </IconButton>

          {showTitle && (
            <span className="min-w-0 flex-1 truncate text-label-13 font-semibold">
              {song.title}
              {song.artist && (
                <span className="font-normal opacity-60"> · {song.artist}</span>
              )}
            </span>
          )}

          {header}

          <span className="ml-auto shrink-0 flex items-center gap-2 text-label-11 tabular-nums text-[var(--chart-subtle,var(--ds-gray-700))]">
            {/* Transpose is one tap, in every preset — someone may need to move
                a key mid-service. In Live the change is deliberately session-
                only: nothing here writes back to the stored song. */}
            {onSelectKey ? (
              <Select value={displayKey} onValueChange={onSelectKey}>
                <SelectTrigger
                  aria-label="Key (transpose)"
                  className="h-6 w-auto min-w-0 gap-0.5 border-none bg-transparent px-1.5 text-label-12 font-bold text-[var(--color-brand)] focus:ring-0"
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
              <span className="font-bold text-[var(--color-brand)] text-label-12">{displayKey}</span>
            )}
            {song.tempo && <span>♩{song.tempo}</span>}
            {song.time && <span>{song.time}</span>}
          </span>

          {showExitButton && (
            <IconButton size="sm" aria-label="Exit" onClick={onExit}>
              <CloseIcon />
            </IconButton>
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

        {config.notePosition === 'margin' && (
          <ReaderNotes
            ordered={ordered}
            settings={settings}
            songNotes={song.notes}
            activeSection={activeSection}
            onSelect={jumpTo}
          />
        )}

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
