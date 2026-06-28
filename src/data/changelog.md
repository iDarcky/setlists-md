# Release Notes

A running log of what's new in setlists.md. Newest releases first.

## 0.14.0 — Find anything, and read it your way
*June 2026*

### Added
- **Powerful search everywhere** — one search box now finds songs by title, original title, artist, writer, album, theme, scripture, key and more, not just the title. It ignores accents and punctuation (type "lauda" to find "Laudă", or "holy holy holy" for "Holy, Holy, Holy") and forgives typos ("amazin grce" still finds "Amazing Grace").
- **Jump to search with a keypress** — press ⌘K (Ctrl-K) or "/" to open search from anywhere on desktop and tablet, and matches are highlighted so you can see why a result came up.
- **Filter your library** — narrow songs by key, tempo, theme, language, year, scripture, and liturgical moment, and combine them with your tags.
- **Choose your columns** — pick which columns appear in the Songs and Setlists tables; your choice follows you across devices.
- **Pick how lists look** — switch Songs and Setlists between Cards, a dense Compact list, and a full Table. Phones get the same choice, remembered on each device.
- **One "Aa" menu for the chart** — tabs for Lyrics, Chords and Page let you set the size, font and colour of lyrics and chords independently, plus theme, columns and notation, all in one place. Your choices stick on each device.
- **Sharps or flats, your call** — a new Accidentals setting (Auto / Sharps / Flats) spells the black notes the way your song's key actually reads (a song in G shows F♯, not G♭), with a global override when you want one.
- **Separate transpose in the editor** — relabel a song's key without touching your chords, or move every chord up/down a semitone with one tap.
- **Floating structure ribbon (Labs)** — pin the section map to the bottom or either side as you read, shown as chips, codes or dots.

### Improved
- **Redesigned setlist cards** — cleaner and far more compact, with a date badge, the essentials at a glance, and a one-tap Play Live — much easier to scan, especially on a phone.
- **Tidier setlist filters** — service and tags now live under a single "Filters" button.
- **Mobile lists open as cards** by default, with the view switcher right there to change it.
- **Cleaner chart header** — the view switch (Chords / Lyrics / Song map) moved into the "⋮" menu, the display controls collapsed into the single "Aa" button, and on phones the title and the key · tempo · time line now read with a clear hierarchy.
- **Friendlier new-song editor** — a new song starts with the Title and Key blank and asks for them before saving, gently nudges for tempo and time, and edits the slide order from one place shared by the Arrange and Advanced tabs.
- **Smarter chord entry** — the chord picker opens right at your cursor and suggests the chords that fit the song's key.
- **Reading follows you** — section highlighting tracks your scroll and the final sections light up as you reach the end.

### Fixed
- **New songs no longer default to the key of C** — the key stays blank until you choose it.
- **Scroll all the way to the end** — the reading views no longer cut off the last sections.

## 0.13.0 — Sync you can trust
*June 2026*

### Added
- **Sync conflict resolver** — if the same song or setlist was changed on two devices before they synced, you now choose what to keep: your version, the cloud version, or both (your copy is saved alongside as a "conflicted copy"). The cloud no longer quietly wins and overwrites your work.

### Improved
- **Sync rides out network hiccups** — a brief connection drop now retries automatically instead of failing the whole sync.
- **Offline edits queue up** — keep editing with no connection and everything uploads the moment you're back online. A new "Offline — will sync" badge tells you exactly where things stand.
- **Closing the app won't lose a last-second edit** — pending changes are flushed when you leave, and finished off on your next launch.
- **Clearer update prompt** — when a new version is ready, a tidy "New version available" pop-up lets you reload right away (and stays out of the way during a live set).

### Fixed
- **No more phantom "edited just now"** — songs no longer re-sync in a loop or fill the team activity feed with edits nobody made. Sync now compares what a song *means*, not its exact text, so two devices on slightly different versions stay in step.

## 0.12.1 — Reliable live mode & steadier sync
*June 2026*

### Fixed
- **Live and Performance mode no longer crash** when a setlist points at a song whose link drifted — the song now resolves by its title and plays as normal, and anything that genuinely can't be found shows a tidy "Missing Song" placeholder you can skip past instead of a blank screen.

