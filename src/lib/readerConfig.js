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
  ribbon: ['top', 'bottom', 'left', 'right', 'off'],  // 2
  heading: ['name', 'code', 'caps'],       // 3
  sectionStyle: ['bar', 'plain', 'block', 'card'],   // 3
  sticky: ['on', 'off'],                   // 3
  // 'ref' was a third repeat style that read as 'Chorus — as before'. It
  // and 'condensed' had collapsed onto the same pill, so it was two names
  // for one thing. A stored 'ref' now falls back to the default via pick().
  //
  // 'hide' drops a repeat from the CHART entirely — not even the pill (owner,
  // 2026-08-01). The structure ribbon still lists it: the ribbon is the map of
  // the song, and a section missing from the map breaks the one job. Tapping
  // its chip jumps to the first time that section is played.
  repeats: ['full', 'condensed', 'hide'],  // 3
  notes: ['on', 'off'],                    // 4 + 5
  footer: ['count', 'next'],               // 10
  nav: ['footer', 'pill', 'edge', 'swipe'],// 10
  // 8 — what hangs under the top bar. 'ribbon' maps the SONG, 'setlist' maps
  // the SET (the app's original player bar). Never both: two maps competing for
  // one glance.
  topBar: ['ribbon', 'setlist'],
};

const DEFAULTS = {
  ribbon: 'top',
  heading: 'name',
  sectionStyle: 'bar',
  sticky: 'on',
  repeats: 'condensed',
  notes: 'on',
  footer: 'next',
  nav: 'footer',
  topBar: 'ribbon',
};

// Stored under these settings keys. `structurePosition` and
// `duplicateSections` are existing app-wide settings, reused rather than
// duplicated so the controls that already exist keep working.
const KEY = {
  ribbon: 'structurePosition',
  heading: 'readerHeading',
  sectionStyle: 'readerSectionStyle',
  sticky: 'readerSticky',
  repeats: 'duplicateSections',
  notes: 'readerNotes',
  footer: 'readerFooter',
  nav: 'readerNav',
  topBar: 'readerTopBar',
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
 * @param ctx.myInstrument  what the reader plays this service, from the band
 */
// The HUB VIEW's fixed look. Deliberately NOT derived from `settings`.
//
// The hub (and the editor preview, the side peek, the editor's read-only
// display) is its own thing: it shows the lyrics and the chords, full stop. It
// is not a stage, so no chart theme touches it, and nothing in the Aa menu
// changes it. Those settings belong to the READER, which is the surface that
// has views. Two surfaces sharing one settings store is what let a toggle
// flipped in one place silently change the other — the Chart tab turning into a
// second Lyrics tab was exactly that, and it cost several rounds to find.
//
// If this ever needs to become adjustable, give it its OWN store. Do not
// reconnect it to the reader's.
const HUB_VIEW = {
  ribbon: 'off',        // the hub draws the song map in its own top card
  heading: 'name',
  sectionStyle: 'bar',
  sticky: false,        // nothing pins: the hub is browsed, not performed from
  repeats: 'full',      // reading a song, you want to see all of it
  notes: true,
  footer: 'next',
  nav: 'footer',
  columns: 1,
};

export function resolveReaderConfig(settings, ctx = {}) {
  const { wide = false, embedded = false, myInstrument = null } = ctx;

  // Embedded = the hub view. Fixed, and answerable to nothing but this file.
  if (embedded) {
    return {
      ...HUB_VIEW,
      // Two columns on a wide screen is a fact about the space, not a taste.
      columns: wide ? 2 : 1,
      display: resolveChartDisplay(null),
      myInstrument,
      embedded: true,
      topBar: 'ribbon',
      notePlacement: wide ? 'leader' : 'above',
    };
  }

  const cfg = {
    ribbon: pick('ribbon', settings?.[KEY.ribbon]),
    heading: pick('heading', settings?.[KEY.heading]),
    sectionStyle: pick('sectionStyle', settings?.[KEY.sectionStyle]),
    // Pinned headings earn their space on a phone, where you thumb-scroll
    // through a section at a time. On a desktop the whole section is usually
    // on screen already, so pinning is just a bar that never goes away.
    sticky: !wide && pick('sticky', settings?.[KEY.sticky]) === 'on',
    repeats: pick('repeats', settings?.[KEY.repeats]),
    notes: pick('notes', settings?.[KEY.notes]) === 'on',
    footer: pick('footer', settings?.[KEY.footer]),
    nav: pick('nav', settings?.[KEY.nav]),
    topBar: pick('topBar', settings?.[KEY.topBar]),
    columns: resolveColumns(settings?.defaultColumns, wide),
    display: resolveChartDisplay(settings),
    // Element 9: tabs for other instruments collapse. A manual override in
    // settings wins over the band, and 'all' means never collapse.
    myInstrument: settings?.tabInstrument && settings.tabInstrument !== 'all'
      ? settings.tabInstrument
      : myInstrument,
    embedded,
  };

  // --- physical facts, not preferences ---

  // A note belongs to its line either way; only the treatment changes with the
  // room. Wide: out to the right edge on a dotted leader, like a printed
  // chart. Narrow: above its line, so it is read before the line is sung.
  cfg.notePlacement = wide ? 'leader' : 'above';

  if (!wide) {
    // Left/right used to collapse to 'top' here — a docked 56px rail really did
    // have nowhere to live on a 390px screen. It FLOATS now (transparent, over
    // the chart, owner 2026-08-01), so it costs no layout width and the phone
    // can have it. Columns still can't: two columns of lyrics on a phone is
    // four words a line.
    cfg.columns = 1;
  }

  return cfg;
}
