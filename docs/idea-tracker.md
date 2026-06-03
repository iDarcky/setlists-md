# Idea Tracker

Status of the ideas from the original brain-dump, marked as implemented or
grouped by what's left. Tied to the `betaui` branch / v0.6.0-pre-alpha.

**Legend:** ✅ done · 🟡 partial · ⬜ not started

> Companion docs: `docs/redesign-shell.md` (shell redesign spec + component
> architecture review), `docs/roadmap.md` (longer-horizon list).

---

## ✅ / 🟡 Done or in progress

### Shell & navigation
- ✅ **New UI — desktop top header** (replaces left sidebar): Home/Setlists/Library, centered workspace switcher, bell/gear/avatar. *(L2-21 "top bar ruins everything", L2-33 "New UI", L1-9 church top modal)*
- ✅ **Show the church / kill the top modal** — church `TeamBanner` removed; workspace switcher owns it. *(L1-9)*
- ✅ **iOS-26 mobile shell** — floating glass tab bar + morphing FAB; workspace switcher inside the search bar. *(L2-33, "iOS 26")*
- ✅ **Swap workspace → always go to dashboard.** *(L2-30)*
- ✅ **Multiple bands/churches** — multi-team backend (`teams[]` + `activeTeamId`). *(new; underpins L1-1)*
- ✅ **Scroll on sidebar on iPad** — sidebar removed entirely. *(L2-7)*
- 🟡 **New UI overall** — desktop + mobile shells done; tablet pending; many inner screens unchanged. *(L2-33)*
- 🟡 **Better nav bar on tablet** — tablet currently uses the scaled desktop header; dedicated two-pane is Phase 3. *(L1-10)*

### Library & setlists
- ✅ **Notion-style Library & Setlists** — sortable table + table/list toggle + right-side peek.
- ✅ **Setlists same as songs (not big cards)** — table view with a gallery toggle.
- ✅ **Arrangement count indicator** on song rows.
- ✅ **Side-peek toolbar** — collapse / full-screen / info / print / edit / display options.
- 🟡 **Library layout out of settings** — Library has its own in-page table/list switcher now; the settings option still exists too. *(L1-13)*
- 🟡 **Better delete/edit for setlists** — bulk delete + peek edit/delete; the setlist *modal* rework is separate. *(L1-5, L2-12)*
- 🟡 **Filters in library** — search + tag filter + sort; multi-filter UI not built. *(L2-39)*
- 🟡 **Export all should zip** — per-item export exists; a true "export all → one zip" is not wired into bulk. *(L1-14)*