### Improved
- **Sync is harder to spook** — added a safety guard that stops a sync glitch from re-uploading your whole library at once (which could shuffle song links and spam "edited" activity). If something looks off, sync now pauses and tells you rather than churning in the background.

## 0.12.0 — Stage headers, private notes & a customizable dashboard
*June 2026*

### Added
- **Private notes** — keep your own "My note" alongside the shared team note on a song, a song-in-a-setlist, or a section. They sync to your account and work offline.
- **Campfire mode** — hit Play on any song to go live without building a setlist, and get "Up next" suggestions (matched by key, tags and tempo) to keep the night going.
- **Edge-arrow navigation** — a new way to move between songs in practice/live: big chevrons in the screen corners that stay put when the header tucks away (press-and-hold previews the next song). Pick it under Settings → Navigation controls.
- **Structure ribbon that follows the song** — the current section highlights and scrolls into view as you go, with three styles to choose from (chips, codes, or dots).
- **Customizable dashboard** — reorder and show/hide your home widgets, plus new ones: This week, Library stats, Team availability, and Sync status.
- **Multiple workspaces** — create more than one band/church on your account (up to a sensible limit).
- **General settings** — choose your default landing page, replay the welcome flow, toggle confirm-before-delete, and an early language switch.
- **Rehearsal location** — give a rehearsal its own location for when you practise somewhere other than the service venue.
- **Over-scheduling warning** *(Labs)* — get a heads-up when you're about to schedule someone who's already played several services in a row; choose how many in a row triggers it under Settings → Labs.
- **Schedule counts in setlist tables** — team setlist tables show how many instrumentalists, vocalists and total members are scheduled.
- **Labs settings** — a new Settings → Labs area for trying experimental features early.
- **Minor keys** — set a song's key as minor (e.g. Am) and transpose within minor keys everywhere you change key.
- **More chord notations** — show chords as Letters, Nashville numbers, or Do‑Re‑Mi (fixed‑do), plus a new Chords‑only view.
- **Condensed repeats** — a section that repeats (a chorus played several times) can collapse to a tappable "Repeat" line instead of reprinting the whole thing.
- **Recently deleted** — deleting a song now keeps it for 30 days under Settings → Data, so an accidental delete is recoverable.
- **Duplicate check** — creating or importing a song that's already in your library asks first, so a re‑import won't quietly pile up copies.

### Improved
- **Reworked stage header** — Chart, Practice and Live now share a clean three-row header (title · key/tempo/time · structure) that collapses to just the structure as you scroll, with an auto-hide setting and tap-to-reveal.
- **Unified notes** everywhere — the same notes card in chart, practice, live and the setlist builder.
- **Settings & Help refreshed** — Settings (renamed from Preferences) is grouped into clear sections with a tidy account card; Help is rewritten to match the app and now opens from the "?" button.
- **Simpler sign in / sign up** — email + password only, with show/confirm password and a strength meter; fields scroll into view above the keyboard.
- **My Schedule** colour-codes your services (green) and rehearsals (amber); adding a band member from an instrument tab now fills in that instrument.
- **Smaller, consistent header** that no longer overflows on small phones; the chords/lyrics/tabs/song-map switcher is one tidy menu.
- **Faster with large libraries** — editing a song and syncing now touch only what changed instead of rewriting your whole library each time, so big song lists stay snappy.
- **Setlist overview, redesigned** — a cleaner, layered layout: a tidy header (date · time · location, with the rehearsal called out on its own), the song key shown in your chord colour, and section flow as colour-coded chips.
- **Smoother band picking** — adding a member opens a quick picker to set their instrument and vocal part in one step, with search and an "available only" filter; the roster card is calmer.
- **Consistent schedule colours** — services are teal, rehearsals blue, and your availability is a green/amber/red dot — the same across the dashboard widget, calendar and list.
- **Smarter setlist ordering** — upcoming setlists list soonest-first and stay "upcoming" until an hour after they start; past ones group newest day first (morning before evening within a day).
- **Tidier setlist editor** — Draft/Ready moved into the header, and the band is now managed from the setlist overview; the service filter is a proper dropdown.
- **Chart display, reorganized** — separate Display / Layout / Actions menus, with theme and sizes under Layout; clearer, easier‑to‑read chord diagrams; the header now matches your chart theme; and the title bar stays put by default with a one‑tap show/hide.

