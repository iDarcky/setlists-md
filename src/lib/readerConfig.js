import { resolveChartDisplay, resolveColumns } from '@/lib/chartDisplay';

/**
 * The reader's settings, resolved.
 *
 * Deliberately flat and small. An earlier cut of this carried three presets,
 * seven knobs and a per-preset override map before the element-by-element
 * design walk had settled anything — which buried the decisions we HAD made
 * under scaffolding we hadn't. Presets can come back once the elements are
 * finished; they are not needed to read a chart.
 *
 * Everything here maps to one of elements 1–6:
 *   1 top bar · 2 structure ribbon · 3 section heading
 *   4 band cue · 5 inline notes · 6 chords
 */

export const READER_KNOBS = {
  header: ['min', 'std', 'full'],          // 1
  ribbon: ['top', 'bottom', 'left', 'right', 'off'],  // 2
  heading: ['name', 'code'],               // 3
  sectionStyle: ['bar', 'block', 'card', 'mono'],     // 3
  sticky: ['on', 'off'],                   // 3
  repeats: ['full', 'ref', 'condensed'],   // 3
  notes: ['on', 'off'],                    // 4 + 5
};

const DEFAULTS = {
  header: 'std',
  ribbon: 'top',
  heading: 'name',
  sectionStyle: 'bar',
  sticky: 'on',
  repeats: 'ref',
  notes: 'on',
};

// Stored under these settings keys. `structurePosition` and
// `duplicateSections` are existing app-wide settings, reused rather than
// duplicated so the controls that already exist keep working.
const KEY = {
  header: 'readerHeader',
  ribbon: 'structurePosition',
  heading: 'readerHeading',
  sectionStyle: 'readerSectionStyle',
  sticky: 'readerSticky',
  repeats: 'duplicateSections',
  notes: 'readerNotes',
};

export function readerSettingKey(knob) {
  return KEY[knob];
}

function pick(knob, value) {
  const allowed = READER_KNOBS[knob];
  return allowed.includes(value) ? value : DEFAULTS[knob];
}

/**
 * @param settings   the app settings object
 * @param ctx.wide   viewport can carry two columns / a side rail
 * @param ctx.embedded  inside the Song Hub — the hub owns the chrome
 */
export function resolveReaderConfig(settings, ctx = {}) {
  const { wide = false, embedded = false } = ctx;

  const cfg = {
    header: pick('header', settings?.[KEY.header]),
    ribbon: pick('ribbon', settings?.[KEY.ribbon]),
    heading: pick('heading', settings?.[KEY.heading]),
    sectionStyle: pick('sectionStyle', settings?.[KEY.sectionStyle]),
    // Pinned headings earn their space on a phone, where you thumb-scroll
    // through a section at a time. On a desktop the whole section is usually
    // on screen already, so pinning is just a bar that never goes away.
    sticky: !wide && pick('sticky', settings?.[KEY.sticky]) === 'on',
    repeats: pick('repeats', settings?.[KEY.repeats]),
    notes: pick('notes', settings?.[KEY.notes]) === 'on',
    columns: resolveColumns(settings?.defaultColumns, wide),
    display: resolveChartDisplay(settings),
    embedded,
  };

  // --- physical facts, not preferences ---

  // The hub owns identity and back-navigation, so the reader shows no chrome.
  if (embedded) cfg.header = 'none';

  // A note belongs to its line either way; only the treatment changes with the
  // room. Wide: out to the right edge on a dotted leader, like a printed
  // chart. Narrow: above its line, so it is read before the line is sung.
  cfg.notePlacement = wide ? 'leader' : 'above';

  if (!wide) {
    // A vertical rail has nowhere to live on a phone.
    if (cfg.ribbon === 'left' || cfg.ribbon === 'right') cfg.ribbon = 'top';
    cfg.columns = 1;
  }

  return cfg;
}
