# Setlists MD — Product Specification
### Worship Chord Chart PWA for Small-to-Medium Churches
**Version:** Draft 1.2
**Last updated:** April 2026

---

## 1. Product Vision

Setlists MD is a free, offline-first Progressive Web App that replaces
paper chord charts, PraiseCharts PDFs, and scattered Google Docs for
worship teams at small-to-medium churches.

**Target user:** A worship leader with a guitar and an iPad on a mic
stand, leading a 3-7 piece band. No playback engineer, no Ableton rig,
no backing tracks infrastructure.

**Core promise:** Your songs are portable `.md` files. The app is a
beautiful renderer with transpose, setlists, and pedal control. It
works offline, installs on any tablet, and costs nothing.

---

## 2. Technical Architecture

### Stack
- **Vite + React** — static SPA, no server
- **idb-keyval** — IndexedDB wrapper for persistent local storage
- **vite-plugin-pwa** — service worker + manifest for offline/installable
- **Vercel** — free static hosting

### Data Model
All data lives in IndexedDB as JSON. Songs are also exportable/importable
as `.md` files. No database, no API, no auth (until v3 Google Drive sync).

```
IndexedDB keys:
  Setlists MD:songs      → Song[]
  Setlists MD:setlists   → Setlist[]
  Setlists MD:settings   → UserSettings
  Setlists MD:history    → PlayHistory[]
```

### Responsive Breakpoints
```
Mobile     (<  640px)  — 1 column forced, phone-optimized
Tablet-P   (640-1024)  — 1 column default, 2 optional
Tablet-L   (1024+)     — 2 column default
Desktop    (1280+)     — 2 column, wider margins
```

Orientation detection via CSS `@media (orientation: landscape)` and
`(orientation: portrait)` — layout switches automatically when the
device is rotated. No manual toggle needed.

---

## 3. The .md Song Format (v2)

```markdown
---
title: Build My Life
artist: Worship Central
key: E
tempo: 68
time: 4/4
ccli: "7070345"
tags: [slow, communion, modern]
spotify: https://open.spotify.com/track/...
structure: [Verse 1, Verse 2, Pre Chorus, Chorus, Bridge, Chorus, Ending]
---

## Verse 1
> Keys & light acoustic
[E]Worthy of [B/D#]every song we could [C#m]ever sing
[A2]Worthy of all the praise we could [E]ever bring

## Verse 2
[E]Worthy of [B/D#]every breath we could [C#m]ever breathe
[A2]We live for [B]You  {!bass enters}

## Pre Chorus
> Add bass
[C#m]Open up [B/D#]my eyes in [A2]wonder  {!electric swells}
[C#m]Show me [B/D#]who You are and [A2]fill me
[B]With Your heart and lead me
[A2]In Your love to those around me

## Chorus
> Full band
[E]I will build my [B]life upon Your love
[C#m]It is a [A2]firm foundation
[E]I will put my [B]trust in You alone
[C#m]And I will [A2]not be shaken

## Bridge
> Build through repeats
{modulate: +2}
[F#]Holy, there is [C#]no one like You
[D#m]There is none be[B2]side You

## Ending
{tab}
e|---0---0---0---0---|
B|---0---0---0---0---|
G|---1---1---1---1---|
D|---2---2---2---2---|
{/tab}
(ad lib worship)
```

### Format Rules

| Syntax | Purpose | Example |
|--------|---------|---------|
| `---` | YAML frontmatter wrapper | `title: Song Name` |
| `## Name` | Section header | `## Verse 1`, `## Chorus` |
| `> Text` | Section-level band cue | `> Full band enters` |
| `[Chord]` | Inline chord above lyric | `[A]Lyrics here` |
| `{!note}` | Inline performance note | `{!electric drops out}` |
| `{modulate: +N}` | Key change from this point | `{modulate: +1}` |
| `{tab}...{/tab}` | Guitar tablature block | Standard 6-line ASCII tab, rendered as SVG |
| `{tab, time: 4/4}` | Tab block with time signature | Used by grid editor |
| `{piano: Chord}` | Piano voicing reference | Future feature |
| Empty line | Visual spacing | |
| Plain text | Lyrics without chords | |

### Supported Section Types
Each type has a unique color, border, and circle label:

| Type | Label | Color |
|------|-------|-------|
| Intro | I | Indigo |
| Verse | V | Green |
| Pre Chorus | Pc | Amber |
| Chorus | C | Pink |
| Bridge | B | Cyan |
| Instrumental | It | Yellow |
| Refrain | Rf | Purple |
| Tag | T | Blue |
| Interlude | Il | Violet |
| Vamp | Vm | Orange |
| Outro | O | Red |
| Ending | E | Rose |