### Fixed
- **Sync feels quiet** — the status no longer flickers on every edit; closed a sync race, ignore the echo of your own changes, and always surface team conflicts.
- **Double scrollbar** on the Songs and Setlists screens is gone.
- New songs no longer pre-fill the title with "New Song"; the editor's "+ Add" menu no longer hides under the header; and the structure bar no longer clips its first item.
- Opening a setlist no longer jumps you to the bottom of the list.
- **Sync safety** — a guard now blocks any single sync from deleting most of your library; team libraries automatically heal songs whose id drifted (no more "duplicate" sync failures); routine syncs no longer log false "edited" activity; and a sync that would drop a song now keeps it in Recently deleted instead of losing it.

### Security
- **Tighter by default** — the app now runs under an enforced content-security policy (no inline scripts), share links use longer, harder-to-guess tokens, and text fields have sensible length limits.

## 0.11.0 — Backend hardening & sync reliability
*June 2026*

### Fixed
- **Team library sync rebuilt** — server-authoritative engine with compare-and-swap locking; fixes the endless "Synced" toast loop caused by hash mismatch between push and JSONB pull, and correctly propagates remote deletions locally.
- **PDF export on all platforms** — print dialog now always uses an in-app overlay (iframe); fixes printing in iOS standalone mode and clears the last blocker for Capacitor webview packaging.
- **Team read-only enforcement** — members of a read-only team library can no longer reach the song editor, smart-import, or multi-import flows.

### Security
- Tightened database function permissions: revoked PUBLIC/anon execute on all security-definer RPCs (earlier migration was a no-op against PUBLIC grant).
- Team schedule writes restricted to admins, leaders and owners; members can no longer assign band slots.
- Team availability inserts now validated against team membership (prevents cross-team availability injection).

## 0.10.0 — Editor overhaul, teams & scheduling, sharing, and a new look
*June 2026*

### Added
- **Share a setlist by link** — publish a read-only snapshot anyone can open (with an optional expiry: 24h / 7 days / 30 days / never) and a QR code. Revoke any time.
- **Worship Leader role** — a new team role between Admin and Member that can run the schedule and assign the band, without billing or member-management powers.
- **Rehearsal day** — give a setlist an optional rehearsal date/time; it shows on the schedule as its own entry, separate from the service.
- **Band assignments** — assign each scheduled person an instrument *and* a vocal part (Lead male/female, Soprano, Alto, Tenor, Bass, Backing).
- **Team activity feed** — see who added songs, edited setlists, joined, set availability or got scheduled — on the Team page and the dashboard.
- **Schedule & availability** — a team schedule with a list/agenda and a month calendar, per-day availability, recurring availability, and rosters per service.
- **Song map** — a chart view showing the whole song's section flow with each section's chord shape; available in chart, practice and live.
- **Instrument views** — pick your role (Leader / Vocalist / Guitarist / Bassist / Keys / Drummer) from the chart; Bassist collapses chords to root notes.
- **Tabs by instrument** — tag a tab as acoustic, electric or bass and filter to just yours in chart, practice and live.
- **Display modes in practice & live** — switch between Chords, Lyrics, Tabs and Song map, not just in the chart view.
- **Setlist services** (Church) — a Service column + filter on the setlist list, a Services manager in Settings, and Songs-by-Service stats on the team page.
- **Reusable tab library** — build a tab once, name it, and drop it into any section; edit it once and every placement updates. Tag tabs with an instrument.
- **Insert anywhere** — a "+" between every line in Arrange adds a lyric, chord line, tab or key change at that exact spot.
- **Paste to import** — the editor's paste converts Ultimate-Guitar (chords-over-lyrics) and ChordPro into a clean chart, filling in title/key/etc.
- **Browse songs when creating** — start a New Song from a bundled public-domain song.
- **Tab colours & separate printing** — set string/fret/background colours and size for tabs (Settings → Chart), and a dedicated Tabs toggle in the PDF/print options.
- **Reworked song editor** — a compact header (title, arrangement, key/tempo/time, mode toggle) with the chart canvas beneath; Song Details opens from the title.
- **Visual chord placement** — tap a lyric to drop a chord where you touch, and tap a chord to move or remove it; add chord-only lines for intros/turnarounds.
- **Key changes & section tools in Arrange** — add/remove modulate markers and manage sections from a per-section menu; sections show their number.
- **Many more song-info fields** — original title, language, translator, writers, publishers, copyright, album, label, year, themes, genres, verses, vocal range, and more.
- **Touch-first structure editor** — reorder the section flow with tap-to-add and move/remove controls.
- **In-app legal pages** — Privacy, Terms, and a Copyright/DMCA page open inside the app; a sign-up legal notice; and a sign-in nudge for guests on the dashboard.

