import { STAGE_MODE_MAP } from '../data/stageModes';

// Named lyric-size buckets (legacy 'S'/'M'/'L' values stored in settings).
export const FONT_SIZES = { S: 14, M: 18, L: 22 };

function asNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && FONT_SIZES[v] != null) return FONT_SIZES[v];
  return undefined;
}

/**
 * The single source of truth for "how the chart looks" — resolved from the
 * device's persisted settings, falling back to the active stage-mode preset
 * and then a hard default. Used by every reading surface (ChartView,
 * PerformanceView, PracticeView) so a tweak in one place shows up everywhere.
 *
 * `columns` is returned raw (`'auto' | 1 | 2 | undefined`); each surface
 * decides how to apply width-adaptive behaviour for the non-explicit cases.
 */
export function resolveChartDisplay(settings, { fallbackLyric = 16 } = {}) {
  const stage = STAGE_MODE_MAP[settings?.stageMode || 'leader']?.settings
    || STAGE_MODE_MAP.leader.settings;
  const lyric = asNumber(settings?.defaultFontSize) ?? stage.lyricFontSize ?? fallbackLyric;
  return {
    columns: settings?.defaultColumns,
    lyricFontSize: lyric,
    chordFontSize: asNumber(settings?.chordFontSize) ?? stage.chordFontSize ?? Math.round(lyric * 0.95),
    nashville: settings?.nashville ?? !!stage.nashville,
    showChords: settings?.showChords ?? (stage.showChords !== false),
    showDiagrams: settings?.showDiagrams ?? !!stage.showDiagrams,
  };
}

/**
 * Resolve an effective column count for a reading surface. Explicit 1/2 from
 * settings always wins; `'auto'`/unset defers to the surface's width-adaptive
 * hint (`wantTwo`).
 */
export function resolveColumns(columns, wantTwo) {
  if (columns === 1 || columns === 2) return columns;
  return wantTwo ? 2 : 1;
}
