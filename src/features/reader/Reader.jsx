import { useMemo, useRef, useState, useCallback } from 'react';
import { semitonesBetween, keysInQualityOf } from '@/music';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { buildSongFlow } from '@/lib/songFlow';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useActiveSection } from '@/hooks/useActiveSection';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import { IconButton } from '@/ui/IconButton';
import ReaderSection from './ReaderSection';
import AaMenu from '@/features/chart/AaMenu';

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
  settings,
  onUpdateSettings,
  onExit,
  embedded = false,
  selectedKey,
  onSelectKey,
  footer,
}) {
  const scrollRef = useRef(null);
  // The Aa popover, anchored to the ☰ button — the same menu the Song Hub uses,
  // with a Visual tab added for the element-level options.
  const [aaAnchor, setAaAnchor] = useState(null);
  const wide = useMediaQuery('(min-width: 768px)');

  // Callers should pass a resolved arrangement view; accept a raw v2 song too,
  // because getting it wrong renders a silently blank chart.
  const song = songProp?.arrangements ? resolveSongView(songProp, arrangementId) : songProp;

  const config = useMemo(
    () => resolveReaderConfig(settings, { wide, embedded }),
    [settings, wide, embedded]
  );

  const { ordered, offsets, repeats } = useMemo(() => buildSongFlow(song), [song]);

  // The active section IS whichever heading is pinned — so the reading line
  // sits at the pin, not a third of the way down. Otherwise the ribbon
  // highlights one section while the pinned heading names another.
  const activeSection = useActiveSection(
    scrollRef,
    `${song?.id || ''}:${config.columns}:${config.sticky}`,
    config.sticky ? 0.02 : 0.28,
  );

  const jumpTo = useCallback((idx) => {
    const el = document.getElementById(`section-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const transpose = (!selectedKey || !song?.key) ? 0 : semitonesBetween(song.key, selectedKey);

  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

  if (!song) return null;

  const displayKey = selectedKey || song.key;
  const showChrome = config.header !== 'none';
  const showTitle = config.header === 'std' || config.header === 'full';
  const showMeta = config.header === 'full';
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
      className="h-full flex flex-col overflow-hidden"
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
        '--bg-1': 'var(--chart-bg, var(--ds-background-100))',
        '--bg-2': 'var(--chart-bg, var(--ds-background-200))',
        '--border-1': 'var(--chart-rule, var(--ds-gray-300))',
        '--border-3': 'var(--chart-subtle, var(--ds-gray-600))',
        '--text-1': 'var(--chart-text, var(--ds-gray-1000))',
        '--text-2': 'var(--chart-subtle, var(--ds-gray-700))',
        '--ds-gray-1000': 'var(--chart-text, var(--ds-gray-1000))',
        '--ds-gray-700': 'var(--chart-subtle, var(--ds-gray-700))',
      }}
    >
      {/* ── Element 1 — top bar ─────────────────────────────────────────── */}
      {showChrome && (
        <div className="shrink-0 flex flex-col border-b" style={rule}>
          <div className="wide-container flex items-center gap-2 py-1.5">
            <IconButton
              size="sm"
              aria-label="Display options"
              onClick={(e) => {
                // Read the rect synchronously: React nulls currentTarget once
                // the handler returns, so a lazy state updater would see null.
                const rect = e.currentTarget.getBoundingClientRect();
                setAaAnchor(a => (a ? null : rect));
              }}
            >
              <MenuIcon />
            </IconButton>

            {showTitle && (
              <span className="truncate text-label-13 font-semibold shrink min-w-[4rem] max-w-[45%]">
                {song.title}
              </span>
            )}

            {/* Key, tempo and time sit WITH the title, not out by the exit —
                the key is the only live control here and a mis-tap next to ✕
                either transposes mid-song or leaves the service. */}
            <span className="shrink-0 flex items-center gap-2 text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
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

            <span className="flex-1" />

            {onExit && (
              <IconButton size="sm" aria-label="Exit" onClick={onExit}>
                <CloseIcon />
              </IconButton>
            )}
          </div>

          {showMeta && (
            <div className="wide-container flex items-center gap-3 pb-1.5 text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
              {song.artist && <span>{song.artist}</span>}
              {song.capo ? <span>Capo {song.capo}</span> : null}
              <span>{ordered.length} sections</span>
            </div>
          )}
        </div>
      )}

      {/* ── Element 2 — structure ribbon ────────────────────────────────── */}
      {config.ribbon === 'top' && ribbonNode && (
        <div className="shrink-0 border-b overflow-hidden" style={rule}>
          <div className="wide-container py-1.5">{ribbonNode}</div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {config.ribbon === 'left' && ribbonNode && (
          <div className="shrink-0 w-14 overflow-y-auto border-r px-1.5 py-2" style={rule}>{ribbonNode}</div>
        )}

        {/* ── Elements 3–6 — the song ──────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
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
          }}
        >
          <div className="wide-container py-3">
          {ordered.map((section, idx) => (
            <ReaderSection
              key={`${section.id || section.type}-${idx}`}
              section={section}
              index={idx}
              config={config}
              settings={settings}
              transpose={transpose}
              modOffset={offsets[idx]}
              repeatOf={repeats[idx]}
              onJumpToFirst={() => jumpTo(repeats[idx])}
              tabColors={tabColors}
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

      {footer && (
        <div className="shrink-0 border-t" style={rule}>
          <div className="wide-container flex items-center gap-2 py-1.5">{footer}</div>
        </div>
      )}

      {aaAnchor && (
        <AaMenu
          visualEdit
          anchorRect={aaAnchor}
          onClose={() => setAaAnchor(null)}
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