### Improved
- **New dashboard** — a cleaner home: Next up, your schedule, upcoming services, recent activity and recently edited.
- **Consistent headers** — Team, Schedule, Preferences, Help, Legal and Plans share one header: a big title on desktop, and on mobile a back chevron in submenus with an X to close.
- **Richer team page** — upcoming services, next-service readiness, most-used keys, never-played songs, and each member's instruments.
- **Long tabs wrap** — guitar tabs flow onto multiple lines at the bar instead of scrolling sideways.
- **Safer member removal** — change role and remove live behind a ⋯ menu, and removing someone asks first.
- **Multi-tag filtering** on the song and setlist libraries, and a Tabs tab that's always available in the editor.
- **Unsaved-changes guard** on the song editor, plus an explicit Done on the song-structure sheet.
- **Editor parity** — the chord tool, coloured section picker, key-change stepper and tab library are the same across Arrange and Advanced; the raw editor edits just the song body.
- **New Song redesign** — Blank, Import, Paste and Browse as clean tabs; Blank drops you straight into the editor.
- **Settings sync** — every appearance preference (chart theme, accent, section colours, custom types, and more) now follows you across devices.
- **Smoother Settings** — no flicker behind the dialog, tap-outside to close, and proper iPad safe-area spacing.
- **Profile & logo uploads** accept JPEG/PNG/WebP up to 5 MB with clearer guidance.

### Fixed
- **Schedule/team crash** — fixed an "unexpected error" caused by duplicate realtime subscriptions.
- **Team stats** — the team page no longer shows 0 setlists when you have some.
- **Dashboard requests** — pending availability requests now appear and stay actionable.
- **Setlist preview** — opening a setlist and going back no longer leaves the side panel stuck open.
- **Saved tabs stick** and the editor opens reliably; single-fret entry no longer doubles (1 → 11); delete-section confirms and reorders everywhere.
- **Read-only bands** — members of a read-only Space can't reach the editor or save there.
- **Sign-in on small screens** scrolls properly; deleting your account transfers Space ownership instead of removing everyone's library.
- **Tablet editor** — restored scrolling, fixed chord placement at line ends, the arrangement dropdown no longer hides behind chords, and tempo entry doesn't drop digits.

### Security
- Added browser security headers (clickjacking, MIME-sniffing, and transport protections).
- Hardened the backend: tightened team-function permissions, fixed an authorization edge case in team invites, locked down avatar-file listing, and cleared dependency advisories.

## 0.9.0-pre-alpha — Spaces: multiple bands & churches
*June 2026*

### Added
- **Multiple Spaces** — run more than one band or church from the same account. Create a new Space from the Team screen or the workspace switcher, pick a Team or Church tier, and switch between them anytime.
- **Home Space** — members who mostly use the app for one band/church can set a Space to open into on launch instead of their Personal one. Look for "Make this my home Space" on the Team screen.
- **Per-Space subscriptions (groundwork)** — each band/church is its own subscription, paid by its owner. Owners get Subscribe / Manage-billing controls, and the workspace switcher flags any Space that's Past due / Unpaid. (Billing switches on in a later release.)
- **Church/band logo** now shows on the Team screen.

