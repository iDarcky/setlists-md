# Song Hub V2 — build spec (handoff)

> Self-contained brief for building the **Song Hub** (the library's song-open
> target). A fresh session should be able to execute this without extra context.
> Read alongside `docs/PLAN.md` §4 ("Song hub") and the mockups in
> `docs/mockups/` (`song-hub-v2.html`/`.png` is the canonical V2; `aa-menu.*`
> shows the already-shipped Aa popover).

## Status (0.14.0-beta.3)

**Phases 1 & 2 shipped**, plus a faithful pass over the V2 mockup. Live now:
the hub shell + Chart/Lyrics/Details tabs (`SongHub.jsx`), `embedded` `ChartView`,
the `song-hub` route (replacing `chart`), the two-card layout (gradient hub card +
reader card that follows the chart theme), gold key **dropdown** (transpose) +
relabelled meta pills, the **codes** song-map (now the app-wide default ribbon
style, static on the hub), **cover art** from Spotify/YouTube (`cover-art` edge
function + `lib/coverArt.js`; CSP updated), **inline Details editing**, the
**Labs neutral palette** preview, and **Keep-awake / Lock-orientation** settings.
Remaining: **Phase 3** (bottom transport) and **Phase 4** (Audio/Practice) — see
`docs/views-vision.md` for the full Chart/Live/Rehearsal/Practice direction.

## Goal

Opening a song from the library should land on a **Song hub**, not today's
chart-only view. The hub owns *identity + navigation*; the chart becomes *just
the reader* inside it. This de-clutters the reading surface (the chart stops
trying to be the hub) and gives us a home for per-song surfaces (Lyrics,
Details, Audio, Practice).

Reference layout (see `docs/mockups/song-hub-v2.png`):
- **Hub header** — art/title + key chip · artist · inline meta (`Key · ♩BPM ·
  Time · Length`) · **arrangement picker** · hub actions: **Transpose**, **Aa**,
  **Full screen**, **⋮** (overflow), **Edit**, **Campfire** (primary).
- **Song-map ribbon** under the header (quiet section codes).
- **Tabbed surfaces**: `Chart · Lyrics · Details · Audio · Practice`. Chart is
  the default. Reader is **full-width**.
- (Later) **bottom transport bar**: play/pause · source · scrubber · metronome ·
  auto-scroll · loop.

## What already exists (don't rebuild)

- **`view === 'chart'`** renders `<ChartView song={currentSong} … />` at
  `src/App.jsx:~2292`. Opening a song = `navigate('chart', { song })`
  (`App.jsx:~1255` from the library, `~1453` from setlists). `currentSong` is
  the song object.
- **`ChartView.jsx`** is the reader. It currently owns its header via
  **`StageHeader`** (title row with actions + `⋮` `OverflowMenu` + `✕`; meta row
  with Key/tempo/time/arrangement). It already has: the **`AaMenu`** popover
  (Lyrics/Chords/Page display controls), the view-mode list folded into the `⋮`
  menu, the **`FloatingStructure`** ribbon, the arrangement switcher, transpose,
  PDF export, and `onPlay`(campfire)/`onEdit` callbacks.
- **Multi-arrangement** resolves via `src/arrangements.js` (`resolveSongView`);
  songs carry `arrangements[]` + `defaultArrangementId`.
- **No router** — `App.jsx` switches on a `view` string and keeps a small nav
  stack (`navigate`, `goBack`, `goToMainView`).

## Core decision (resolve first)

**How does the Chart tab relate to `ChartView`?** Recommended:

> Add an **`embedded`** prop to `ChartView`. When `embedded`, it **suppresses its
> own `StageHeader`** (the hub provides identity/meta/actions) and renders only
> the reader body + the controls that must stay with the content (the `Aa`
> popover trigger, transpose, view-mode). The hub header hosts title/artist/
> meta/arrangement/Edit/Campfire/Full-screen/`⋮`.

