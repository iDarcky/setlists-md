import { resolveChartDisplay, resolveColumns } from '@/lib/chartDisplay';

/**
 * The reader is ONE surface. "Live", "Rehearsal" and "Practice" are saved
 * bundles of its display settings — not separate screens.
 *
 * Layering, outermost wins:
 *   1. PRESET_BASE[preset]        — what the preset means
 *   2. settings.readerConfig[preset] — the user's edits to that preset
 *   3. context                    — embedded / narrow-screen adjustments that
 *                                   are physical facts, not preferences
 *
 * `stageMode` (Leader / Vocalist / Bass …) is orthogonal: it says what you
 * play, this says what you're doing. They compose — stage mode still resolves
 * type sizes and notation through `resolveChartDisplay`.
 */

export const READER_PRESETS = [
  { id: 'live', label: 'Live', blurb: 'Read and play. Locked down, exit always reachable.' },
  { id: 'rehearsal', label: 'Rehearsal', blurb: 'Same viewer, unlocked. Quick edit and structure.' },
  { id: 'practice', label: 'Practice', blurb: 'Chart plus metronome, count-in, loop and slow-down.' },
];

export const READER_PRESET_IDS = READER_PRESETS.map(p => p.id);
export const DEFAULT_PRESET = 'live';

/** Every knob the customize panel exposes, with its allowed values. */
export const READER_KNOBS = {
  headerDensity: ['min', 'std', 'full'],
  structurePosition: ['top', 'bottom', 'left', 'right', 'off'],
  sectionStyle: ['bar', 'block', 'card', 'mono'],
  columnFlow: ['section', 'balanced'],
  notePosition: ['margin', 'inline', 'peek'],
  duplicateSections: ['full', 'condensed', 'ref'],
  exitStyle: ['both', 'x', 'pull'],
};

const PRESET_BASE = {
  live: {
    headerDensity: 'min',
    structurePosition: 'top',
    sectionStyle: 'bar',
    columnFlow: 'section',
    notePosition: 'margin',
    duplicateSections: 'ref',
    exitStyle: 'both',
    allowEdit: false,
    showTools: false,
    confirmExit: true,
  },
  rehearsal: {
    headerDensity: 'std',
    structurePosition: 'left',
    sectionStyle: 'block',
    columnFlow: 'section',
    notePosition: 'margin',
    duplicateSections: 'full',
    exitStyle: 'x',
    allowEdit: true,
    showTools: false,
    confirmExit: false,
  },
  practice: {
    headerDensity: 'std',
    structurePosition: 'top',
    sectionStyle: 'bar',
    columnFlow: 'section',
    notePosition: 'inline',
    duplicateSections: 'full',
    exitStyle: 'x',
    allowEdit: true,
    showTools: true,
    confirmExit: false,
  },
};

export function isReaderPreset(id) {
  return READER_PRESET_IDS.includes(id);
}

/** Clamp a stored knob value to something this build understands. */
function pick(knob, value, fallback) {
  const allowed = READER_KNOBS[knob];
  if (allowed && allowed.includes(value)) return value;
  return fallback;
}

/**
 * Resolve the full reader configuration.
 *
 * @param settings  the app settings object
 * @param presetId  'live' | 'rehearsal' | 'practice'
 * @param ctx.embedded  true inside the Song Hub — the hub owns the chrome
 * @param ctx.wide      true when the viewport can carry two columns / a rail
 * @param ctx.setlist   true when reading a setlist (enables paging)
 * @param ctx.touch     whether the device can do the pull gesture at all
 */
export function resolveReaderConfig(settings, presetId, ctx = {}) {
  const preset = isReaderPreset(presetId) ? presetId : DEFAULT_PRESET;
  const base = PRESET_BASE[preset];
  const saved = settings?.readerConfig?.[preset] || {};
  const { embedded = false, wide = false, setlist = false, touch = true } = ctx;

  const display = resolveChartDisplay(settings);

  // The app-wide ribbon position (Settings → Labs) is the default for every
  // preset; a per-preset override beats it. Without this fallback the global
  // control looks broken — it writes a key the reader never reads.
  const globalRibbon = pick('structurePosition', settings?.structurePosition, base.structurePosition);

  const cfg = {
    preset,
    headerDensity: pick('headerDensity', saved.headerDensity, base.headerDensity),
    structurePosition: pick('structurePosition', saved.structurePosition, globalRibbon),
    sectionStyle: pick('sectionStyle', saved.sectionStyle, base.sectionStyle),
    columnFlow: pick('columnFlow', saved.columnFlow, base.columnFlow),
    notePosition: pick('notePosition', saved.notePosition, base.notePosition),
    duplicateSections: pick('duplicateSections', saved.duplicateSections, base.duplicateSections),
    exitStyle: pick('exitStyle', saved.exitStyle, base.exitStyle),
    allowEdit: saved.allowEdit ?? base.allowEdit,
    showTools: saved.showTools ?? base.showTools,
    confirmExit: saved.confirmExit ?? base.confirmExit,
    columns: resolveColumns(settings?.defaultColumns, wide),
    display,
    // Songs are paged; sections inside a song still scroll. A five-verse hymn
    // does not fit a phone screen at readable type.
    paged: setlist && !embedded,
    embedded,
  };

  // --- context overrides: physical facts, not preferences ---

  if (embedded) {
    // The hub owns identity, back-navigation and the tab bar.
    cfg.headerDensity = 'min';
    cfg.exitStyle = 'x';
    cfg.showTools = false;
    cfg.confirmExit = false;
  }

  // There must always be a way out. Pull-only on a device that cannot pull is
  // no exit at all — the precise failure this whole pass exists to remove — so
  // the button comes back regardless of what the preset asked for.
  if (cfg.exitStyle === 'pull' && !touch) cfg.exitStyle = 'x';

  if (!wide) {
    // A right note margin costs ~25% of the width — on a phone that leaves
    // nothing for lyrics, so notes fall back to markers in the line.
    if (cfg.notePosition === 'margin') cfg.notePosition = 'inline';
    // A vertical rail has nowhere to live on a phone.
    if (cfg.structurePosition === 'left' || cfg.structurePosition === 'right') {
      cfg.structurePosition = 'top';
    }
    cfg.columns = 1;
  }

  return cfg;
}

/** Immutably write one knob for one preset, ready to hand to `update()`. */
export function setReaderKnob(settings, presetId, knob, value) {
  const preset = isReaderPreset(presetId) ? presetId : DEFAULT_PRESET;
  const prev = settings?.readerConfig || {};
  return {
    ...prev,
    [preset]: { ...(prev[preset] || {}), [knob]: value },
  };
}

/** Drop a preset's overrides so it falls back to what the preset means. */
export function resetReaderPreset(settings, presetId) {
  const preset = isReaderPreset(presetId) ? presetId : DEFAULT_PRESET;
  const next = { ...(settings?.readerConfig || {}) };
  delete next[preset];
  return next;
}
