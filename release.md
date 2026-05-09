# Release notes

Versioning follows **Semantic Versioning 2.0.0** (https://semver.org).
The single source of truth is `package.json#version`; the UI reads the
build-time global `__APP_VERSION__` (see `vite.config.js`'s `define`),
so a version bump in `package.json` plus a build is enough to update
the Settings hub and About card.

---

## 0.0.2-pre-alpha

### Setlist builder

- **Save lives at the bottom now.** The previous top-right Save button
  has been replaced with a sticky frosted bottom bar that pairs `Cancel`
  with `Save` — the standard form pattern, always thumb-reachable on
  tablets/phones. The bar uses `position: sticky` so it pins to the
  bottom of the main content area on desktop instead of running under
  the sidebar. Mobile is unaffected.
- **No more back chevron in the header.** Cancel covers the bail-out
  path; Delete and Roster keep their slots in the header right.
- **Sticky song picker on desktop.** The right-hand library column
  pins below the page header (`lg:sticky top-20`) so it stays in view
  while the user scrolls a long set on the left. Capped at
  `calc(100vh - 11rem)` so it never collides with the bottom bar.
- **Duplicate songs allowed.** The picker no longer blocks re-adding
  a song that's already in the set. Worship sets reprise songs all
  the time (open and close on the same chorus). Each row that's
  already in the set shows a small `×N` count badge in brand color;
  tapping it again appends another instance to the end. Each instance
  has its own transpose / capo / note.
- **Custom DatePicker** (`src/components/ui/DatePicker.jsx`) replaces
  the native `<input type="date">`, which was OS-locale-driven and
  ignored the new `firstDayOfWeek` setting. Mirrors the schedule grid:
  6×7 month, prev/next chevrons, Today shortcut, weekday header
  reordered to the user's chosen first day.
- **Custom TimePicker** (`src/components/ui/TimePicker.jsx`) replaces
  `<input type="time">` for the same reason — native pickers follow OS
  locale, not the app's `clockFormat`. Renders as button + popover
  with an hour select, a minute select (5-minute steps), and an AM/PM
  segmented toggle when `clockFormat === '12h'`. Underlying value is
  always 24-hour `HH:MM`.
- **New setlists default to next Sunday at 10:00.** Most-common
  worship slot, via a shared `nextSundayDateStr()` helper.
- **Tag input commits on space and Enter.** Backspace still pops the
  last chip when the input is empty.
- **Per-song setlist note capped at 100 characters** with a live
  `n/100` counter that turns red at the cap.

### Setlist viewer / cards

- **No "Live Show" placeholder chip when a setlist has no tags.** The
  whole tag row hides instead of pretending the setlist is tagged.
- **Notes wrap inside the row.** Long unbroken tokens no longer punch
  outside the card (`break-words` next to the existing
  `whitespace-pre-wrap`).
- **Time formatting respects `clockFormat`.** Setlist cards, the
  setlist overview header, the dashboard, and the schedule list all
  go through a single `formatClockTime(value, clockFormat)` helper
  (`src/lib/dateFormat.js`) so the same setlist's time reads
  identically everywhere.

### Practice / Live finale screens

- **New finale views** for both Practice (`PracticeFinale`) and Live
  (`LiveFinale`). Each session view (`PracticeView`, `SetlistPlayer`,
  `PerformanceView`) tracks duration / farthest-index / transpose
  count / cue count and hands those metrics to the matching finale.
- **"Finish" CTA replaces the disabled Next arrow** on the last song
  in the floating nav pill (Practice, Performance) and the chart
  header nav (SetlistPlayer). Same neutral chrome as the surrounding
  buttons.
- **Practice finale**: stat tiles (time / songs / key changes / cues),
  a "What changed today" list driven by a touched-songs set, and a
  "For the band" reflection textarea persisted to
  `setlist.practiceNote`.
- **Live finale**: stat tiles (time / songs / breaks), a
  team-roster acknowledgement card (only renders when the team plan
  has scheduled rows for this setlist), and a "How did it feel?"
  textarea persisted to `setlist.serviceNote`.
- **CTAs**: View setlist · Run it again · Home. "Run it again" knows
  whether the session came from the Performance view or the Player
  and returns to the same one with `replace: true`.
- **No back chevron, no `useWakeLock`.** The finale is post-session.

### Live & Practice headers

- **Close X on the right replaces the back arrow on the left** in
  PracticeView, PerformanceView, and SetlistPlayer.
- **Collapse chevron lives in the title row** alongside the X. When
  collapsed, the title + meta + Practice badge tuck away and the
  chevron + X drop into the structure-ribbon row so the header
  occupies a single slim strip instead of leaving an empty bar.
- **Font-size and column popovers removed** from Practice and
  Performance — both views now consume `defaultFontSize` /
  `defaultColumns` from settings, the same source ChartView uses.
- **Frosted glass actually frosts now.** Lightning CSS was dropping
  the unprefixed `backdrop-filter` declaration during dedupe and only
  keeping `-webkit-backdrop-filter`, which Firefox / Zen / non-WebKit
  engines ignore. Filter is now set inline via `headerFrostStyle`
  (`src/lib/headerFrost.js`), bypassing the bundler.

### Break notes

- **Break items can carry a free-form note**, edited inline in the
  builder and surfaced in the song-notes peek strip on the chart.
- **Note rendering** uses a small `NoteContent` helper that lights up
  one-line H1s and renders the rest as paragraphs with a subtle
  styled card on Practice / Live / Performance break screens.

### New settings (Appearance)

- **First day of the week** — Sunday or Monday. Reorders the schedule
  month grid header and walks the 6×7 grid back to the correct
  leading day. Applies to the new builder DatePicker as well.
- **Clock format** — 12-hour or 24-hour. Drives `formatClockTime`
  across cards, overview, dashboard, schedule, and the new
  TimePicker.
- Both keys are wired through `PORTABLE_PREF_KEYS` so they sync
  across devices once the user is signed in.

### Versioning

- **SemVer adopted.** `package.json#version` is the single source of
  truth; Vite injects it as `__APP_VERSION__` at build time. The
  Settings hub row and About card both render `v${__APP_VERSION__}`.
  ESLint declares the global as readonly. CLAUDE.md picks up a new
  "Versioning" section.

---

## 0.0.1-pre-alpha

Initial pre-alpha tag. Adopts SemVer; everything before this commit
shipped without a tracked version (`package.json` was at `0.0.2`
internally while the UI displayed a stale `v1.2.0`). This release
resyncs the version string with the project's actual maturity.