This keeps one reader implementation. The alternative (duplicate the reader) is
worse. The trade-off to settle in code: which controls live on the **hub header**
vs **stay in the reader**. Proposed split:
- **Hub header:** title, key chip, artist, inline meta, arrangement picker,
  Transpose, Full screen, Campfire, Edit, `⋮` (Print/Move/Copy/…).
- **Reader (ChartView embedded):** `Aa` display popover, view-mode (`⋮`-folded),
  the structure ribbon, the notes peek.

## Phases

### Phase 1 — Hub shell + Chart tab (MVP) ✅ shipped
1. New **`src/components/SongHub.jsx`** shell: hub header (identity + inline meta
   + arrangement picker + hub actions), song-map ribbon, tab row, body.
   - Tabs for Phase 1: **Chart** (default) + stubs for Lyrics/Details (render
     "coming soon" or hide until Phase 2). Skip Audio/Practice for now.
   - Hub actions wire to existing callbacks: Edit → `onEdit`, Campfire → `onPlay`,
     Full screen → `onToggleFullscreen` (ChartView already takes these — lift
     them to the hub), `⋮` → reuse the `OverflowMenu` items currently in
     ChartView's `close`.
2. Add **`embedded`** to `ChartView` (suppress `StageHeader`; keep reader + Aa +
   ribbon). The Chart tab renders `<ChartView embedded song={…} … />`.
3. **Routing:** add `view === 'song-hub'` rendering `<SongHub song={currentSong}
   … />` in `App.jsx`. Point the library/setlist song-open at
   `navigate('song-hub', { song })`. Keep `'chart'` as a thin alias or redirect
   so existing deep links / `navigate('chart', …)` callers still work (grep all
   `navigate('chart'` + `view === 'chart'` and update or alias).
4. Default **2 columns** (Aa controls 1/2/Auto — already implemented).

### Phase 2 — Lyrics & Details tabs ✅ shipped (+ inline Details editing)
- **Lyrics**: lyrics-only render (reuse the existing `songmap`/lyrics display
  path; a Lyrics view mode already exists in `VIEW_MODES`).
- **Details**: metadata (CCLI, tags, themes, scripture, links, notes, key
  history) — read-only, Edit jumps to the editor.

### Phase 3 — Bottom transport (ship metronome + auto-scroll first)
- A slim transport bar that appears only when active. **Audio is deferred** (we
  only store Spotify/YouTube links). Ship **metronome + auto-scroll** (the
  scrubber = song position, not audio). See PLAN §4 "Bottom transport".

### Phase 4 — Audio / Practice tabs
- Audio: drive the YT/Spotify embed (or real backing-track playback — major).
- Practice: solo tools (loop a section, slow-down, log minutes) — overlaps the
  planned Rehearsal/Practice split (PLAN §4 "Modes & playback").

## Open questions (ask the user during Phase 1)
- **`'chart'` route:** replace entirely with `'song-hub'`, or keep `'chart'` as
  an alias? (Recommend alias first, migrate callers, then remove.)
- **Transpose persistence:** does the hub's transpose persist per song or reset
  on close? (Also flagged in `docs/views_questions.md`.)
- **Audio source** (Phase 3+): metronome+auto-scroll only (lean), YT/Spotify
  embed, or real multi-track. Recommend metronome+auto-scroll first.

## Verify
- `npm run build`, `npx vitest run`, lint touched files.
- Drive the preview (Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/
  chrome`, global playwright) — open a song from the library → lands on the hub;
  Chart tab reads full-width; Aa popover + transpose + arrangement switch work;
  Edit/Campfire/Full screen behave; `⋮` has the song actions.
- Phone + tablet pass (the hub header must keep the typographic hierarchy we just
  shipped on the chart; sections untouched).

## On finish
- Feature batch on `beta` cycle → run the **"finish"** workflow in `CLAUDE.md`
  (bump `-beta.<N>`, append one changelog entry, build, commit, ff `beta`).
- Update `docs/PLAN.md` §4 (mark phases shipped) and this file as phases land.
