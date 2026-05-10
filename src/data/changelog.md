# Release Notes

A running log of what's new in Setlists MD. Newest releases first.

## 0.1.0-pre-alpha — Custom dialogs, modals & messaging polish
*May 2026*

### Added
- Custom confirmation dialogs replace browser pop-ups across the app — deleting setlists or songs, moving songs between team and personal, signing out, clearing local data, deleting a team, and removing roster members.
- Settings opens as a Notion-style modal on desktop with a sidebar nav and content pane. Mobile and tablet keep the existing full-screen layout.
- New **What's New** panel in Settings (you're looking at it) renders the release notes from a markdown file with color-coded section badges and a "Current" pill on the live version.
- Offline banner appears at the top of the screen whenever the device loses its network connection.
- Toasts confirm song saves, setlist `.zip` exports, and library `.md` downloads — and surface friendly errors when something fails.
- Editor now warns before discarding unsaved edits when you tap Back, and the browser also prompts on tab close.

### Improved
- Library, Setlists, and Dashboard now share a single search bar style: tall pill, brand-color focus ring, descriptive placeholder, and an inline × clear button.
- Sort pills in the library read **Title / Artist / Key** in sentence case instead of all caps.
- Move-to-team and move-to-personal prompts spell out exactly what will happen to the song.
- The × button on the desktop Settings modal now fully closes regardless of how many sub-panels you drilled through.

## 0.0.2-pre-alpha — Mobile shell & theming
*April 2026*

### Added
- Bespoke mobile shell with a brand-forward drawer, bottom nav, and unified top-bar search.
- Light / Dark / System theme switch in Appearance.
- "Modes" theme variant powering the Dashboard and Library page surfaces.

### Improved
- Setlist overview gains a sticky header that collapses on scroll.
- Section flow ribbon and key-change badges now respect the active theme.

## 0.0.1-pre-alpha — Foundations
*March 2026*

### Added
- Progressive Web App with offline-first storage in IndexedDB.
- `.md` chord-chart format with sections, inline chords, tabs, and modulations.
- Setlist builder, live performance view, and PDF/`.zip` export.
- Optional Supabase sign-in for cross-device preference sync.
