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
  // Baseline chart display. This used to resolve through a per-instrument
  // "stage mode" preset (Leader / Vocalist / Bassist …), which quietly rewrote
  // half a dozen settings behind the user's back; it has been removed and will
  // be rethought. These are the values that preset's default carried.
  const stage = {
    lyricFontSize: 18,
    chordFontSize: 17,
    nashville: false,
    notation: 'letters',
    showChords: true,
    showDiagrams: false,
  };
  const lyric = asNumber(settings?.defaultFontSize) ?? stage.lyricFontSize ?? fallbackLyric;
  const nashville = settings?.nashville ?? !!stage.nashville;
  // `notation` is the three-way successor to the legacy `nashville` boolean.
  // Prefer an explicit setting, then the stage preset's, then fall back to the
  // boolean so pre-migration prefs keep rendering Nashville.
  const notation = settings?.notation ?? stage.notation ?? (nashville ? 'nashville' : 'letters');
  return {
    columns: settings?.defaultColumns,
    lyricFontSize: lyric,
    chordFontSize: asNumber(settings?.chordFontSize) ?? stage.chordFontSize ?? Math.round(lyric * 0.95),
    nashville,
    notation,
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