### Improved
- **"Space"** is the new name for a band/church workspace throughout the app.
- The **Team** section now appears only while you're inside that Space — no more stray Team tab on your Personal one.

### Fixed
- Creating a Space no longer fails silently for team/church accounts.

## 0.8.0-pre-alpha — Global chart customization, two-pane polish & live/practice rail
*June 2026*

### Added
- **Customize once, everywhere** — column count, lyric & chord size, Nashville numbers, show/hide chords and chord diagrams now save to your device and apply to *every* song and in the live & practice views — not just the song you tweaked.
- **Two-column live & practice** — charts reflow to two columns on a wide screen, and Practice now supports 2-column too.
- **Setlist rail in live & practice** — a collapsible setlist sits beside the chart so you can jump between songs without leaving; on landscape tablets and desktop. Toggle it on/off in Preferences → Chart Defaults.
- **Navigation controls** — choose a floating next/prev pill or prev/next buttons in the chart header (Preferences → Chart Defaults), and swipe left/right to move between songs.
- **Resizable preview pane** — drag the divider between the list and the preview in Library and Setlists; the width is remembered per device.

### Improved
- **Tablet main button** — opening a setlist turns the big button into **Play** (start live); creating a setlist lives in the list header. No more duplicate "+" button on tablets.
- **Header next/prev** moved to the far left and enlarged, well clear of the close button.
- **Practice customize button** — the old 3-dot menu is now a clear display-options button.
- The bottom nav stays visible and usable above the setlist preview panel, and the bulk-select bar no longer overlaps it.

### Fixed
- **New-song Paste on phones** — the paste screen no longer squeezes the text box or stacks two footers; it has a single full-width Create button.
- **Play restored** in the desktop setlist preview (it had gone missing alongside Practice).


## 0.7.0-pre-alpha — Tablet two-pane & setlist management overhaul
*June 2026*

### Added
- **Tablet two-pane view** — on iPad the Library and Setlists become a master list with a detail pane: pinned side-by-side in landscape, an overlay in portrait. Tap a row to preview it.
- **Set order / Roster tabs** — team setlists now split into tabs in the overview and the builder, replacing the old roster icon and slide-over.
- **Tap a song → Practice** — tapping a song in a setlist drops you straight into Practice positioned on that song; Back returns to the setlist.
- **Song length** — set a duration per arrangement (e.g. `3:45`) in the song editor, and the setlist overview shows the **total set length** (songs + breaks).
- **Draft / Ready setlists** — new setlists start as a Draft; mark them Ready when they're locked in. A "Draft" badge shows on cards, the table, and the overview.
- **Edit tempo & structure from the builder** — tweak a song's tempo and section structure right from the setlist's expanded row (it updates the song everywhere).
- **Service picker** — the Church-tier Service field is now a dropdown of your existing services with an "Add new" option.
- **Workspace & authorship** — team setlists show which workspace they belong to, plus who created and last edited them.

### Improved
- **Clearer setlist rows** — song and break rows read as proper cards; the builder rows are more compact with edit (pencil) and delete (trash) icons and at-a-glance capo/note hints.
- **Unsaved-changes guard** — leaving the setlist builder with unsaved edits (Cancel, header nav, or Back) now asks before discarding.
- **Preferences** open on your Account first; the separate profile button is gone (it lives in the gear), and notifications drop down from the bell.
- **Sentence case** across the setlist editor — no more shouty ALL-CAPS labels.
- **Workspace icons** — your avatar / church logo now show in the desktop workspace switcher; the duplicate switcher was removed from the mobile drawer.

### Fixed
- **No more double scrollbars** in the chart view and the setlist overview.
- **Tablet scrolling** — the split-view list and detail pane scroll correctly, and the setlist header no longer jitters while scrolling.
- **Wide tables** no longer overflow and clip the Key column.
- **Delete buttons** in confirmation dialogs are now solid red.
- The **Account panel** outline and the Preferences dividers use the theme color instead of a stray white line.
- Saving a brand-new setlist while signed out no longer bounces you to an empty builder.


## 0.6.0-pre-alpha — App shell redesign, mobile glass nav & profile pictures
*June 2026*