### Accounts, teams, profile
- ✅ **Profile pictures** (personal) + **church logo** upload. *(L2-8 logo half; new)*
- ✅ **Team roster avatars** (roster + scheduling picker). *(part of L2-11/L2-55)*
- ✅ **Account moved into Preferences** (panel in Settings). *(L2-34 global settings, partial)*
- ✅ **Entitlement bug** — team features no longer resolve to free. *(L2 church bugs)*
- 🟡 **Members can edit songs (shouldn't)** — entitlement fixed; the editor-entry read-only gating still needs an audit. *(L2-2)*
- 🟡 **Church logo and color** — logo ✅; church accent color ⬜. *(L2-8/L2-9)*
- 🟡 **A view for members** — roster shows members; a dedicated member view ⬜. *(L2-55)*

### Fixes & polish
- ✅ **Fonts not changing (tablet/mobile/all)** — lyric font now follows the picker. *(L2-32)*
- ✅ **iPad: background moves with Settings open / click-outside to close.** *(L1-15, part of L2-4)*
- ✅ **Remove/fix feedback button** — moved to header + mobile drawer; floating bubble gone. *(L2-17)*
- ✅ **Accent fill on nav / active states** (ongoing). *(L2-5, partial)*
- 🟡 **Top overflow / background scroll on iPad** — Settings case fixed; general audit pending. *(L2-4)*
- 🟡 **Settings white-line divider** — token-based already; not specifically reworked. *(L2-10)*
- 🟡 **Edit layout from live/practice** — display controls surfaced in the chart toolbar; live/practice-specific entry ⬜. *(L2-3)*
- 🟡 **Print/PDF** — print surfaced in the peek toolbar; the iOS-PWA popup bug is unfixed. *(L2-45)*

---

## ⬜ What's left (grouped)

### A. Notes & arrangements
- ⬜ Notes per setlist vs per song *(L1-3)*
- ⬜ Notes per user *(L1-4)*
- ⬜ Edit chords from practice → auto / prompt new arrangement *(L1-6)*
- ⬜ New arrangement seeded from the current one *(L1-7)*

### B. Setlists & scheduling
- ⬜ Edit tempo / structure / **BPM on setlists** from the builder *(L1-2, L2-57)*
- ⬜ Setlist modal rework *(L2-12)* · WIP setlists *(L2-53)*
- ⬜ Setlist dropdown from the song name *(L2-14)*
- ⬜ Service → dropdown (+ add) vs Tags for events *(L2-6, L2-54)*
- ⬜ Songs/Roster as two tabs *(L2-11)* · members auto-add when sorting *(L2-28)* · warn on missing player/vocalists *(L2-29)*
- ⬜ Rehearsal booking + calendar notifications *(L1-11)* · Sundays-only list *(L1-12)*
- ⬜ Schedule redesign: bigger, "what's coming up" preview popup, what you're playing, smaller/more cards, green-bar size, AM/PM + location, durations *(L2-47..52)*

### C. Chart & performance display
- ⬜ Display modes: Chords+Lyrics / Lyrics-only / Chords-only / Song-map *(L2-22)*
- ⬜ Notation: Letter / Nashville / Do-Re-Mi *(L2-23)*
- ⬜ Sections: Full / Condensed *(L2-24)*
- ⬜ Structure scrolls (not overflow) / scroll with song *(L1-16, L2-16, L2-26)*
- ⬜ Different live/performance view; show current song elsewhere *(L2-35)* · dots for setlist position *(L2-25)* · next/prev pill options *(L2-15)*
- ⬜ Capo guitar-players-only / per-user *(L2-13)*
- ⬜ Fix chord diagrams + tap-a-chord + tab builder *(L2-19)*
- ⬜ Drag structure on mobile *(L1-8)* · structure edit from rehearsal *(L2-46)*

### D. Customization & settings
- ⬜ Better customization button/entry *(L2-18)*
- ⬜ Fully customizable song page (Pro) *(L2-38)* · customizable song sections *(L2-36)*
- ⬜ Accent applied everywhere (finish) *(L2-5)* · church-specific accent *(L2-9)*
- ⬜ Global settings consolidation *(L2-34)*
- ⬜ Themes sometimes won't change *(L2-20)*

### E. Library content & insights
- ⬜ Multi-filter library view *(L2-39)* · export-all → zip *(L1-14)*
- ⬜ Repertoire metrics (common key, BPM range, fatigue/most-played) *(L2-40)*
- ⬜ Public-domain song pack *(L2-42)*

### F. Foundations & long-term
- ⬜ Church/Team sync hardening + optimistic locking *(L1-1)*
- ⬜ Pro/sync vs church/band entitlement split *(L2-27)*
- ⬜ Unsaved-changes guard ("are you sure?") *(L2-1)*
- ⬜ Login scroll bug *(L2-31)* · Remove Welcome on mobile *(L2-48)*
- ⬜ Rehearsal mode *(L1/L2-44)* · Tasks/notes for leaders *(L2-43)* · Collaboration / planning-center *(L2-41)*
- ⬜ Periodic optional feedback prompt *(L2-56)*
- ⬜ TypeScript migration (incremental) *(L2-37)*
- ⬜ Tablet two-pane (Phase 3)
