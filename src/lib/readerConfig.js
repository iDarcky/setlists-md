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
  // 4 — the band cue under a section heading (`> text`).
  notes: ['on', 'off'],
  // 5 — the inline `{!…}` note mid-line. It was the SAME knob as the cue until
  // 2026-08-04 (owner: *"can we split this into two options one for notes and
  // one for cues?"*) — they are different marks, written by different people
  // for different reasons, and wanting one is no reason to want the other.
  inlineNotes: ['on', 'off'],
  footer: ['count', 'next'],               // 10
  nav: ['footer', 'pill', 'edge', 'swipe'],// 10
  // 8 — what hangs under the top bar. 'ribbon' maps the SONG, 'setlist' maps
  // the SET (the app's original player bar). Never both: two maps competing for
  // one glance.
  topBar: ['ribbon', 'setlist'],
  // 29 — the setlist rail. It existed with no way to turn it off: open/closed
  // was remembered per device in localStorage, but the strip itself was always
  // there. Owner, 2026-08-04: "the only one that we don't have is the setlist
  // rail but we can add that easy here."
  rail: ['on', 'off'],
  // Which way two columns are READ. 'down' is multicol (fill column 1, then
  // column 2, balanced); 'across' is a grid laid left→right. See the note in
  // `Reader` — 'across' cannot be balanced, by construction.
  flow: ['down', 'across'],
  // How far through the SET you are, as a hairline at the top of the chrome.
  // Owner, 2026-08-04: "easy, do it".
  progress: ['on', 'off'],
};

const DEFAULTS = {
  ribbon: 'top',
  heading: 'name',
  // 'plain' — the original chart's look: the heading carries the section and
  // there is no rule beside it. Promoted from 'bar' on 2026-08-04 (owner:
  // *"maybe we can change the No line name and make it default"*): a chart is
  // paper, and paper has no frames on it.
  sectionStyle: 'plain',
  sticky: 'on',
  repeats: 'condensed',
  notes: 'on',
  inlineNotes: 'on',
  footer: 'next',
  nav: 'footer',
  topBar: 'ribbon',
  rail: 'on',
  flow: 'down',
  progress: 'on',
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
  inlineNotes: 'readerInlineNotes',
  footer: 'readerFooter',
  nav: 'readerNav',
  topBar: 'readerTopBar',
  rail: 'readerRail',
  flow: 'readerFlow',
  progress: 'readerProgress',
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
  inlineNotes: true,
  footer: 'next',
  nav: 'footer',
  columns: 1,
};

/**
 * ── The view table ──────────────────────────────────────────────────────────
 *
 * **A view is a TEMPLATE of the Reader** (`docs/READER.md`): one renderer,
 * different defaults and different chrome. What makes Live different from
 * Practice is not a different chart — it is which capabilities are switched on.
 *
 * This table is where that difference LIVES. The owner, 2026-08-03: *"in the
 * end I want each view to do something else, for example the key transpose for
 * practice but not for live, how do we implement it now before we do the
 * split?"* — this is the answer. Without it, every per-view difference becomes
 * a `mode === 'practice'` check scattered across ten components, and the split
 * becomes a hunt rather than an edit.
 *
 * Two rules:
 *
 *  1. **A capability is a fact about the VIEW, not a user setting.** Nothing
 *     here goes in `READER_KNOBS`, the ☰ or `PORTABLE_PREF_KEYS`. If the user
 *     should be able to change it, it is a knob, not a capability.
 *  2. **Read it as `config.can.<x>` at the call site.** One line where it is
 *     used, so the decision stays here.
 *
 * ⚠ **Every value below currently matches what the reader ALREADY does**, so
 * introducing this table changed no behaviour. That is deliberate: the
 * mechanism lands first and separately from any decision about what goes in it.
 * Flipping a `true` to a `false` here is the whole edit.
 */
const VIEW = {
  live: {
    // Element 1's key pill. `true` = a live Select; `false` = a plain chip
    // showing the key it is written in. On in BOTH views — see `saveKey`.
    transpose: true,
    // Whether a changed key can be KEPT, and whether the reader says so.
    //
    // The owner's scenario, 2026-08-03, and it settles this: *"the piano player
    // starts the song transpose +3 but in G and the guitar/bass/electric has to
    // quickly transpose in their own apps, but then the save button appears."*
    // Mid-service, three players are transposing at once and none of them is
    // deciding anything about the setlist — a Save appearing three times is
    // noise at the exact moment there is least attention to spare. So **live is
    // quick and SILENT**: transpose freely, nothing appears, nothing persists.
    // **Practice is obvious**: the Save shows up, because in practice changing
    // the key IS the decision being made.
    saveKey: false,
    // Element 12's metronome icon in the bar.
    practiceTools: true,
    // The edit icon — §7 #12. Not built yet; practice-only when it is
    // (owner, 2026-08-03: "Practice only.").
    editSong: false,
    // Element 21. Owner: "This should be for the practice view".
    switchArrangement: false,
    // Element 22. The gap is WRITING a note, and it is practice that needs it.
    writeNotes: false,
  },
  practice: {
    transpose: true,
    // Practice is where changing the key is a DECISION, not a scramble, so it
    // is offered and it sticks — onto the setlist item, not the song.
    saveKey: true,
    practiceTools: true,
    // Practice only (owner, 2026-08-03). Editing a shared object mid-service,
    // in a hurry, is the same argument `MissingSongScreen` already uses for
    // refusing "remove from setlist".
    editSong: true,
    switchArrangement: true,
    writeNotes: true,
  },
};

// The hub view is not a "view" in the owner's sense — it is the Reader with the
// settings wire cut. It can do none of these: it is a browsing surface.
const HUB_CAN = {
  transpose: false,
  saveKey: false,
  practiceTools: false,
  editSong: false,
  switchArrangement: false,
  writeNotes: false,
};

export function resolveViewCapabilities(mode) {
  return VIEW[mode] || VIEW.live;
}

export function resolveReaderConfig(settings, ctx = {}) {
  const {
    wide = false, embedded = false, myInstrument = null,
    // 'live' | 'practice'. Campfire and the hub's full screen become rows in
    // VIEW when they stop being routes into `live`.
    mode = 'live',
  } = ctx;

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
      can: HUB_CAN,
      mode: 'hub',
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
    inlineNotes: pick('inlineNotes', settings?.[KEY.inlineNotes]) === 'on',
    footer: pick('footer', settings?.[KEY.footer]),
    nav: pick('nav', settings?.[KEY.nav]),
    topBar: pick('topBar', settings?.[KEY.topBar]),
    rail: pick('rail', settings?.[KEY.rail]) === 'on',
    flow: pick('flow', settings?.[KEY.flow]),
    progress: pick('progress', settings?.[KEY.progress]) === 'on',
    columns: resolveColumns(settings?.defaultColumns, wide),
    display: resolveChartDisplay(settings),
    // Element 9: tabs for other instruments collapse. A manual override in
    // settings wins over the band, and 'all' means never collapse.
    myInstrument: settings?.tabInstrument && settings.tabInstrument !== 'all'
      ? settings.tabInstrument
      : myInstrument,
    embedded,
    // What this VIEW can do, as opposed to what the user has chosen. See the
    // VIEW table above.
    can: resolveViewCapabilities(mode),
    mode,
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