### Added
- **Multiple workspaces** — belong to several bands/churches and switch between them from the header (desktop) or the search bar (mobile). Switching always drops you back on the dashboard.
- **Profile pictures & church logos** — upload a personal avatar in Account, or a team/church logo in Team settings. They show in the header, the workspace switcher, and the team roster.
- **New desktop top header** — Home / Setlists / Library nav, a centered workspace switcher, and notifications · preferences · your avatar on the right. Replaces the old left sidebar and the church banner.
- **Notion-style Library & Setlists** — a sortable table (Name / Artist / Key / Tags, with an arrangement-count badge) and a table/list toggle, plus a slide-over **side-peek** to preview a song or setlist without leaving the list.
- **Bulk actions** — multi-select songs to add to a setlist, copy or move between workspaces, or delete.
- **iOS-style mobile bar** — a floating translucent tab bar (Home / Setlists / Songs) and a morphing action button (create on a tab, Play Live on a setlist), with the workspace switcher tucked into the search bar.
- **Account in Preferences** — your profile now lives as a panel inside Settings.

### Improved
- **Side-peek toolbar** — collapse, full-screen, info, print, edit, and display options are now clear individual buttons.
- **Feedback** moved into the header (desktop) and the menu drawer (mobile) instead of a floating bubble.

### Fixed
- **Chart fonts now actually change** when you pick a different lyric font — on every platform.
- **iPad Settings** no longer lets the page scroll/drift behind the dialog, and tapping outside closes it.
- **Team features** no longer silently fall back to the free tier (entitlement bug).


## 0.5.1-pre-alpha — Role-Based Access Controls & Editor Polish
*May 2026*

### Added
- **Team Roles**: Admins can now assign `Editor` or `Member` roles to team members. Editors can modify songs and setlists, while Members have read-only access.
- **Editor Live Preview**: The song editor now respects your selected Chart Theme in the side-by-side preview.
- **Song Details**: The metadata panel (Tempo, Key, Time Signature) has been integrated into a collapsing header inside the left-hand editor column.
- **Setlist UI Polish**: Replaced the trash can icon with a clean `X`, removed structure flow from PDF exports for a cleaner layout, and adjusted setlist padding.


## 0.5.0-pre-alpha — Chart themes, stage modes, BYO-cloud sync
*May 2026*

### Added
- **Chart themes** — eight hand-tuned presets (Sunday Light, Stage Black, Midnight, Sepia, Vellum, Carbon, Slate, Sanctuary). The first-time default tracks your app theme: light users start on Sunday Light, dark on Stage Black, midnight on Midnight.
- **Custom themes** — save up to four of your own with a name and your own background / lyric / chord colours. They sync with your account and switch from the in-chart Layout sheet.
- **Two-font typography** — pick independent fonts for chords and lyrics from a curated library (system, Inter, IBM Plex, Lora, EB Garamond, Crimson Pro, JetBrains Mono, Fira Code, Roboto Mono, and more). Google Fonts load on demand the first time you pick one.
- **Independent chord and lyric sizes** — separate steppers in the Layout sheet replace the single font-size control.
- **Stage modes** — Leader, Vocalist, Guitarist, Bassist, and Drummer presets at the top of the Layout sheet flip visibility and sizes to match the role in one tap.
- **Sections panel** — recolour any built-in section type and create your own (e.g. "Strofa", "Punte") with a custom colour. Custom types show up in the editor section picker too.
- **Accent colour picker** — pick the brand colour used on buttons, highlights, and active states across the whole app.
- **Lyric line spacing** + **Section spacing** controls in Chart Style for fine-tuning chart density.
- **Practice + Live views** now inherit the active chart theme background, lyric colour, and fonts. Practice view also gains the same Layout bottom sheet as the chart view.
- **Bring-Your-Own-Cloud Pro tier** — connect Google Drive with a redirect-based PKCE auth-code flow. The refresh token lives in our backend (encrypted, service-role-only) so the Google sign-in popup only appears on first connect, not every app open.
- **Privacy Policy + Terms of Service** pages live at /privacy and /terms.

