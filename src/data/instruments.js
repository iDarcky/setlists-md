/**
 * The musical attribute — what you PLAY. One closed list, shared by everything.
 *
 * This is the second of the app's two axes (the first is the administrative
 * role, in `lib/teamRoles.js`). It is deliberately NOT a permission: it is a
 * list, it is unordered, it may differ per service, and it decides what you
 * SEE rather than what you may change.
 *
 * ## Why this file exists
 *
 * Before it, the same idea was spelled out FOUR times, in four vocabularies
 * that never agreed:
 *
 *   1. `Account.jsx` — `SUGGESTED_INSTRUMENTS`, free text, Title Case labels
 *   2. `SchedulingGrid.jsx` — `INSTRUMENT_OPTIONS` + `VOCAL_PARTS`, free text
 *   3. `BandPanel.jsx` — the same two lists again, duplicated as literals
 *   4. `ReaderMenu.jsx` — `ROLES`, lowercase ids, device-local, never synced
 *
 * ⚠ **And they met at a comparison that could never be true.** `SectionBlock`
 * decides whether to open a tab with `tab.instrument === myInstrument`, where
 * `tab.instrument` is a `TAB_INSTRUMENTS` key (`acoustic`) and `myInstrument`
 * came from `team_schedules.role` (`"Acoustic Guitar"`). So the one thing this
 * whole axis did — collapse the tabs that are not yours — was inverted for
 * every user the team had actually scheduled: their own instrument's tab was
 * the one that stayed shut. Nothing failed and nothing logged. `tabId()` below
 * is the translation that was missing.
 *
 * ## Storage
 *
 * A stored value is a token: `"drums"`, or `"vocals:soprano"` for an
 * instrument with a part. `team_members.instruments` (text[]) and
 * `team_schedules.role` (text) both hold these.
 *
 * ⚠ **Existing rows are NOT migrated, on purpose.** Production holds Title Case
 * labels (`"Acoustic Guitar"`, `"Bass"`) written by older builds, and PLAN
 * §1.2 #6 documents a stale client still writing to this database that no code
 * we ship can reach. A rewrite would be undone by that client and leave both
 * forms in the column. So: store canonical going forward, and `normalize()`
 * every value on READ. 34 rows stay exactly as they are.
 */

/**
 * Vocals' second level. A part is never stored on its own — always `vocals:x`.
 *
 * **Lead male and lead female stay separate** (owner, 2026-08-07). A first cut
 * folded both into one `lead`, which would have quietly flattened the 6 rows
 * production already holds — 5 "Lead male" and 1 "Lead female", entered by a
 * leader who evidently wanted the distinction. Soprano/Alto/Tenor/Bass encode
 * range; lead male/female encodes which of the two the room follows, and those
 * are not the same question.
 */
export const VOCAL_PARTS = [
  { id: 'lead-male', label: 'Lead male' },
  { id: 'lead-female', label: 'Lead female' },
  { id: 'soprano', label: 'Soprano' },
  { id: 'alto', label: 'Alto' },
  { id: 'tenor', label: 'Tenor' },
  { id: 'bass', label: 'Bass' },
  { id: 'backing', label: 'Backing' },
];

/**
 * The instruments themselves.
 *
 * `display` and `tabs` are what the reader reads:
 *   • `display` — the mode this player wants by default (chords vs lyrics)
 *   • `tabs`    — which `TAB_INSTRUMENTS` block is THEIRS (null = none are)
 *   • `diagrams`— whether chord diagrams are useful to them
 */
export const INSTRUMENTS = [
  { id: 'vocals', label: 'Vocals', parts: VOCAL_PARTS, display: 'lyrics', tabs: null, diagrams: false },
  { id: 'acoustic-guitar', label: 'Acoustic Guitar', display: 'chords', tabs: 'acoustic', diagrams: true },
  { id: 'electric-guitar', label: 'Electric Guitar', display: 'chords', tabs: 'electric', diagrams: true },
  { id: 'bass-guitar', label: 'Bass Guitar', display: 'chords', tabs: 'bass', diagrams: false },
  { id: 'keys', label: 'Keys', display: 'chords', tabs: null, diagrams: false },
  { id: 'piano', label: 'Piano', display: 'chords', tabs: null, diagrams: false },
  { id: 'drums', label: 'Drums', display: 'lyrics', tabs: null, diagrams: false },
];

const BY_ID = new Map(INSTRUMENTS.map(i => [i.id, i]));
const PART_BY_ID = new Map(VOCAL_PARTS.map(p => [p.id, p]));

