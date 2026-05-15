# Release Notes

A running log of what's new in Setlists MD. Newest releases first.

## 0.3.0-pre-alpha — Cleaner chart view & arrangements modal
*May 2026*

### Added
- **Arrangements modal.** Tap the arrangement label under the song title to open a bottom sheet that switches between arrangements, renames, deletes, sets a default, or creates a new one — all in one place.
- **Bottom-sheet panels** for layout, music, and song info in the chart view. Pull down with your finger to dismiss.
- **Tempo, time, and artist** now live in the Song info sheet alongside capo, CCLI, tags, notes, and links.

### Improved
- The song-view header is pared down to just the close × and a single dot (⋮) overflow menu. Layout, music, info, print, edit, and fullscreen all live inside that menu now.
- Bottom sheets let the chart show through under a faint dim — your music stays visible while you change settings.

### Fixed
- Creating a new setlist now lands on the new setlist's overview instead of bouncing back to wherever the builder was opened from.
- The font-family picker inside the Layout sheet now opens above the sheet instead of getting hidden behind it.

## 0.2.0-pre-alpha — Arrangements, key history & next-song picks
*May 2026*

### Added
- **Multiple arrangements per song.** Open the Editor and the new dropdown under Song Details lets you pick between arrangements, add a new one, rename, delete, or open the *Edit Arrangements…* dialog to set a default and manage them all at once. Existing songs become a "Main Arrangement" automatically.
- **Per-arrangement musical content.** Each arrangement keeps its own key, tempo, time signature, capo, structure, sections, and notes. Title, artist, CCLI, tags and links stay shared at the song level.
- **Pick the arrangement when adding to a setlist.** Setlist rows now show an arrangement selector alongside the key when a song has more than one. The Chart View also has an arrangement dropdown in the header.
- **"Most played in" key history.** The Editor's metadata panel surfaces which keys you've actually performed each song in, computed from setlists with a date in the past. Adding a song to a new setlist auto-transposes it to its most-played key with a one-shot toast.
- **Recommended next song panel.** When building a setlist, a new compact card under the song picker suggests three songs that flow well from your last pick — scored by circle-of-fifths key compatibility, tempo proximity, and freshness (least-played first). Empty setlist? It surfaces "Fresh picks" instead.
- **Library badge** showing the arrangement count when a song has more than one.
- **Round-trippable arrangement files.** Each arrangement exports as its own .md (linked back via `songId` in frontmatter), and zip imports re-group multiple files for the same song into one library entry.

### Improved
- The Editor header now mirrors the Setlist Builder pattern: title and a delete trash icon at the top, Save/Cancel pinned to a sticky bottom action bar, no back chevron. Song Details, Key, Tempo and Time signature share one tidy row.
- Cloud sync surfaces upload errors as toasts instead of swallowing them — and confirms a successful push with a count of what synced.
- Connecting a Bring-Your-Own cloud provider now triggers an immediate sync so your library lands in Drive/Dropbox/OneDrive without an extra "Sync Now" tap.
- Frontmatter no longer emits a redundant `id:` line when `songId:` is present — the arrangement-identity pair is the canonical link.

### Fixed
- Sync is more resilient to malformed song sections; one bad section can no longer crash the entire upload loop.

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
