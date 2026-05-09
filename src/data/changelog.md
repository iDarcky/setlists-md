# Release Notes

A running log of what's new in Setlists MD. Newest releases first.

## 0.0.3-pre-alpha — Custom dialogs & polish
*May 2026*

### Added
- Custom confirmation dialogs replace browser pop-ups across the app — deleting setlists or songs, moving songs between team and personal, signing out, clearing local data, and removing roster members.
- Settings now opens as a Notion-style modal on desktop with a sidebar nav and content pane. Mobile and tablet keep the existing full-screen layout.
- Offline banner appears at the top of the screen whenever the device loses its network connection.
- Toasts now confirm song saves, setlist `.zip` exports, and library `.md` downloads — and surface friendly errors if something fails.
- New **What's New** panel in Settings (you're looking at it).

### Improved
- Library search bar restyled: taller pill, brand-color focus ring, inline clear button, and a more descriptive placeholder.
- Sort pills now read **Title / Artist / Key** in sentence case instead of all caps.
- Move-to-team and move-to-personal prompts spell out exactly what will happen to the song.

### Fixed
- The editor warns before discarding unsaved edits when you tap Back, and the browser also prompts on tab close.

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