/**
 * Every spelling any older build could have written, lower-cased.
 *
 * ⚠ `"bass"` is genuinely ambiguous: it was a value in BOTH the instrument
 * picker (the guitar) and the vocal-parts picker (the voice), writing to one
 * free-text column, so a stored `"Bass"` cannot be told apart after the fact.
 * It maps to the instrument — 4 of the 4 stored uses are in a church band's
 * schedule alongside drums and keys. Someone who meant the voice re-picks
 * `Vocals → Bass` once.
 */
const LEGACY = {
  // vocals
  'vocals': 'vocals',
  'vocal': 'vocals',
  'vocalist': 'vocals',
  // "Lead Vocal" names no gender, so it resolves to plain Vocals rather than
  // guessing one of the two.
  'lead vocal': 'vocals',
  'lead vocals': 'vocals',
  'lead': 'vocals',
  'lead male': 'vocals:lead-male',
  'lead female': 'vocals:lead-female',
  'soprano': 'vocals:soprano',
  'alto': 'vocals:alto',
  'tenor': 'vocals:tenor',
  'backing': 'vocals:backing',
  'backing vocals': 'vocals:backing',
  // guitars
  'acoustic guitar': 'acoustic-guitar',
  'acoustic': 'acoustic-guitar',
  'electric guitar': 'electric-guitar',
  'electric': 'electric-guitar',
  'guitar': 'electric-guitar',
  // bass — see the warning above
  'bass': 'bass-guitar',
  'bass guitar': 'bass-guitar',
  // the rest
  'drums': 'drums',
  'drum': 'drums',
  'keys': 'keys',
  'keyboard': 'keys',
  'piano': 'piano',
  // `ReaderMenu`'s old preset ids. `leader` is NOT an instrument — leading a
  // service is an administrative role plus a per-service flag, so it resolves
  // to nothing rather than quietly becoming somebody's instrument.
  'leader': null,
  'worship leader': null,
};

/**
 * Any stored or typed value → a canonical token, or null if it means nothing.
 * Accepts `"Acoustic Guitar"`, `"acoustic-guitar"`, `"vocals:soprano"`.
 */
export function normalize(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;

  const [head, part] = s.split(':').map(x => x.trim());

  // Already canonical?
  if (BY_ID.has(head)) {
    if (!part) return head;
    const inst = BY_ID.get(head);
    return inst.parts && PART_BY_ID.has(part) ? `${head}:${part}` : head;
  }

  // A legacy spelling. `null` is a real answer here ("leader"), so check
  // presence rather than truthiness.
  if (Object.prototype.hasOwnProperty.call(LEGACY, s)) return LEGACY[s];
  if (Object.prototype.hasOwnProperty.call(LEGACY, head)) return LEGACY[head];

  return null;
}

/** Split a token into its parts. `{ instrument, part }`, both possibly null. */
export function parseToken(token) {
  const canon = normalize(token);
  if (!canon) return { instrument: null, part: null };
  const [id, part] = canon.split(':');
  return { instrument: BY_ID.get(id) || null, part: part ? PART_BY_ID.get(part) || null : null };
}

/** Human label: `"Vocals"`, `"Vocals · Soprano"`, `"Bass Guitar"`. */
export function labelFor(token) {
  const { instrument, part } = parseToken(token);
  if (!instrument) return '';
  return part ? `${instrument.label} · ${part.label}` : instrument.label;
}

/**
 * Which `TAB_INSTRUMENTS` block belongs to this player — the translation whose
 * absence inverted element 9. Null means "no tab is specifically theirs".
 */
export function tabId(token) {
  return parseToken(token).instrument?.tabs ?? null;
}

/** The display mode this player wants by default: 'chords' | 'lyrics' | null. */
export function displayModeFor(token) {
  return parseToken(token).instrument?.display ?? null;
}

/** Are chord diagrams useful to this player? */
export function wantsDiagrams(token) {
  return parseToken(token).instrument?.diagrams ?? false;
}

/**
 * Every pickable token, flattened for a picker: an instrument with parts
 * offers the instrument itself AND each part.
 */
export function pickableTokens() {
  const out = [];
  for (const inst of INSTRUMENTS) {
    out.push({ token: inst.id, label: inst.label, parent: null });
    for (const p of inst.parts || []) {
      out.push({ token: `${inst.id}:${p.id}`, label: p.label, parent: inst.id });
    }
  }
  return out;
}
