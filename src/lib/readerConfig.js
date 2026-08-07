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
  // 4 — the section frame. Redesigned 2026-08-06: a frame is now only about
  // WHERE THE SECTION'S COLOUR LIVES, and none of the four takes a pixel of
  // width from the lyrics.
  //
  //   plain — nothing; the coloured heading is the whole mark (default)
  //   rule  — a hairline under the heading, in the section's colour
  //   bar   — that colour as a bar in the LEFT MARGIN, outside the text column
  //   tint  — a low-alpha wash behind the section, EDGE TO EDGE
  //
  // `block` and `card` are gone. They boxed the text: on a 390px phone a Card
  // chorus spent 32px of chart padding + 12.8px of card padding + 13.6px of
  // chorus indent = 58px before a lyric started, and the pinned heading was an
  // opaque slab inset 10px from the card it sat in, with the card's own colour
  // rule floating above it. Both land on `tint` (see REPEATS/STYLE_LEGACY).
  sectionStyle: ['plain', 'rule', 'bar', 'tint'],   // 4
  sticky: ['on', 'off'],                   // 4
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
  // 8 — the set bar's visibility. 'ribbon' means "no set bar"; 'setlist' shows
  // it ABOVE the title row (element 8b, 2026-08-01), with the song's ribbon
  // keeping its own place below: SET / HEADER / STRUCTURE.
  //
  // It was an either/or once — "never both: two maps competing for one glance"
  // — and the owner overruled that. The name is the fossil of the old rule.
  topBar: ['ribbon', 'setlist'],
  // ⚠ `rail` was here, and it is GONE (2026-08-06). It existed to hide the
  // strip the rail kept permanently docked on a wide screen; the strip itself
  // went in the same round — the rail is nothing until the footer's `x / x`
  // counter asks for it — so the switch had nothing left to turn off. A knob
  // whose reason for existing has been removed is worse than no knob: it reads
  // as a promise the app cannot keep. Owner: *"yes do that, it's cleaner."*
  // Which way two columns are READ. 'down' is multicol (fill column 1, then
  // column 2, balanced); 'across' is a grid laid left→right. See the note in
  // `Reader` — 'across' cannot be balanced, by construction.
  flow: ['down', 'across'],
  // 3 — what a chip on the structure ribbon LOOKS like. Three, since
  // 2026-08-05 (owner: *"Boxes and Inline are kind of the same? Why not
  // keeping boxes/Inline, Dots and Chips?"*).
  ribbonStyle: ['codes', 'chips', 'dots'],
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
  // 'full' — a repeat is written out (owner, 2026-08-06). This file's DEFAULTS
  // are the fallback for a settings object that has no stored value at all;
  // `storage.js DEFAULT_SETTINGS` is what a real profile carries, and the two
  // disagreed (`condensed` here, `full` there) for as long as both existed.
  repeats: 'full',
  notes: 'on',
  inlineNotes: 'on',
  footer: 'next',
  nav: 'footer',
  topBar: 'ribbon',
  flow: 'down',
  progress: 'on',
  ribbonStyle: 'codes',
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
  flow: 'readerFlow',
  progress: 'readerProgress',
  ribbonStyle: 'ribbonStyle',
};

export function readerSettingKey(knob) {
  return KEY[knob];
}

function pick(knob, value) {
  const allowed = READER_KNOBS[knob];
  return allowed.includes(value) ? value : DEFAULTS[knob];
}

// The two styles that were cut, and where their users land. 'numbered' (Inline)
// was the `codes` chip without its box; 'dotlabel' was `dots` with those same
// codes beside them. So each is a variant of a survivor and lands on it —
// nobody opens the reader to find their setting silently reset to the default.
//
// It has to be a MAP, not `pick`'s fallback: the fallback sends everything to
// 'codes', which would move a Dots+label user to boxes.
const RIBBON_LEGACY = { numbered: 'codes', dotlabel: 'dots' };

// Same shape, same reason. 'ref' was the third repeat style ("Chorus — as
// before") and it collapsed onto the Tag pill, so a stored 'ref' MEANS
// 'condensed'. It used to reach that by accident, because `pick`'s fallback
// happened to be 'condensed'; the moment the default became 'full' (2026-08-06)
// that accident would have written those users' repeats out in full.
const REPEATS_LEGACY = { ref: 'condensed' };