### Improved
- Chart header is a **solid theme colour** per app theme instead of a translucent frost — no more title flicker on scroll and no more chart background bleeding through.
- App theme picker is now a clean dropdown in Settings → Appearance.
- Library layout (columns) moved to Settings → Chart Defaults where it belongs; Appearance now focuses on app-shell preferences only.
- "+ New theme" sits as its own ghost button under the theme grid, separate from the colour editor.
- Bottom sheets (Layout, Song info, Music) close cleanly on backdrop tap.
- Library row dividers track the theme instead of painting a stark white hairline.

### Fixed
- Lyrics no longer wash out on light chart themes (Sepia, Sunday Light, Vellum) — text colour now follows the active theme everywhere.
- Lyric line spacing + section spacing sliders now actually change the rendered text. Hardcoded line-height classes inside SectionBlock were shadowing the new CSS vars.
- "+ New theme" now actually saves the theme it creates (two back-to-back settings updates were clobbering each other).
- Layout bottom sheet stops reopening half-collapsed after a drag-to-close.
- Chart header no longer slips behind iOS Safari's collapsing URL bar.
- Header scroll-collapse no longer thrashes when a scroll lands near the threshold.

## 0.4.1-pre-alpha — Team sync fixes
*May 2026*

### Fixed
- Band cues, key changes, and other edits made by one teammate now reach everyone else. Previously they were uploaded but silently dropped when other devices pulled them in.
- Songs with repeated section names in the body (e.g. two `Verse` blocks, three `Chorus` blocks) no longer collapse to a single block in the chart view — every section renders again in its original order.
- The "Synced — uploaded 30 songs" toast no longer fires on every sync cycle. Round-trips through the team library now leave file contents stable, so an idle library stays quiet.
- Structure entries that don't exactly match a section header (e.g. `Verse 1` vs `## Verse 1:`) still line up — trailing punctuation and casing are ignored when matching.

## 0.4.0-pre-alpha — New look: Midnight theme, brand kit, tidier drawer
*May 2026*

### Added
- Official **setlists.md brand kit** is now live across the app: new app icon, favicon, and wordmark. The brand wordmark appears on the loading splash, sign-in screen, onboarding hero, and the mobile drawer footer (when signed out).
- New **Midnight** theme — the legacy navy surface returns as a third theme option alongside Light and Dark, and is now the default for fresh installs.
- The mobile hamburger menu has a **What's new** row with a brand-teal dot when a new release is waiting; tapping it lands you straight on these notes.
- Guests now see a quiet **Compare plans →** link on both the mobile drawer and the desktop Account profile, so the marketing hook is reachable without crowding the Sign in button.
- The Settings → About panel leads with the brand mark and the colored setlists.md wordmark; signed-in users get a friendly "Hi, ⟨name⟩." line beneath it.

### Improved
- Lydian Teal is now the exact brand primary, with Mist, Vetiver, Bone, and Stage joining the palette.
- Dark mode shifts to a warmer "Stage" black and light mode to a softer "Bone" paper, matching the brand kit.
- App name reads as "setlists.md" everywhere in the UI, page title, and PWA install card.
- Mobile drawer reworked: the Songs/Setlists counters are gone, the rainbow Upgrade-to-Pro pill no longer appears for guests, and Preferences / Help / Install pin to the bottom of the panel so the primary buttons up top can breathe.
- Drawer gradient swaps its bottom-right plum spot for Vetiver (#3B5A52), keeping the wash fully inside the official Lydian Teal palette.
- Midnight tints card hovers, the New Song dropzone, and other surface chrome with a subtle navy hue so they stop reading as cold gray on the navy page.
- Dashboard search dropdown and "Recently Edited" dividers follow the active theme instead of the legacy dark chrome.
- Bottom navigation drops the sliding indicator circle; the active tab is conveyed in brand teal alone.

### Fixed
- Dashboard scrolls correctly again when the team/church top bar is showing — previously the page clipped instead of scrolling under the banner.
- Drawer "What's new" tap now opens the panel directly instead of dropping you on the Settings hub.
- What's new release row wraps to a second line on narrow screens instead of truncating the date to "May…".

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
