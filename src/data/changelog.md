# Release Notes

A running log of what's new in setlists.md. Newest releases first.

## 0.4.0-pre-alpha — Midnight theme & a tidier account drawer
*May 2026*

### Added
- New **Midnight** theme — the legacy navy surface returns as a third theme option alongside Light and Dark, and is now the default for fresh installs.
- The mobile hamburger menu has a **What's new** row with a brand-teal dot when a new release is waiting; tapping it lands you straight on these notes.
- Guests now see a quiet **Compare plans →** link on both the mobile drawer and the desktop Account profile, so the marketing hook is reachable without crowding the Sign in button.
- The Settings → About panel leads with the brand mark and the colored setlists.md wordmark; signed-in users get a friendly "Hi, ⟨name⟩." line beneath it.

### Improved
- Mobile drawer reworked: the Songs/Setlists counters are gone, the rainbow Upgrade-to-Pro pill no longer appears for guests, and Preferences / Help / Install pin to the bottom of the panel so the primary buttons up top can breathe.
- Drawer gradient swaps its bottom-right plum spot for Vetiver (#3B5A52), keeping the wash fully inside the official Lydian Teal palette.
- Midnight tints card hovers, the New Song dropzone, and other surface chrome with a subtle navy hue so they stop reading as cold gray on the navy page.
- Dashboard search dropdown and "Recently Edited" dividers follow the active theme instead of the legacy dark chrome.
- Bottom navigation drops the sliding indicator circle; the active tab is conveyed in brand teal alone.

### Fixed
- Dashboard scrolls correctly again when the team/church top bar is showing — previously the page clipped instead of scrolling under the banner.
- Drawer "What's new" tap now opens the panel directly instead of dropping you on the Settings hub.
- What's new release row wraps to a second line on narrow screens instead of truncating the date to "May…".

## 0.3.0-pre-alpha — New look: official brand kit
*May 2026*

### Added
- Official setlists.md brand kit is now live across the app: new app icon, favicon, and wordmark.
- Brand wordmark now appears on the loading splash, sign-in screen, onboarding hero, and the mobile drawer footer (when signed out).

### Improved
- Lydian Teal is now the exact brand primary, with Mist, Vetiver, Bone, and Stage joining the palette.
- Dark mode shifts to a warmer "Stage" black and light mode to a softer "Bone" paper, matching the brand kit.
- App name reads as "setlists.md" everywhere in the UI, page title, and PWA install card.

### Fixed
- Mobile bottom-nav active state no longer shows an off-centre circle behind the tab — the active tab now simply tints in brand teal.

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
