# Reading & playback views — product vision (captured 2026)

> Source: a long Q&A with the user (the product owner). This is the **single
> source of truth for what each reading/playback surface should be**. It feeds
> `docs/PLAN.md` §4 ("Modes & playback" / "Reading-view model"). Decisions here
> are the intent; build order + the per-preset control allow-lists come later.

## The model — 3 surfaces, tools layered (NOT 4 forks)

- **Chart = the Song Hub** (library default, single song). "The song opens in the
  app with some special features." A worship leader can inspect a song easily and
  see what it needs; a casual user can just tap a song and play.
- **Live** = the **main** performance surface. Distraction-free, focused on the
  song. Campfire is a single-song flavour of Live.
- **Rehearsal** = band practice. Its **own entry point**, Live-like but with edit
  /structure unlocked and changes pushed to members.
- **Practice** = **tools layered on top of Chart** (metronome, loop, slow-down,
  log minutes) — not its own forked surface. Per-song *and* per-setlist.

Both **Live and Rehearsal need an "emergency customize" button** (escape hatch to
tweak the layout mid-use).

## Cross-cutting decisions (apply to all surfaces)

- **Per-device:** columns (1 on phone, 2 on tablet/desktop, user can change) and
  **font size**. Notation/display prefs are **global, set-once**.
- **Notation** (letters/Nashville/solfège): default **Letters**, **per-user not
  per-instrument**, changed **in a menu** (set-and-forget, not a header tap).
- **Chord diagrams: OFF** by default. Instead: **tap a chord to see its diagram**,
  plus a way to **show all** the song's diagrams on demand.
- **Tabs: OFF** by default; show for the **electric-guitar** player / make
  show-hide easy. Tabs prominent in Rehearsal for the electric player.