### YAML Frontmatter Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | yes | Song title |
| artist | string | yes | Artist/band name |
| key | string | yes | Original key (e.g., A, Bb, C#m) |
| tempo | number | yes | BPM |
| time | string | yes | Time signature (4/4, 6/8, 3/4) |
| ccli | string | no | CCLI song number (quoted) |
| tags | array | no | Categorization tags |
| spotify | string | no | Link to reference recording |
| youtube | string | no | Link to reference video |
| structure | array | no | Section order for ribbon display |
| capo | number | no | Default capo position |
| notes | string | no | General song notes |

---

## 4. Data Models

### Song
```
{
  id: string,
  title: string,
  artist: string,
  key: string,
  tempo: number,
  time: string,
  ccli: string,
  tags: string[],
  spotify: string,
  youtube: string,
  structure: string[],
  sections: Section[],
  capo: number,
  notes: string,
  createdAt: number,
  updatedAt: number,
}
```

### Section
```
{
  type: string,        // "Verse 1", "Chorus", etc.
  note: string,        // Section-level band cue
  lines: (string | TabObject | ModulateObject)[],
                       // Mixed array: raw lyric strings, tab blocks, modulate markers
}

// TabObject: { type: 'tab', strings: [{note, content}], time, raw: [] }
// ModulateObject: { type: 'modulate', semitones: number }
```

### Setlist
```
{
  id: string,
  name: string,        // "Sunday Morning — March 30"
  date: string,        // ISO date
  service: string,     // "Morning" | "Evening" | "Special"
  items: SetlistItem[],
  createdAt: number,
  updatedAt: number,
}
```

### SetlistItem
```
{
  songId: string,
  transpose: number,   // Per-song transpose in setlist
  capo: number,        // Per-song capo override
  note: string,        // "Skip bridge" or "extend outro"
}
```

### UserSettings
```
{
  language: string,     // UI language: "en", "es", "pt", "fr", "de", "ko", "zh", etc.
  defaultColumns: 1 | 2 | "auto",
  defaultFontSize: "S" | "M" | "L",
  chordDisplay: "standard" | "nashville" | "none",
  lyricsDisplay: "full" | "none",
  theme: "dark" | "light",
  showInlineNotes: boolean,
  duplicateSections: "full" | "compact" | "first-chords-only",
  pedalPrev: string,   // Key code for previous song
  pedalNext: string,   // Key code for next song
  pedalScroll: string,  // Key code for scroll
  autoScrollSpeed: number,
  // Role
  role: "leader" | "vocalist" | "acoustic" | "electric" | "bass" | "keys" | "drums",
  // Sync
  syncProvider: "off" | "google-drive" | "dropbox" | "onedrive" | "webdav" | "Setlists MD",
  syncToken: string,    // OAuth token or auth credential (encrypted)
  syncFolderId: string, // Provider-specific folder reference
  lastSyncedAt: number, // Timestamp of last successful sync
}
```

### PlayHistory
```
{
  songId: string,
  setlistId: string,
  date: string,
  key: string,         // Key it was played in
}
```

---

## 5. Views & Features

### 5.1 Library View
- Song list with search (title, artist, key, tags)
- Sort by: title, artist, key, last played, date added
- Filter by tags
- Song count and setlist count in header
- Import .md files (single or multiple)
- Export single song or entire library as .md files
- New song button → opens Editor
- Tabs: Songs | Setlists

### 5.2 Chart View
Core chord chart renderer. Two sub-modes:

#### Rehearsal Mode
- Full section blocks with all cues and inline notes visible
- Transpose controls (+/− semitones)
- Capo calculator display (Key: Bb → Capo 3, play G shapes)
- Layout toggle (1col / 2col / auto)
- Font size toggle (S / M / L)
- Chord display toggle (Standard / Nashville / None)
- Duplicate section handling toggle (Full / Compact / First chords only)
- Structure ribbon (Multitracks-style colored pills)
- Section tap to highlight/loop
- Edit button → opens Editor
- Modulation banners between sections
- Tab blocks rendered in monospace
- Inline notes shown as subtle colored pills on lyric lines

#### Live Mode
- Stripped-down UI: no edit button, no transpose controls
  (transpose is locked per setlist item)
- Larger default font
- Chords and lyrics only (inline notes optional via settings)
- Section headers visible but minimal
- Optimized for glanceable reading while playing
- Pedal navigation (prev/next song)
- Auto-scroll with speed control

### 5.3 Display Modes (apply to both Rehearsal and Live)

#### Chord Display
- **Standard** — letter-name chords: A, Bm, F#m7
- **Nashville** — number system: 1, 2m, 6m7
- **Chords only** — no lyrics, just chord grid per section
- **None** — lyrics only, all chords hidden

#### Duplicate Section Handling
- **Full** — every section rendered completely
- **Compact** — first occurrence full, repeats show collapsed
  reference pill: "Chorus (see above)" with section color
- **First chords only** — chords shown on first verse/chorus,
  subsequent occurrences show lyrics only

#### Responsive Layout
- **Auto** (recommended) — detects orientation and screen size
  - Phone: 1 column always
  - Tablet portrait: 1 column
  - Tablet landscape: 2 columns
  - Desktop: 2 columns with wider margins
- **1 Column** — forced single column regardless of device
- **2 Column** — forced two column (may be cramped on phones)

### 5.4 Editor View

Three editor tabs, each serving a different user comfort level.
All three read/write the same `.md` source — switching tabs preserves
all content.

#### Tab 1: Visual Editor (default)
A toolbar + textarea combo. The textarea shows raw markdown, but a
toolbar row above it handles all syntax insertion so users never need
to type brackets, curly braces, or YAML manually.

**Toolbar buttons:**

| Button | Label | Action |
|--------|-------|--------|
| ♪ | Chord | Opens chord picker popup (root: A-G with #/b, suffix: m, 7, m7, sus4, add9, maj7, dim, aug). Inserts `[Chord]` at cursor. |
| § | Section | Dropdown: Verse, Chorus, Bridge, Pre Chorus, Intro, Instrumental, Ending, Tag, etc. Inserts `## Section Name` with auto-numbering (if Verse 1 exists, next insert becomes Verse 2). |
| 📢 | Band Cue | Text input popup → inserts `> cue text` on line below current section header. |
| 💬 | Inline Note | Text input popup → inserts `{!note text}` at cursor position on current lyric line. |
| ↑ | Modulate | Picker: +1 to +7 semitones → inserts `{modulate: +N}` at start of current section. |
| ┃ | Tab Block | Opens interactive tab grid editor. If cursor is inside an existing `{tab}...{/tab}` block, opens pre-loaded for editing; otherwise inserts new. |
| ⓘ | Metadata | Opens a form overlay with fields for title, artist, key, tempo, time, CCLI, tags, spotify, youtube. Writes/updates the YAML frontmatter block without user touching `---` syntax. |

**Chord picker detail:**
The chord picker is a small inline popup, not a full-screen modal.
Top row: note root buttons (A, B, C, D, E, F, G) with a #/b toggle.
Bottom row: suffix buttons (major, m, 7, m7, sus4, add9, maj7, dim).
Tap root + suffix → chord inserted → popup closes. Fast enough to
chord an entire verse without leaving the textarea.

**Smart insertion behavior:**
- Cursor on an empty line → inserts chord followed by space for lyrics
- Cursor within lyrics text → inserts chord at exact cursor position
- Selected text → wraps selection: `[Chord]selected text`
- Section button always inserts on a new line with blank line above

#### Tab 2: Form Editor
A fully structured form — no markdown visible at all. Best for users
creating a song from scratch who have never seen ChordPro notation.

**Layout:**
- Top section: metadata fields (title, artist, key, tempo, time, etc.)
- Below: section-by-section blocks, each with:
  - Section type dropdown + auto-number
  - Band cue text field
  - Lyric textarea per section
  - "Add chord" button that lets you tap a position in the lyrics
    and select a chord from the picker
  - "Add inline note" button
  - Modulation toggle
- "Add Section" button at bottom
- Drag-to-reorder sections

The Form Editor generates `.md` on save. Switching to Visual or Raw
tab shows the generated markdown.

#### Tab 3: Raw Editor
Plain textarea, no toolbar, no assistance. For power users who type
fast and know the `.md` format by heart. Syntax reference link at top
in case they need a reminder.

#### Preview (available from all tabs)
- Toggle button or swipe to preview
- Shows the full rendered chart as it will appear in Chart View
- Split-screen option on tablets (editor left, preview right)
- Updates in real-time as you type

#### Additional Editor Features
- Save / Delete buttons in sticky header
- Import from clipboard (paste plain text, auto-detect format)
- Undo/redo support
- Character count and section count display

### 5.5 Setlist Builder
- Name, date, service type (Morning/Evening/Special)
- Add songs from library with search
- Reorder with up/down arrows (drag-and-drop in v2)
- Per-song transpose override
- Per-song capo override
- Per-song notes field
- Remove songs
- Estimated total duration
- Key compatibility indicator between adjacent songs
- Save as Rehearsal or Live setlist

### 5.6 Setlist Player
Two sub-modes:

#### Rehearsal Player
- Full chart view with all controls visible
- Song strip showing all songs with keys
- Progress bar across top
- Prev/next navigation
- Per-song notes banner
- Tap any song in strip to jump
- All Chart View rehearsal features available

#### Live Player
- Stripped-down chart (Live mode)
- Song strip (minimal — just numbers and song names)
- Progress bar
- Prev/next via on-screen buttons or Bluetooth pedal
- Per-song notes banner (if present)
- Auto-scroll active by default
- No edit controls, no distractions

### 5.7 Settings View
- **Language**: UI language selector (see Section 15: i18n)
- **Display**: default columns, font size, theme (dark/light)
- **Chords**: default chord display (standard/nashville),
  duplicate section handling
- **Performance**: inline notes on/off, auto-scroll speed
- **Pedal mapping**: assign key codes for prev/next/scroll
- **Data**: export all songs, export all setlists, import,
  clear all data
- **About**: version, format reference, link to docs
- Settings persist in IndexedDB
- Future: sync settings via Google Drive

### 5.8 Smart Import (v2)

#### Supported Input Formats

| Priority | Format | Extension | Source | Difficulty |
|----------|--------|-----------|--------|:----------:|
| 1 | **Setlists MD native** | `.md` | Setlists MD | Trivial — direct parse |
| 2 | **ChordPro** | `.cho`, `.chordpro`, `.chopro` | OnSong, SongBook, iReal Pro, many apps | Easy — near-1:1 mapping to our format |
| 3 | **SongSelect** ✅ | `.usr` | CCLI SongSelect downloads | Easy — structured text, worship-specific |
| 4 | **OnSong** | `.onsong` | OnSong app export | Easy — ChordPro variant with extensions |
| 5 | **Plain text** | `.txt` | Ultimate Guitar, copy-paste, handwritten | Medium — chord-above-lyrics detection |
| 6 | **OpenSong** | `.xml` | OpenSong app | Easy — structured XML |
| 7 | **Word document** | `.docx` | Google Docs export, church templates | Medium — text extraction via mammoth.js |
| 8 | **PDF** | `.pdf` | PraiseCharts, printed charts | Hard — best-effort text extraction via pdf.js |
| 9 | **Clipboard paste** | N/A | Any source | Medium — auto-detect format from pasted text |

#### ChordPro → Setlists MD Conversion
ChordPro is the most widely used chord chart format. Conversion is
nearly 1:1:

```
ChordPro                          Setlists MD .md
─────────                         ──────────────
{title: Build My Life}        →   title: Build My Life (in YAML)
{artist: Worship Central}     →   artist: Worship Central
{key: E}                      →   key: E
{comment: Full band}          →   > Full band
[E]Worthy of [B/D#]every      →   [E]Worthy of [B/D#]every (same!)
{start_of_chorus}             →   ## Chorus
{end_of_chorus}               →   (next ## or end of file)
{start_of_tab}                →   {tab}
{end_of_tab}                  →   {/tab}
```

#### SongSelect `.usr` File Format
```
[File]
Type=SongSelect
[Song]
Title=Build My Life
Author=Brett Younker, Karl Martin...
Copyright=2016 Bethel Music
CCLI=7070345
Key=E
[Verse 1]
Worthy of every song we could ever sing
```
Note: SongSelect files contain **lyrics without inline chords**.
They provide structure and metadata. Chords must be added manually
after import. Still valuable — saves typing all the lyrics.

**Implemented** in `src/importer.js` (`convertSongSelect`). Handles both the
`[Song]` + `[Verse 1]`-block variant above and the real-world
`[File]`/`[S A#######]` export with slash-delimited `Fields=` labels and a
`Words=` blob (`//` between sections, `/` between lines). Brings in title,
author, copyright (→ `notes`), CCLI #, key, `structure`, and lyrics.

#### OnSong Import
OnSong uses ChordPro with proprietary extensions:
- `Flow:` directive (maps to our `structure:` field)
- `Duration:` directive
- Custom metadata fields
Handle known extensions, ignore unknown ones gracefully.

**Implemented** in `convertChordPro`: a `Flow:` line (or `{flow: …}`) overrides
the derived section order via `parseFlow()` (expands `V1 C V2 C`-style
abbreviations); `Duration:` maps to the `duration` field. All importers now also
emit a derived `structure:` even without an explicit `Flow:`.

#### Chord-Above-Lyrics Detection (for .txt / clipboard)
```
For each pair of adjacent lines:
  1. Check if line N is a "chord line":
     - Tokenize by whitespace
     - Each token matches chord regex: /^[A-G][#b]?...$/
     - More than 50% of line width is whitespace
     - Line has no lowercase words longer than 3 chars
  2. If chord line detected, line N+1 is the lyric line
  3. Map chord positions by character column:
     - Chord at column 14 → insert [Chord] at position 14 in lyrics
  4. Detect section headers:
     - Lines matching [Verse 1], [Chorus], (Chorus), VERSE, etc.
     - Convert to ## Section Name format
  5. Show converted preview for user review before saving
```

#### Import UX Flow
1. User selects file(s) or pastes text
2. App auto-detects format from extension / content analysis
3. Shows conversion preview: "We found 1 song — here's how it will
   look in Setlists MD" with the rendered chart preview
4. User can edit before confirming
5. On confirm: song added to library
6. For batch import: show list of detected songs with checkboxes

#### Platforms We Can't Directly Import From
- **MultiTracks / Charts** — PDF-only export, in-app DRM, no API
- **Planning Center** — API exists but requires PCO OAuth (could be
  a future integration, not a file import)
- **ProPresenter** — `.pro` files contain lyrics only (no chords),
  binary format, low priority
- **OpenLP** — XML but lyrics-only (no chords), low priority

---

## 5.9 Instrument Role Profiles

### Concept
The same `.md` song file contains all information — chords, lyrics,
tabs, cues, notes. But different band members need different views.
A vocalist doesn't need chord names cluttering their lyric sheet.
A guitarist doesn't need piano voicings. A drummer needs rhythm
info, not chord progressions.

**This is a display-layer feature.** The underlying data never changes.
Role profiles are a render filter applied at view time.

### Roles

| Role | Sees | Hides | Special |
|------|------|-------|---------|
| **Worship Leader** | Everything | Nothing | Full access, default role |
| **Vocalist** | Lyrics, section headers, band cues, inline notes, structure ribbon | Chord names, tabs, capo info | Larger lyric text, cleaner layout |
| **Acoustic Guitar** | Chords, lyrics, capo calculator, tabs | Piano voicings | Capo shapes prominently displayed |
| **Electric Guitar** | Chords, lyrics, tabs, inline notes | Capo (usually no capo) | Tab blocks highlighted |
| **Bass** | Chord roots / bass notes, lyrics, tabs | Full chord suffixes optional | Slash chord bass notes emphasized |
| **Keys / Piano** | Chords, lyrics, piano voicings (future) | Capo, tabs | Nashville numbers useful here |
| **Drums** | Section headers, band cues, structure ribbon, time signature, tempo | Chords, lyrics, tabs | Minimal view — just structure and dynamics |

### Role Selection
- **Onboarding**: First launch asks "What do you play?" with role
  icons. Sets the default profile.
- **Settings**: Change role anytime under Display settings.
- **Quick switch**: In chart view header, a small role icon lets you
  temporarily switch profiles (useful for multi-instrumentalists or
  worship leaders checking what their band sees).
- **Per-device**: Role is a device-level setting (stored locally).
  A worship leader's iPad shows full view, their guitarist's phone
  shows guitar view — even if syncing the same song library.

### Rendering Rules
```
function shouldShowChords(role) {
  return ['leader', 'acoustic', 'electric', 'bass', 'keys'].includes(role);
}

function shouldShowLyrics(role) {
  return role !== 'drums';
}

function shouldShowTabs(role) {
  return ['leader', 'acoustic', 'electric', 'bass'].includes(role);
}

function shouldShowCapo(role) {
  return ['leader', 'acoustic'].includes(role);
}

function getChordDisplay(role, chord) {
  if (role === 'bass') return extractBassNote(chord); // "Am/E" → "E"
  if (role === 'drums') return null;
  if (role === 'vocalist') return null;
  return chord; // full chord for everyone else
}
```

### Drummer View Detail
The drummer view is intentionally minimal:
```
┌─────────────────────────────┐
│ ♩ = 68  •  4/4              │  ← tempo + time sig prominent
│                             │
│ ● V1  ● V2  ● Pc  ● C     │  ← structure ribbon (main nav)
│ ● V3  ● Pc  ● C   ● B     │
│                             │
│ ▸ VERSE 1                   │
│   Keys & light acoustic     │  ← band cue (dynamics info)
│   8 bars                    │  ← bar count (future)
│                             │
│ ▸ PRE CHORUS                │
│   Add bass                  │
│   8 bars                    │
│                             │
│ ▸ CHORUS                    │
│   Full band                 │
│   8 bars                    │
│                             │
│ ▸ BRIDGE                    │
│   Build through repeats     │
│   ↑ Key change: E → F#     │  ← modulation marker
│   8 bars                    │
└─────────────────────────────┘
```

### Vocalist View Detail
Clean lyric sheet with section colors and structure:
```
┌─────────────────────────────┐
│ Build My Life               │
│ Key: E  •  68 BPM           │
│                             │
│ ▸ VERSE 1                   │
│   Worthy of every song      │  ← lyrics only, no chords above
│   we could ever sing        │
│   Worthy of all the praise  │
│   we could ever bring       │
│                             │
│ ▸ CHORUS                    │
│   I will build my life      │
│   upon Your love            │
│   It is a firm foundation   │
└─────────────────────────────┘
```

---

## 5.10 Onboarding & First Launch

### Flow
1. **Welcome screen**: "Setlists MD — Your songs, your way." with
   app logo and a "Get Started" button.
2. **Role selection**: "What do you play?" — grid of role icons
   (Worship Leader, Vocalist, Guitar, Bass, Keys, Drums). Tap to
   select. Can change later in Settings.
3. **Import prompt**: "Bring your songs"
   - "Import .md files" (for existing Setlists MD users)
   - "Import from ChordPro / OnSong / SongSelect"
   - "Start with demo songs" (loads 3 example songs)
   - "Start empty"
4. **Quick tour** (optional, skippable): 3-4 screens highlighting
   key features — library, editor tabs, setlist builder, live mode.
5. **Done**: Lands in Library view, ready to use.

### Returning Users (after data clear or new device)
If the user has cloud sync configured, the onboarding detects this
and offers: "Welcome back! Connect to Google Drive to restore your
songs?" This replaces steps 2-3 with a sync-and-restore flow.

---

## 5.11 Additional Product Considerations

### Accessibility
- **Screen reader support**: Semantic HTML, ARIA labels on all
  interactive elements. Chord charts should read as
  "[chord C] Worthy of [chord G] every song" not "[C]Worthy of..."
- **Color contrast**: All text meets WCAG AA contrast ratios (4.5:1
  for normal text, 3:1 for large text) in both dark and light themes
- **Touch targets**: Minimum 44×44px for all interactive elements
  (already specified for phone layout)
- **Keyboard navigation**: Full keyboard nav for desktop users —
  Tab through elements, Enter to activate, Escape to close popups
- **Reduced motion**: Respect `prefers-reduced-motion` media query
  for users who are sensitive to animations
- **Font scaling**: Respect system-level font size preferences

### Privacy & Trust
Setlists MD's privacy stance is a competitive advantage for churches:
- **No analytics tracking** — no Google Analytics, no Mixpanel,
  no telemetry. Optional: privacy-respecting analytics like Plausible
  (aggregate only, no individual tracking) if needed for product
  decisions.
- **No accounts required** — the app works fully without sign-up.
  Accounts only needed for cloud sync (v3+).
- **No data leaves the device** unless the user explicitly enables
  cloud sync to their own storage provider.
- **No ads, no upsells** — free forever for core features.
- **Open format** — songs are `.md` plain text. No lock-in. Ever.
- **Privacy page**: Simple, readable statement: "Your songs stay on
  your device. We never see, store, or process your content."

### PWA-to-Native Migration Path
The current PWA is the right choice for MVP — zero friction, works
everywhere, no app store review process. But native apps are the
long-term goal for:
- Reliable offline storage (Safari can evict IndexedDB)
- Background sync
- Native Bluetooth pedal pairing
- App Store discoverability
- Push notifications for setlist updates

**Migration strategy:**
- **Capacitor** (by Ionic) wraps the existing React app in a native
  shell. Minimal code changes. Same codebase for PWA + iOS + Android.
- The sync adapter architecture is platform-agnostic — works in
  both PWA and native contexts.
- Native-only features (background sync, push notifications) are
  added as Capacitor plugins, not core app changes.

### Print / Export
- **Print to PDF**: Single song or entire setlist as a formatted PDF.
  Uses the chart renderer's output, respecting current transpose,
  capo, and layout settings. Useful for guest musicians who don't
  have the app.
- **Export as .md**: Already implemented (single song + batch).
- **Export as ChordPro**: Convert .md → .cho for users migrating to
  other tools. Reciprocal of the import feature.

---

## 6. Bluetooth Pedal Support

Most Bluetooth foot pedals (Donner, Coda STOMP, AirTurn, PageFlip)
pair as Bluetooth keyboards and send standard key events.

### Default Key Mappings
| Action | Default Keys | Pedal Behavior |
|--------|-------------|----------------|
| Next song | ArrowRight, PageDown | Right pedal press |
| Previous song | ArrowLeft, PageUp | Left pedal press |
| Scroll down | ArrowDown | Right pedal hold (if supported) |
| Scroll up | ArrowUp | Left pedal hold (if supported) |

### Implementation
```js
useEffect(() => {
  const handler = (e) => {
    const map = {
      [settings.pedalNext]: () => goNextSong(),
      [settings.pedalPrev]: () => goPrevSong(),
      [settings.pedalScroll]: () => scrollDown(),
    };
    if (map[e.code]) {
      e.preventDefault();
      map[e.code]();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [settings]);
```

Mappings are configurable in Settings. A "detect pedal" button
listens for the next keypress and assigns it.

---

## 7. Capo Calculator

### Logic
Given a song key and a capo position, calculate the chord shapes
the guitarist actually plays:

```
Sounding key: Bb
Capo: 3
Shapes key: G  (Bb - 3 semitones = G)

Display: "Key: Bb · Capo 3 → G shapes"
```

All chords in the chart re-render as if in the shapes key.
So `[Bb]` displays as `[G]` with a capo indicator, `[F]` as `[D]`, etc.

### UI
- Small pill next to the key display in chart header
- Tap to cycle capo positions (0-7)
- Or tap to open a picker showing all capo options with resulting keys
- Capo setting can be saved per-song or per-setlist-item

### Common Worship Key Capo Reference
| Sounding Key | Capo | Shapes |
|-------------|------|--------|
| Ab | 1 | G |
| Bb | 1 | A, or 3 → G |
| B | 2 | A, or 4 → G |
| Db | 1 | C, or 4 → A |
| Eb | 1 | D, or 3 → C |
| F | 1 | E, or 3 → D |

---

## 8. Nashville Number System

### Conversion Logic
Given the song key (or transposed key), map each chord root to its
scale degree:

```
Key of A:
A=1, B=2, C#=3, D=4, E=5, F#=6, G#=7

So: [A] [D] [E] [F#m] → [1] [4] [5] [6m]
Slash chords: [A/C#] → [1/3]
```

### Display
Rendered in the same position as standard chords, same styling,
just numbers instead of letters. Chord suffixes preserved:
- `Bm` → `2m`
- `F#m7` → `6m7`
- `Dsus4` → `4sus4`
- `A/C#` → `1/3`

Toggle between Standard / Nashville in chart header or settings.

---

## 9. Setlist Sharing

### URL-Based Sharing (serverless)

1. Serialize setlist + embedded songs to JSON
2. Compress with lz-string (tiny library)
3. Base64url encode
4. Append to URL: `Setlists MD.app/share?d=<encoded>`

Recipient opens the link:
1. App decodes and decompresses
2. Shows preview: "Import setlist 'Sunday Morning' with 5 songs?"
3. User confirms → songs and setlist added to their library
4. Songs that already exist (matched by title+artist) are skipped

### QR Code
Same URL rendered as QR using a library like `qrcode-generator`.
Worship leader shows QR on their screen, band members scan with
their phone/tablet camera, app opens with the import prompt.

### Size Considerations
A typical 5-song setlist with full song data compresses to ~3-5KB
encoded. Well within URL length limits for most platforms. For very
large setlists (15+ songs), fall back to a file-based share
(.json export/import).

### Current Implementation
Setlist export/import as `.zip` files (songs as individual `.md` +
`_setlist.json` manifest). Song matching by title+artist on import
to avoid duplicates.

---

## 9b. Sync & Storage Architecture

### Design Philosophy
1. **User owns their files** — songs are `.md`, setlists are `.json`,
   stored in the user's own cloud storage. Setlists MD never hosts content.
2. **Legal safety** — CCLI licenses cover churches, not software providers.
   By never storing lyrics on our servers, we avoid being a distributor
   of copyrighted material.
3. **Provider-agnostic** — a clean adapter interface lets users choose
   their preferred cloud (Google Drive, Dropbox, OneDrive, self-hosted).
4. **Offline-first** — all data lives locally in IndexedDB. Cloud sync
   is an enhancement, not a requirement. The app works fully offline.
5. **Portable across platforms** — the same sync architecture works for
   the PWA today and native iOS/Android apps in the future.

### Cloud File Layout
```
Setlists MD/                        ← root folder in user's cloud
├── songs/
│   ├── build-my-life.md           ← one .md file per song
│   ├── shelter-of-the-most-high.md
│   └── the-kingdom-stands.md
├── setlists/
│   ├── sunday-morning-2026-03-30.json
│   └── good-friday-2026-04-18.json
└── settings.json                  ← user preferences
```

Song filenames derived from `slugify(title)` with collision handling.
Setlist JSON includes embedded song IDs (not full songs — songs are
resolved by matching title+artist from the `songs/` folder).

### Sync Adapter Interface
Provider-agnostic abstraction. Each cloud provider implements this:

```js
// src/sync/adapter.js
class SyncAdapter {
  async listFiles(folder)        // → [{name, path, modifiedAt}]
  async readFile(path)           // → string (file content)
  async writeFile(path, content) // → void
  async deleteFile(path)         // → void
  async getMetadata(path)        // → {modifiedAt, size}
}
```

### Provider Implementations

| Phase | Provider | Auth | API | Notes |
|-------|----------|------|-----|-------|
| 1 | **Google Drive** | OAuth 2.0 (browser) | REST API | 15GB free. Biggest user base. Folder sharing = team collab. |
| 2 | **Dropbox** | OAuth 2.0 | REST API | 2GB free. Good API, widely used. |
| 2 | **OneDrive** | OAuth 2.0 (MSAL) | Microsoft Graph | 5GB free. Every Windows/Office user has it. |
| 3 | **WebDAV** | Basic/token auth | Open protocol | Nextcloud, Synology, ownCloud self-hosters. |
| 4 | **Setlists MD Sync** (optional) | Email + password | Custom API | Encrypted relay — client-side AES-256, server stores blobs only. Zero-knowledge. Seamless UX, no third-party OAuth. Potential paid tier ($4-8/mo). |

### Sync Engine
The sync engine is provider-agnostic. It calls the adapter and handles:

1. **On app open**: Pull remote file list → compare `modifiedAt` vs local
   `updatedAt` → download newer remote files, upload newer local files
2. **On save**: Write to local IndexedDB immediately, queue a push to
   remote (debounced, batched)
3. **Periodic sync**: Every 5 minutes when online
4. **Conflict resolution**: Last-write-wins by timestamp (simple, works
   for small teams). Optional: prompt user on conflicts ("Remote version
   is newer — keep local, keep remote, or merge?")
5. **Offline queue**: Changes made offline are queued and pushed when
   connectivity returns

```js
// Sync flow pseudocode
async function sync(adapter) {
  const remoteFiles = await adapter.listFiles('songs/');
  const localSongs = await loadSongs();

  for (const remote of remoteFiles) {
    const local = localSongs.find(matchByFilename(remote));
    if (!local) {
      // New remote song → import
      const md = await adapter.readFile(remote.path);
      await importSong(parseSongMd(md));
    } else if (remote.modifiedAt > local.updatedAt) {
      // Remote is newer → pull
      const md = await adapter.readFile(remote.path);
      await updateSong(local.id, parseSongMd(md));
    }
  }

  for (const local of localSongs) {
    const remote = remoteFiles.find(matchByFilename(local));
    if (!remote || local.updatedAt > remote.modifiedAt) {
      // Local is newer or new → push
      await adapter.writeFile(songPath(local), songToMd(local));
    }
  }
}
```

### Collaboration Model
Team collaboration works through cloud storage's native sharing:

1. **Worship leader** connects Google Drive (or Dropbox, etc.)
2. **Shares the `Setlists MD/` folder** with band members via Drive/Dropbox
3. **Band members** connect their Setlists MD to the same shared folder
4. Everyone sees the same songs and setlists, synced via the cloud
5. Any member can add/edit songs — changes propagate to all via sync

This is the same model Obsidian uses for team vaults. No custom
collaboration server needed.

### Future: Real-Time Sync
For live rehearsal sync (leader changes key → everyone updates),
a WebSocket relay (Supabase Realtime or similar) could layer on top:
- Ephemeral session, not persistent storage
- Leader broadcasts transpose/key/setlist changes
- Band members' apps subscribe and update in real-time
- No lyrics stored on the relay — just event payloads like
  `{action: "transpose", songId: "abc", value: 2}`

This is a v3+ feature requiring auth and a lightweight server.

### Settings UI (future)
```
SYNC
  ○ Off (local only)
  ● Google Drive  [Connected as daniel@...]  [Disconnect]
  ○ Dropbox
  ○ OneDrive
  ○ WebDAV (self-hosted)

  Last synced: 2 minutes ago
  [Sync Now]
```

---

## 10. Modulation Support ✅

### Format
```markdown
## Chorus 3
{modulate: +1}
[Bb]I will build my [F]life upon Your love
```

### Implementation (done)
1. **Parser** (`parser.js`): `{modulate: +N}` lines parsed into `{ type: 'modulate', semitones: N }` objects in `section.lines[]`. Round-trip serialization in `songToMd()`.
2. **ChartView**: Pre-computes `sectionModOffsets` array — cumulative modulate total from all prior sections. Passes `modulateOffset` prop to each `SectionBlock`. Chord diagram collection accounts for modulate offsets.
3. **SectionBlock**: Tracks running modulate within the section. Chords after a marker use `transpose + modulateOffset + runningModulate`. Renders "Key Change: +N" badge with accent-colored dashed borders at each marker.
4. **Multiple modulations stack**: Base key: A, user transpose: +2 → C, section with `{modulate: +1}` → C# (all add up). Offsets accumulate across sections.
5. **FormTab**: Modulate objects serialized alongside tab objects in `parseInitialSections` for round-trip fidelity.

### UI Behavior (future enhancements)
- In the structure ribbon, modulated sections show a small
  arrow indicator
- The key display in the header updates as you scroll past
  a modulation point
- Capo calculator recalculates for the new sounding key

---

## 11. Responsive & Device-Specific Behavior

### Tablet Landscape (Primary Performance Mode)
- 2-column layout
- Structure ribbon fully visible
- Controls in sticky header
- Optimized for iPad on mic stand
- Full-screen PWA (no browser chrome)

### Tablet Portrait
- 1-column layout
- Structure ribbon scrollable
- Larger vertical spacing
- Good for "music stand" orientation

### Phone
- 1-column forced
- Larger chord text (15px → 16px)
- Larger touch targets (min 44px)
- Structure ribbon horizontally scrollable
- Simplified controls (transpose and capo in a bottom sheet)
- Primarily for practice/prep at home

### Desktop
- 2-column with wider margins
- Full keyboard shortcuts
- Primarily for editing and setlist building

### CSS Strategy
```css
/* Auto-detect orientation */
@media (orientation: landscape) and (min-width: 768px) {
  .chart-body { grid-template-columns: 1fr 1fr; }
}

@media (orientation: portrait), (max-width: 767px) {
  .chart-body { grid-template-columns: 1fr; }
}

/* Phone-specific */
@media (max-width: 639px) {
  .chord-token { font-size: 14px; }
  .lyric-text { font-size: 16px; }
  button { min-height: 44px; }
  .structure-ribbon { overflow-x: auto; flex-wrap: nowrap; }
}
```

---

## 12. Roadmap

### v1 — Core App ✅
- [x] Song library with search
- [x] Chart renderer with section blocks
- [x] Transpose engine
- [x] 1/2 column layout toggle
- [x] Font size toggle
- [x] Markdown editor with preview
- [x] .md import/export
- [x] Setlist builder (add, reorder, per-song transpose)
- [x] Setlist player with song navigation
- [x] Persistent storage (IndexedDB)
- [x] PWA manifest + service worker
- [x] Deploy to Vercel
- [x] Install on tablet

### v1.5 — Essential Performance Features (mostly done)
- [x] Settings tab with persistence
- [x] Bluetooth pedal support (keyboard event listener)
- [x] Capo calculator with shapes display
- [ ] Nashville number system toggle
- [x] Setlist export/import as .zip (songs as .md + manifest)
- [ ] Setlist sharing via URL/QR code
- [x] Auto-responsive layout (orientation detection)
- [x] Phone-optimized layout
- [x] Dark/light theme toggle
- [x] Sort options (title, artist, key, newest)
- [x] Key selector dropdown in setlist builder (replaces +/- semitone)
- [x] Auto-scroll song strip in live player
- [x] Setlist overview (read-only preview with export/edit/live)
- [x] Per-song capo in setlists
- [x] Break items in setlists (non-song items with label/duration)
- [x] Visual Editor toolbar (chord picker, section inserter,
      band cue, inline note, modulation, tab block, metadata
      form — all inserting correct syntax into the textarea)
- [x] Form Editor mode (structured section-by-section song
      builder with no markdown visible)
- [x] Raw Editor with collapsible syntax reference
- [x] Split-screen editor preview (side-by-side on tablet/desktop)
- [x] Editor features: undo/redo, clipboard import, char/section count
- [x] Parser extra fields (tags, spotify, youtube, capo, notes)

### v2 — Professional Features
- [ ] Instrument role profiles (vocalist, guitar, bass, keys, drums views)
- [x] Onboarding flow (welcome screen, 4-step tour, import prompt)
- [ ] Smart import: ChordPro (`.cho`, `.chordpro`)
- [ ] Smart import: SongSelect (`.usr`)
- [ ] Smart import: OnSong (`.onsong`)
- [ ] Smart import: plain text (chord-above-lyrics detection)
- [ ] Smart import: `.docx` (Word)
- [ ] Smart import: OpenSong (`.xml`)
- [ ] Import conversion preview before saving
- [ ] Rehearsal vs Live mode (separate sub-modes)
- [ ] Inline notes {!note} syntax and rendering
- [x] Modulation markers {modulate: +N} parsing, rendering, cumulative stacking, key-change badges
- [ ] Duplicate section handling (full/compact/first-chords-only)
- [ ] Chords-only and lyrics-only display modes
- [ ] Nashville number system toggle
- [ ] Auto-scroll / teleprompter
- [ ] Song tags and filtering
- [ ] Per-song notes/annotations
- [ ] Spotify/YouTube link field + play button
- [ ] Setlist sharing via URL/QR code
- [ ] Print single song / setlist to PDF
- [ ] Export as ChordPro (`.cho`) for interoperability
- [ ] i18n foundation — translation hook + English base file
- [ ] Spanish (es) and Portuguese (pt) translations
- [ ] Auto-detect browser language on first launch

### v2.5 — Advanced Features
- [x] Tab block parsing — `{tab}...{/tab}` blocks parsed into structured objects with string/fret data; round-trip ASCII serialization
- [x] Tab block SVG renderer — clean SVG with string lines, fret numbers (gold), bar lines, technique markers (h/p/s/b/x)
- [x] Tab grid editor — interactive grid with duration picker (whole/half/quarter/8th/16th/dotted), auto-advance cursor, chord mode, technique buttons, add/remove measures
- [x] Tab insert in Visual editor — toolbar "Tab Block" button opens grid editor
- [x] Tab insert in Form editor — "+ Tab" button per section opens grid editor
- [x] Tab editing — edit existing tab blocks visually: VisualTab detects cursor inside `{tab}...{/tab}` to open pre-loaded grid editor; FormTab shows "Edit Tab" buttons per block; saves replace in-place
- [x] Chord diagrams — svguitar (MIT) renders fingering charts for ~50 worship chords; "Diagrams" toggle in ChartView shows strip of all song chords
- [ ] Drummer view: bar counts, dynamics-only layout
- [ ] Piano chord voicing reference
- [ ] Bass view: root/bass note emphasis
- [ ] Quick role switcher in chart header
- [ ] Song usage history / "last played" tracking
- [ ] Key compatibility checker in setlist builder
- [ ] PDF text extraction import (best-effort)
- [ ] Section loop for rehearsal
- [ ] Quick-key switcher
- [ ] Drag-and-drop setlist reordering
- [ ] Accessibility: screen reader, ARIA labels, keyboard nav
- [ ] WCAG AA color contrast audit

### v3 — Cloud Sync & Collaboration
- [x] Sync adapter interface (provider-agnostic abstraction)
- [x] Google Drive sync (OAuth + folder-based .md read/write)
- [x] Sync engine: timestamp comparison, conflict handling, deletion sync
- [x] Sync UI: SyncSettings panel, SyncStatus pill, connect/disconnect
- [x] Songs + setlists sync (individual files in Setlists MD/Songs/ and Setlists MD/Setlists/)
- [x] Startup sync + visibility-change sync + debounced push on save
- [ ] Settings sync across devices
- [x] Dropbox sync adapter (implemented, needs client ID to activate)
- [x] OneDrive sync adapter (implemented, needs client ID to activate)
- [ ] WebDAV sync adapter (Nextcloud, Synology, self-hosted)
- [ ] Team collaboration via shared cloud folders
- [ ] Real-time session sync (Supabase Realtime — ephemeral, no lyrics stored)
- [ ] Image/OCR import for scanned charts
- [ ] CCLI SongSelect integration (API)
- [ ] Additional languages: Korean, French, Indonesian, Chinese,
      Tagalog, German, Swahili
- [ ] Localized section name display (optional toggle)
- [ ] Community translation contribution workflow (GitHub PRs)
- [ ] RTL layout support (Arabic, Farsi, Hebrew)

### v4 — Native Apps
- [ ] React Native or Capacitor wrapper for iOS/Android
- [ ] Native file system access (persistent .md storage)
- [ ] Background sync (not limited by browser/PWA constraints)
- [ ] Native Bluetooth pedal pairing (more reliable than Web Bluetooth)
- [ ] Push notifications for setlist updates
- [ ] Offline-first with native SQLite (faster than IndexedDB)
- [ ] App Store / Google Play distribution
- [ ] Optional: Setlists MD Sync — encrypted relay service
      (client-side AES-256, server stores blobs only, zero-knowledge,
      seamless UX, potential paid tier $4-8/mo)

---

## 13. Competitive Positioning

| Feature | Setlists MD | OnSong | Music Stand (PCO) | Charts (WorshipTools) |
|---------|-----------|--------|-------------------|----------------------|
| Price | Free | $29.99 | Free (with PCO) | Free |
| Offline | Full | Full | Partial | Partial |
| Own your data | .md files | Locked in | Locked in | Locked in |
| Transpose | Yes | Yes | Yes | Yes |
| Nashville numbers | Yes (v1.5) | Yes | No | No |
| Capo calculator | Yes (v1.5) | Yes | No | No |
| Modulation support | Yes (v2) | No | No | No |
| Inline notes | Yes (v2) | No | No | No |
| Bluetooth pedal | Yes (v1.5) | Yes | No | No |
| Setlist sharing | QR/link (v1.5) | Cloud sync | PCO integration | Cloud sync |
| Smart import | txt/docx/pdf (v2) | ChordPro/PDF | SongSelect | SongSelect |
| Rehearsal/Live modes | Yes (v2) | No | No | No |
| Platform | PWA (any device) | iOS only | iOS + Android | iOS + Android + Web |
| Requires | Nothing | iPad | PCO subscription | Internet |
| Backing tracks | No | Yes | No | Via Loop Community |
| Multilingual UI | 10+ languages (v2) | English only | Limited | Limited |

### Setlists MD's Unique Advantages
1. **Data portability** — songs are .md plain text, not locked in
2. **Zero cost, zero infrastructure** — no subscriptions, no accounts
3. **Works everywhere** — PWA runs on any device with a browser
4. **Modulation support** — no other free tool handles mid-song key changes
5. **Inline performance notes** — per-line cues, not just per-section
6. **Rehearsal/Live split** — purpose-built modes for each context
7. **Multilingual UI** — fully translated interface for global worship teams

---

## 14. Internationalization (i18n)

### Scope
i18n applies to all **UI elements** — buttons, labels, headers, menus,
tooltips, error messages, settings, and editor toolbar labels. Song
content (lyrics, chords, section names, notes) is **never translated**
— that stays in whatever language the user wrote it in.

### Architecture

#### Translation file structure
```
src/
  i18n/
    index.js          ← language loader + hook
    en.json           ← English (default/fallback)
    es.json           ← Spanish
    pt.json           ← Portuguese
    fr.json           ← French
    de.json           ← German
    ko.json           ← Korean
    zh.json           ← Chinese (Simplified)
    id.json           ← Indonesian
    tl.json           ← Tagalog/Filipino
    sw.json           ← Swahili
```

#### Translation file format
Flat key-value JSON with dot-notation grouping:

```json
{
  "app.name": "Setlists MD",
  "library.title": "Library",
  "library.songs": "Songs",
  "library.setlists": "Setlists",
  "library.search": "Search songs, artists, keys...",
  "library.noSongs": "No songs yet. Import .md files or create a new song.",
  "library.noResults": "No songs match your search.",
  "library.songCount": "{count} song | {count} songs",
  "library.import": "Import",
  "library.export": "Export",
  "library.exportAll": "All .md",
  "library.newSong": "New Song",
  "library.newSetlist": "New Setlist",

  "chart.transpose": "Transpose",
  "chart.layout": "Layout",
  "chart.size": "Size",
  "chart.key": "Key",
  "chart.bpm": "BPM",
  "chart.time": "Time",
  "chart.capo": "Capo",
  "chart.shapes": "shapes",
  "chart.edit": "Edit",
  "chart.back": "Back",

  "editor.newSong": "New Song",
  "editor.editSong": "Edit Song",
  "editor.save": "Save",
  "editor.delete": "Delete",
  "editor.deleteConfirm": "Delete this song?",
  "editor.visual": "Visual",
  "editor.form": "Form",
  "editor.raw": "Raw",
  "editor.preview": "Preview",
  "editor.toolbar.chord": "Chord",
  "editor.toolbar.section": "Section",
  "editor.toolbar.cue": "Band Cue",
  "editor.toolbar.note": "Inline Note",
  "editor.toolbar.modulate": "Modulate",
  "editor.toolbar.tab": "Tab Block",
  "editor.toolbar.metadata": "Song Info",

  "setlist.name": "Setlist Name",
  "setlist.date": "Date",
  "setlist.service": "Service",
  "setlist.morning": "Morning",
  "setlist.evening": "Evening",
  "setlist.special": "Special",
  "setlist.addSong": "Add Song",
  "setlist.songs": "Songs",
  "setlist.live": "Live",
  "setlist.rehearsal": "Rehearsal",
  "setlist.share": "Share",
  "setlist.estDuration": "~{min} min est.",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.display": "Display",
  "settings.chords": "Chords",
  "settings.performance": "Performance",
  "settings.pedal": "Pedal Mapping",
  "settings.data": "Data",
  "settings.about": "About",
  "settings.theme": "Theme",
  "settings.dark": "Dark",
  "settings.light": "Light",
  "settings.columns": "Columns",
  "settings.auto": "Auto",

  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.loading": "Loading Setlists MD..."
}
```

#### React hook implementation
```jsx
// src/i18n/index.js
import en from './en.json';

const translations = { en };

// Lazy-load other languages on demand
async function loadLanguage(lang) {
  if (!translations[lang]) {
    translations[lang] = await import(`./${lang}.json`);
  }
  return translations[lang];
}

// Hook usage in components:
// const t = useTranslation();
// <span>{t('chart.transpose')}</span>
// <span>{t('library.songCount', { count: songs.length })}</span>
```

#### Pluralization
Use simple template syntax with `|` separator:
```json
"library.songCount": "{count} song | {count} songs"
```
The `t()` function checks if count === 1 and returns the left or
right side accordingly.

### Priority Languages
Based on global worship community size:

| Priority | Language | Code | Reason |
|----------|----------|------|--------|
| 1 | English | en | Default, largest worship music market |
| 2 | Spanish | es | Latin America + Spain — massive worship scene |
| 3 | Portuguese | pt | Brazil — huge worship community (Hillsong BR, etc.) |
| 4 | Korean | ko | South Korea — very active worship culture |
| 5 | French | fr | West/Central Africa + France + Canada |
| 6 | Indonesian | id | Indonesia — largest Muslim country but significant Christian minority with active worship |
| 7 | Chinese (Simplified) | zh | China underground church + Taiwan + diaspora |
| 8 | Tagalog | tl | Philippines — very large worship community |
| 9 | German | de | Germany + Austria + Switzerland |
| 10 | Swahili | sw | East Africa |

### What Gets Translated vs What Doesn't

| Translated (UI) | NOT translated (content) |
|-----------------|-------------------------|
| Button labels | Song lyrics |
| Menu items | Chord names (always A-G) |
| Headers & titles | Section names (## Verse 1) |
| Placeholder text | Band cues & inline notes |
| Error messages | YAML frontmatter values |
| Settings labels | Nashville numbers |
| Tooltips | Tab notation |
| Format hints in editor | |

### Section Name Localization (optional, v3)
Section type labels like "Verse," "Chorus," "Bridge" could optionally
render in the UI language while the `.md` file keeps them in English:
- File: `## Verse 1` → Display: `## Estrofa 1` (Spanish)
- File: `## Chorus` → Display: `## Refrão` (Portuguese)

This is a display-only mapping — the `.md` format stays in English
for portability. A shared `.md` file works across languages because
the section types are always stored in English. This is optional and
can be toggled in settings (some bilingual teams prefer English
section names).

### RTL Support (future consideration)
Arabic, Farsi, and Hebrew worship communities exist but are smaller.
RTL layout support would require CSS `direction: rtl` on the chart
body, mirrored column order, and right-aligned chord tokens. This is
a v3+ consideration.

### Implementation Notes
- Default language auto-detected from `navigator.language`
- User can override in Settings
- Language preference stored in IndexedDB (UserSettings.language)
- Translation files are small (~2-4KB each), lazy-loaded
- Fallback chain: user language → English
- Community contributions: translation files are simple JSON,
  easy for bilingual worship leaders to contribute via GitHub PR

---

## 15. File & Format Quick Reference Card

```
FRONTMATTER           SECTIONS              INLINE
─────────────         ──────────            ──────
---                   ## Verse 1            [Chord]lyrics
title: Song Name      > Band cue note       {!inline note}
artist: Artist        [A]Lyrics [D]here     {modulate: +1}
key: A                                      {tab}...{/tab}
tempo: 120            ## Chorus
time: 4/4             > Full band
tags: [slow, modern]  [D]Chorus [A]here
---
```