// The two frames that were cut, and where their users land. Both drew a filled
// box around the text, and `tint` is the survivor that does that without taking
// the width — so neither user opens the reader to find their setting reset to
// the default. A MAP, not `pick`'s fallback, for the same reason the ribbon's
// is: the fallback sends everything to `plain`, which is "no frame at all".
const STYLE_LEGACY = { block: 'tint', card: 'tint' };

export function normalizeRibbonStyle(value) {
  return pick('ribbonStyle', RIBBON_LEGACY[value] || value);
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
  // Nothing reads this while `ribbon` is 'off'; it is here so the two shapes
  // of the config object stay the same shape.
  ribbonStyle: 'codes',
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
    sectionStyle: pick('sectionStyle',
      STYLE_LEGACY[settings?.[KEY.sectionStyle]] || settings?.[KEY.sectionStyle]),
    // Filled in below — it depends on `columns`, which is resolved in this
    // same object and cannot be read from inside it.
    sticky: false,
    repeats: pick('repeats', REPEATS_LEGACY[settings?.[KEY.repeats]] || settings?.[KEY.repeats]),
    notes: pick('notes', settings?.[KEY.notes]) === 'on',
    inlineNotes: pick('inlineNotes', settings?.[KEY.inlineNotes]) === 'on',
    footer: pick('footer', settings?.[KEY.footer]),
    nav: pick('nav', settings?.[KEY.nav]),
    topBar: pick('topBar', settings?.[KEY.topBar]),
    flow: pick('flow', settings?.[KEY.flow]),
    ribbonStyle: normalizeRibbonStyle(settings?.[KEY.ribbonStyle]),
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


  if (!wide) {
    // Left/right used to collapse to 'top' here — a docked 56px rail really did
    // have nowhere to live on a 390px screen. It FLOATS now (transparent, over
    // the chart, owner 2026-08-01), so it costs no layout width and the phone
    // can have it. Columns still can't: two columns of lyrics on a phone is
    // four words a line.
    cfg.columns = 1;
  }

  // ── Pinning is about COLUMNS, not about screen size ─────────────────────────
  // It used to be `!wide && …`, which meant the switch read ON and did nothing
  // on every device 768px and wider — including an iPad in portrait and a
  // one-column desktop. The owner tested exactly that: *"I've tested on one
  // column on desktop and still doesn't pin… if not, we have to remove the
  // option."*
  //
  // The reason it was off was a judgement ("the whole section is usually on
  // screen already"), not a limitation: measured in Chromium 2026-08-06,
  // `position: sticky` pins identically inside a 2-column multicol and a single
  // column. So it pins everywhere now, with one honest exception — TWO COLUMNS.
  // There the reading order runs down one column and up the next, so two
  // headings would pin side by side to one reading line and the "where am I"
  // they answer would be two different places. The ☰ hides the switch when
  // columns are 2 (owner's call), the same way the ribbon hides the side
  // positions for a style that cannot float.
  cfg.sticky = cfg.columns === 1 && pick('sticky', settings?.[KEY.sticky]) === 'on';

  // ── Where an inline note goes: a GUTTER, everywhere ────────────────────────
  // A strip down the right that the lyrics stop before, with the notes in it.
  //
  // The dotted LEADER used to own wide screens — the note pinned to the right
  // edge of its column, joined to the words by dots. Seen at 1280 in two
  // columns it was the wrong call: a 594px column with an ordinary lyric leaves
  // ~400px of dotted rule running across the page, which reads as a divider
  // rather than a connection (owner, 2026-08-06: *"for 2 column is not quite
  // good"*). One treatment for every width also means one place where a note's
  // vertical alignment has to be right, and it was 5px out on wide too.
  //
  // Measured on a 390px phone, a PERMANENT gutter costs **24% of the song's
  // height** (549px → 682px for the same eight lines) — so it is not permanent.
  // `ReaderSection` asks for it PER SECTION, and only a section that actually
  // contains a note pays (owner: *"if no notes we use for lyrics if notes we
  // have a space for them"*). A section with none uses the full width.
  //
  // 'above' — a note on its own line over its lyric — is still what a section
  // falls back to if inline notes are switched off mid-section.
  cfg.notePlacement = 'gutter';

  return cfg;
}