- **Capo:** **concert pitch** by default (app isn't guitar-only). Exception: show
  **capo shapes for the guitarist's own instrument** in Live/Rehearsal.
- **Transpose:** a **one-tap header control** (someone may start a song here and
  transpose). _Open Q:_ if a **non-leader** changes the key, prompt to **save
  before leaving**? In Live a key change is an **emergency, temporary, not saved**.
- **Theme:** the chart follows the **chart theme** (for now) — the
  app-theme-vs-chart-theme conflict (white chart at night, etc.) is unresolved.
- **Display persistence:** use **global** defaults for now (key/columns). Revisit
  per-song memory only if needed.
- **Structure ribbon:** keep it **as in the hub today** (static codes) — the user
  likes it. Allow customization to hide it.
- **Metronome:** good to have in **Chart** and **Practice**; **maybe** Rehearsal.
- **Notes:** **peek-on-demand under one button**; show **shared/"main" notes +
  my private notes**.
- **Print/PDF:** Chart is the entry point for **that one song**.
- **Foot-pedal:** support it, and **expose pedal settings in Settings** (missing
  today). Navigation: **pill is default**; edge-arrows, swipe, pedal are options.

## I. Chart (single-song reader)

- One job: **read + quick reference + a launchpad** to edit/play.
- **Strictly one song** — never setlist context. (Campfire can later start an
  ad-hoc set with an in-mode **search bar** to add songs.)
- Practice **can start from Chart**, but only for that one song (a setlist
  practice wouldn't open each song individually).
- A **lyrics-only "Song Map"** is wanted.
- Editing: **jump to the editor** (prevent accidental changes); inline is a maybe.
- Auto-scroll hands-free: maybe (low priority).

## II. Live (performance — locked down)

- **Always on screen:** chords, key, time sig, BPM, a way to change key,
  structure, clock, next/prev. Header is a **super-minimal strip** (key/BPM/time).
- **No editing** beyond an **emergency, non-persistent key change** (e.g. pianist
  forgot to transpose). Chord diagrams **hidden**. Default **2 columns** (changeable).
- **Section structure shown** (allow hiding).
- **Setlist rail default** on tablet; **needs a mobile + tablet-portrait solution**.
- **Breaks** render as a **full-screen "Break — 10 min" slide**.
- **Wake-lock** only if the user enables it in Settings.
- **Clock / countdown-to-end** — nice, maybe in the setlist rail.
- **Auto-advance (big feature):** **multi-user synced** — one person swipes →
  everyone advances; others can still override their own view (go back/forward).
- **Next-song preview** (desktop/tablet): at the end of a song, show the **next
  song's key + first line**. Mobile may not have room.
- **Notes:** shared/main + mine. **Capo shapes** for the guitarist.
- **Exit:** **confirm before exiting** mid-service. Mobile: a **pull top→bottom
  "pull-to-exit" gesture** (red affordance, like Telegram archive / IG pull).
- Campfire = **Live + extras + a different ending** (no "you played X songs / X
  minutes" feedback).
- Verdict: **Live is the main view** — distraction-free, song-focused.

## III. Rehearsal (band practice — max control)

- **Always tied to a setlist.** Own **entry point** (not just a toggle).
- Most-tweaked: **key, chords, structure, notes** — **edit on the fly** (happens
  often). **Push changes live** to members' devices.
- **Per-member private notes** (only the author sees them).
- **Quick transpose** for different vocalists. Default **2 columns** (per device).
- **Tabs prominent** for the electric player.
- A **"just-in-case" extra-songs section** on the setlist (candidates to swap in
  if one or two don't work).
- **Compare all arrangements side-by-side** — _note it down, interesting._
- Section loop / metronome / tempo-nudge: **lower priority here** (more for
  Practice); metronome maybe useful if a player routes a laptop to in-ears.
- Roster/who's-scheduled: **not needed** here.
- **Entry-point timing idea:** if it's early in the week / **>30 min before** the
  service → show a **Rehearsal** button (**long-press → Live**). **<30 min** →
  show the **Live** button.

## IV. Practice (solo, at-home)

- **Tools layered on Chart** (not a real surface). **Per-song and per-setlist.**
  Reachable **from a song and from setlists**.
- Core: **metronome, loop (later), slow-down = actual audio, count-in**.
- **Auto-log practice minutes** → **dashboard streak + time widget** (future:
  practice tips/materials).
- **Remember where you left off.** **Lyrics-only memorization** mode; hide-chords
  to test memory (later). Per-song confidence (later).
- **Suggest what to practice** (upcoming setlist).
- Backing tracks (future): per-instrument stems (electric/bass/voices). For now:
  **click + Spotify/YouTube/Apple** if possible.
- **Offline** nice-to-have. **Gamify** (later). **Record yourself** only if
  **one-time** (no long-term storage budget).
- **Post-launch**, with some features brought earlier.

## Things the user asked me to explain / decide

- **"Save changes back to the song/arrangement"** — in Rehearsal, edits could
  either be (a) temporary for the session, or (b) written back to the stored
  song/arrangement so they persist. Decision: persist when a leader/editor makes
  them; keep emergency key changes temporary.
- **"We worked on this" status** — a per-song rehearsal flag (e.g. ✓ rehearsed /
  needs-work) so the band sees what's been covered. _Deferred._
- **Session agenda / countdown** — a rehearsal running-order with a timer per song
  to keep practice on schedule. _Deferred._
- **Setlist lifecycle / end-time** — add an optional **end time** (e.g. 10–12) so a
  setlist stays in "Upcoming"/on the dashboard until it actually ends, instead of
  dropping to "Past" at start-time and becoming hard to find mid-service.
  _Recommend: add `start`/`end` (or a duration) and treat a set as "today/active"
  through its end time._
- **Wake-lock in PWA** — the Screen Wake Lock API **does work in installed PWAs**
  on modern browsers (iOS Safari 16.4+, Android Chrome), not native-only.

## Misc UI notes
- **Campfire button** styling: the user prefers the **mobile (labelled green)**
  version — unify the desktop one to match. _Needs an update pass._
