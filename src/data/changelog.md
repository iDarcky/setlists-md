# Release Notes

A running log of what's new in setlists.md. Newest releases first.

## 0.17.0 — A new way to add songs, and libraries you can shape
*July 2026*

### Added
- **Add a song, all on one screen** — search, import and blank song together instead of behind tabs. Drop a file anywhere on it; on a phone Import opens your files straight away.
- **Import a chord chart from a PDF** — drop one in and the chords, lyrics, sections, key, writers and play order come across. Romanian charts are understood too: STROFĂ, REFREN, PRE-REFREN and PUNTE become verses, choruses and bridges. Scanned or photographed PDFs say so rather than importing an empty song.
- **Check a pasted song before it becomes a chart (Labs)** — paste anything and see the sections we found, each with a label you can tap to change. Blocks that repeat are marked as the chorus; join two blocks together or drop the ones that were website clutter.
- **Repeat marks are understood** — `//: … ://` and `|: … :|` come off the lyrics and turn into the play order, so a chorus written once but sung twice is played twice. Counts like `://3` work as well.
- **Play order beside your chart on a wide screen** — a list down the left with real section names: drag to reorder, ＋ to play a section again, × to drop it, click to jump there.
- **Songs library + (Labs)** — extra columns (CCLI, year, length, arrangements, themes), a "used in setlists" count, group-by, data-quality quick filters and bulk tagging. Turn it on in Settings → Labs.
- **Setlists library + (Labs)** — find a setlist by a song inside it, see total length, filter by draft or date, and duplicate or save a setlist as a template.
- **All your filters in one place** — key, tempo, theme, language, year, scripture, moment and tags now live in a single Filters button on both libraries, as a full-height sheet on phones.
- **Choose what your cards show** — pick which details appear on song and setlist cards, remembered per device.
- **Select several at once** — press and hold on a phone, or use the new Select button on any device, then tag, add to a setlist, duplicate or delete the lot. Less-used actions sit under "…".
- **Cover art on song cards** — album art from a linked Spotify or YouTube track, with a brand-coloured placeholder when there's none.
- **Next up** — the soonest upcoming service gets its own card at the top of the Setlists list.
- **A notifications page of its own** — reachable from the bottom bar, with one button to mark everything read or clear the lot.
- **Hamburger menu (Labs)** — a restructured mobile menu with a tappable account card and a full-width Space switcher.
- **Account panel (Labs)** — drops the hamburger entirely: your avatar opens a single sheet that slides up from the bottom, with your Spaces and the menu together.
- **One reader (Labs)** — the four separate reading screens become a single viewer. A display menu opens under the top bar and pushes the chart down instead of covering it, so you can see every change as you make it: text sizes, chord names, columns, top bar, where the structure sits, section style and heading, pinned headings, and repeats. Turn it on in Settings → Labs.
- **Tap a chord to see how it's played** — any chord in the reader opens its guitar shape, and only that one. No strip of diagrams taking up the screen for the one chord you didn't know. The shape is the chord as written, so a chart that says G shows you G. Part of Pro.
- **Choruses really are heavier now** — a chorus, refrain or bridge was supposed to sit with more air around it than a verse, and it never did: the check that decides which sections a song leans on was comparing capitalised names against lower-cased ones, so it always said "no". Numbered sections ("Bridge 1") count too. They now also step in slightly from the verses.
- **The song page's Chart and Lyrics tabs are different again** — if you'd ever turned chords off elsewhere in the app, the Chart tab quietly became a second Lyrics tab. Your choice of tab now wins, in both the new reader and the old chart.
- **The song page is its own thing now** — it shows the lyrics and the chords in one fixed, readable look. Chart themes and the Aa display settings no longer reach it; those belong to the reader, which is the screen you actually perform from. The editor preview, the side panel and the song page now all look the same as each other.
- **The set across the top (Labs)** — the reader can show the app's original player bar instead of the song structure: a progress line for the whole service and every song as a chip you can tap, with breaks marked. Under the top bar, in the display menu.
- **The song map is back on the song page** — it had quietly disappeared from the top card for anyone using the new reader.
- **The song page and the editor preview follow the app's theme**, instead of wearing the stage theme — a white chart card in a dark app read as broken rather than as a stage.
- **One way to show a repeat, not two** — "As before" and "Condensed" had become the same thing, so there's just Full and Condensed now.
- **Repeated sections read as a small pill** — a repeated chorus now shows as a compact `↩ Chorus` tag in the section's own colour, the same treatment the PDF export uses, instead of a full-width box that took up as much room as the section it was standing in for. Still tappable to jump back to the first one.
- **Choruses step in** — Chorus, Refrain and Bridge sit slightly indented from the verses, so the shape of a song is readable from a music stand without reading a word of it.
- **Print / Save as PDF works again** — the controls in the print preview (columns, size, font, chords, colours) were dead: the small script that powers them was being left out of the offline bundle by mistake, so it never loaded in the installed app.
- **Members can no longer change a library they only have read access to.** The buttons were already hidden, but a few paths still let an edit through — it would look saved and then quietly disappear on the next sync.
- **The ＋ between lines now sits in the margin**, clear of the chords, and it's bigger and easier to spot.
- **Remove actions are a softer red**, and the tag and note removes are red too.
- **The songs library was hiding songs, and it's fixed** — it was showing an alphabetical page with holes in it: the list was cut to a page BEFORE it was sorted, so a song starting with "A" that happened to sit far down in storage was dropped before the sort ever saw it. It now sorts first and pages after, so the first 50 you see really are the first 50 in the order you chose, and scrolling loads the rest.
- **"clear" is now "remove", and both are red** in the setlist editor, so the actions that take something away look like it.
- **The click waits to be asked (Labs)** — tapping the metronome in the reader now opens the practice row without starting a sound; the row's own play button starts it. Tapping to check a tempo no longer fills a quiet room with a click.
- **The section highlight stopped guessing** — a song that fits on the screen no longer lights up its last section the moment you open it, and songs shown at rest (in the song page, the editor preview, the side panel) don't highlight a section at all. Highlighting is for when you're actually scrolling along.
- **A hairline under the reader's top bar (Labs)**, so the song's structure reads as its own row rather than running into the title.
- **The ＋ between lines no longer sits on top of your chords** in the song editor.
- **The last section can scroll up to the top on a phone**, so it pins like every other section instead of stopping halfway.
- **One wrap-up screen at the end of a set (Labs)** — finishing a service or a practice now lands on a single screen instead of two near-identical ones, and it fits without scrolling: how long you ran, and who you served with after a service in a Space. Two ways out — View setlist and Home — always visible.
- **A click and a slow-down, right in the reader (Labs)** — tap the metronome beside the menu and a row appears above the song: a click at the song's own tempo with beat one accented, and − / + to practise under tempo (hold them to move quickly). One tap on the written tempo puts you back. Songs with a YouTube link get their backing track in the same row, with its own separate speed — slow the track right down and it stays in the same key. The click stops when you move to the next song, so it can never follow you into the wrong one.
- **Two new chart themes** — Hymnal and Hymnal Night: warm paper, antique gold chords, and muted section colours. They're the first themes to carry their own section palette, so the whole chart changes together instead of just the background.
- **A song that's been deleted says so, and you can put it back (Labs)** — a setlist item whose song is gone used to draw the same screen as a scheduled break. It now names the missing song and, if it's still in the 30-day trash, offers to restore it on the spot. There's a way past it too, because the service doesn't stop.
- **Full screen is the reader now (Labs)** — the full-screen button on the song page opens the real reader instead of a work-in-progress placeholder, so the menu, the practice tools, the structure ribbon and every display setting are all there. It fades in rather than snapping to a bright chart theme in a dark room.
- **The reader has its own menu now (Labs)** — the ☰ opens four rows instead of a display popover: **Look** (themes, text sizes, spacing, fonts, tab colours), **Layout** (columns, where the structure sits, section style, how you move between songs), **The music** (who you're playing, chord names, sharps or flats, capo) and **Notes** (the arrangement's note and every band cue in one place). Each row shows what it's currently set to. It's a sheet from the bottom on a phone and a panel beside the ☰ on a desktop, and the chart stays visible either way so you can see what you're changing. Practice stays where it was — one tap on the metronome, not buried in a menu.
- **Tell it what you're playing** — Vocals and Drums drop the chords, Guitar and Bass open their own tabs, and it says so rather than changing things behind your back. Everything stays adjustable under Display.

### Improved
- **The section you're in stays on screen** — in the new reader, the section heading pins to the top as you scroll and the structure ribbon highlights the same section, so a glance tells you where you are without reading a word.
- **Repeated sections can collapse to a line** — a chorus sung three times is written once, with a tappable "as before" for each repeat. A chorus after a key change always stays in full, because the chords have changed.
- **Tabs know what you play** — the reader picks up the instrument you're scheduled on for the service, so those tabs open and everyone else's collapse to a single line you can tap. If you're not scheduled, the one instrument on your profile is used instead. Tabs are also much smaller, numbered by bar, and never scroll sideways.
- **Tabs follow a key change** — frets shift with the key when they can. When they can't (a shift would go past the nut) the tab stays as written and says which key that is, rather than showing something unplayable.
- **Notes sit with the line they belong to** — on a wide screen they run out to the right edge on a dotted leader, like a printed chart; on a phone they sit just above the line, so you read the instruction before you sing it. A note starting with `!` shows as a warning.
- **A new song starts with somewhere to paste** — one big box, with Add section above it, instead of a bar asking again whether you wanted to import or browse.
- **Pasting from a website is tidied up on the way in** — invisible characters, odd spaces and words broken across a line wrap no longer end up in your lyrics.
- **Song details say what they're for** — hover any field to see what it actually changes: Capo shows capo shapes, Length adds up to a setlist's running time, YouTube adds a backing track.
- **The play order is always on screen**, instead of appearing only once you found a Customize link.
- **The ＋ between lines is easier to hit** and stays visible on a tablet, where there's no hover to reveal it. Sections sit closer together, so the space belongs to your chords rather than to gaps.
- **Setlist cards are now the default** — the card-based setlist editor and viewer have graduated from Labs; they're simply the setlist screens now.
- **Your account lives in Settings** — one place to edit your profile instead of two.
- **Songs and setlists look like siblings** — both lists now share one card design, one header layout, and the same frosted bar as you scroll.
- **Quick edit is mouse-only** — the pencil at the right of a song row no longer turns an ordinary tap into an accidental edit on a phone.
- **Quieter syncing** — "Synced" no longer interrupts you for background syncs; you'll only see it when you tap Sync now, which now also tells you when everything was already up to date.
- **A bottom bar that stays put** — prev and next sit on the bottom edge of the screen instead of at the end of the song, and it can name the song that's coming next, with its key, rather than only counting. Tap the counter to jump anywhere in the service.
- **Four ways to move between songs** — the bottom bar, the floating pill, faint arrows on the screen edges, or a swipe. Keyboard arrows and Bluetooth pedals work whichever you pick.
- **The setlist rail is back, and now it's on phones too** — a column beside the chart on a big screen, a sheet you pull up on a phone.
- **Breaks look like the rest of the service** — the same top bar a song has, the same bar at the bottom, and the break named once instead of three times. A break with no length no longer shows a stray "0".
- **"Roster" is now "the band"** — every screen that used to talk about rostering people now talks about the band, because that's what it is.
- **A tidier scrollbar** throughout the app.
- **The new way to add songs is now simply the way** — no longer something to switch on, and importing a PDF works for everyone.
- **The app starts lighter.** Chord fingering diagrams are fetched only if you turn them on, so everyone else downloads about 160 KB less.
- **One song list instead of three.** Cards and Compact were the same row at different spacing, so Compact has gone; the view switcher now appears only on a screen wide enough to offer the table.
- **Dark mode was redrawn.** The greys were pure neutral while the page behind them was a warm near-black, so every border and divider was a cold line on brown — a mismatch you could feel without being able to name. The whole dark palette now shares one subtle cool cast, and the page sits a little lighter, so hairlines read as hairlines instead of outlines. **Midnight** got the same treatment: the blue now runs through every border rather than stopping halfway up the scale, and its outlines are softer than they were.
- **The metronome stayed in time after you looked away.** Leaving the app or switching tabs stopped the click's timer while its clock kept running, so coming back fired every missed beat at once and then ran late for good. It now skips the beats you missed and comes back in on the downbeat. Holding − or + also lands on the new tempo immediately instead of one beat later.
- **Tapping a song in a setlist opens that song.** Practice always started from song one, however far down the list you tapped.
- **The practice row lost the scrubber** — play/pause and slower/faster, nothing else. Hunting for a position mid-practice was never the job, and the scrubber was the one control on that row you couldn't hit while holding an instrument. The song page's player still has the full transport.
- **The line under the reader's title bar** runs the full width now and carries a hint of the brand colour, so it reads as the end of the bar rather than an underline for the song title.
- **The side panel opens the whole song page** — not a stripped-down preview of it. Same tabs, same key, same artwork, same player, just in the panel. It's also never wider than the space it leaves behind, so the row you clicked stays uncovered and one click anywhere outside closes it — and clicking the same row again closes it without moving the mouse at all.
- **The Auto-hide title bar setting is gone.** The reader's title bar is one thin row now, so there was nothing left worth hiding, and a header that slides away while you're reading was a cost with no matching benefit.
- **A song with no chart yet says so** rather than showing an empty page.

### Fixed
- **Saving no longer loses a pasted song.** Hitting Save with text still waiting in the paste box used to keep the details and quietly throw the lyrics away.
- **A pasted song with no Verse or Chorus labels no longer disappears** when you turn it into a chart.
- **Add section no longer wipes a song you just pasted** — it now only appears when the box is empty.
- **Editing the play order no longer fills in "Untitled" and a key of C** on a song you hadn't named yet.
- **The + button no longer opens a file dialog** the moment you tap it.
- **The amber outline on an unset key is even on all sides** — it was doubling up at the corners.
- **The selection circle is round again on phones** — it was stretching into a tall grey capsule and sitting on top of the row's content.
- **The bulk action bar no longer turns into a black circle** floating over the list once several actions are showing.
- **The "…" menu in that bar opens** — it was being clipped away behind the bar's own rounded edge.
- **Done now leaves selection mode** instead of immediately switching it back on.
- **Filter sheets no longer show a stray white outline** on phones.
- **The structure ribbon's boxes are the right size on a phone** — a global rule that makes every button at least 44px tall was stretching each section box into a slab. Tapping them still works; they're just boxes again.
- **The structure ribbon keeps its section colours** — each box is coloured by its section type, and the one you're currently in fills solid, so the ribbon and the heading it points at read as the same thing.
- **Cover art picks up Spotify links**, not only YouTube ones.
- **Importing a PDF works without turning anything on first** — it previously needed the Labs add-a-song screen enabled.

## 0.16.0 — Notifications, reliability, and a card-based editor
*July 2026*

### Added
- **Setlist cards (Labs)** — an opt-in redesign of the setlist editor and viewer as clean cards: an identity card up top, the set as its own card, and a library (editor) or band + notes card alongside. Turn it on in Settings → Labs.
- **Per-song tweaks that stay in the set** — open a song inside the setlist editor to change its key, capo, tempo, structure or note just for that setlist, without changing the song everywhere else.
- **A note for the whole set** — jot one shared note on a setlist (e.g. "capo 2 on the acoustic, confirm keys by Friday").
- **Who's playing, at a glance** — in a team or church space, the new setlist viewer shows your band and their availability beside the set; everyone can see it, leaders still edit the roster.
- **Display controls for the editing canvas** — the editor's "Aa" now sets how the cards read while you work (notation, lyric size, chord size), separate from the "Aa" on the live preview.
- **Comment on a line** — jot a note on any lyric line (e.g. "hold", "soft") right where it belongs.
- **Undo instead of "Are you sure?"** — deleting a section, tab, song, setlist, or a song/break from a set no longer asks first; it deletes and shows a 5-second Undo with a countdown, so removing things is quick and safe.
- **Start a song by pasting** — a new blank song opens to a big paste area with a live preview; drop in a chord sheet and turn it into the cards in one step (⌘/Ctrl+Enter). Import and Browse are one tap away.
- **Name and instrument on a tab** — the tab editor now lets you name the tab and pick the instrument (electric / acoustic / bass) as you build it.
- **Save with the keyboard** — ⌘/Ctrl+S saves, and a small "Saved / Unsaved changes" marker shows where you stand.
- **Copy the running order** — copy a setlist as plain text (numbered songs with key, capo, tempo and time signature) to paste into a chat or email.
- **A heads-up before editing a past setlist** — editing a service that has already happened now asks you to confirm first.
- **Setlist links health check** — in a team space, Settings → Sync now shows whether every song in your setlists still points at a real song in the library, and offers a one-tap repair.
- **Notifications in Settings** — a new Settings → Notifications page turns lock-screen push on or off for the device you're on, with clear guidance (and the iPhone "add to Home Screen first" step).
- **Custom reminders for services & rehearsals** — set your own lead-times in Settings → Notifications (multiple, like a calendar: 1 hour, 1 day, a week — default 24h), split into Services and Rehearsals. If you're on the roster, you get a push at each time you chose.
- **A nudge to turn on notifications** — the dashboard shows a friendly prompt to enable notifications on a device that doesn't have them yet (dismissable, and only until you turn them on).
- **Notifications, front and centre** — a bell now sits in the mobile top bar (with an unread count) and opens a full notifications page with All / Unread / Schedule tabs, instead of being tucked inside the menu.

### Improved
- **The card-based song editor is now the default** — the cleaner editor with a live preview and a Source view is no longer a Labs preview; it's simply the editor now.
- **Smarter "Recommended next"** — song suggestions now also favour picks that share a theme or tag with your set, and each one tells you why it's there.
- **Reorder by dragging, on any device** — dragging songs and breaks into a new order works smoothly on touch too, with edge auto-scroll for long sets.
- **Breaks stand out** — breaks read as distinct coloured slides in both the setlist editor and the setlist view.
- **One calm Structure row** — the song map sits on a single line (and reflows nicely on a phone), with Customize right beside the chips.
- **Edit lyrics in place** — "Edit lyrics" swaps the card into a words-only box inline, just like "Edit source", instead of a pop-up sheet.
- **Adding a section drops you in** — a new section scrolls into view and opens ready for you to type or paste.
- **New tab, one tap** — "New tab" opens the tab editor straight away.
- **Song details, grouped** — the Details tab lays fields out in labelled groups, wider and easier to scan.
- **Tidier tab library** — a single "New tab" button, a friendlier empty state, and chips showing which sections use each tab.
- **Key is protected while editing** — changing an existing song's key is steered to Transpose (which moves the chords with it), so the label and the chords never drift apart.
- **Tighter lyrics** — less empty space above lyric lines that have no chords.
- **A calmer setlist editor** — field labels sit above each control on a shared baseline, date and time line up, rehearsal and tags fold away until you need them, and a divider groups the "when & where" fields apart from the rest.
- **Pick or add a service** — the Service field is now a dropdown you can also type a new value into.
- **A clearer setlist view** — the header leads with Play Live and Practice, song rows show key · tempo · time signature (no repeated artist or counts), and the band splits into "Band" and "Add to the band" cards.
- **Readiness at a glance** — the band card sums up who's confirmed, unsure, out, or hasn't replied yet.
- **The band opens instantly** — no "loading roster" flicker when you switch to it.
- **Clear the song search** — a one-tap × empties the library search after you add a song.
- **Setlists mend themselves** — if a song was re-imported and your setlists lost track of it, the app now re-links those songs automatically, and remembers each song's title so they stay findable next time.
- **Re-importing a song updates it** — importing a song you already have now updates that song in place and keeps it linked to your setlists, instead of quietly making a second copy.
- **A quieter team activity feed** — it no longer says someone "edited" a song when the app only re-saved it in the background; only real edits show up now.
- **Notifications stay on** — once you turn on push on a device, it stays enabled across app updates (no need to re-enable), and the alert now shows a crisp app badge.

### Fixed
- **Opening a setlist starts at the top** — tapping a setlist after scrolling the list no longer opens the setlist part-way down the page.
- **Spaces in the title** — you can type multi-word song titles again (a space no longer disappeared as you typed).
- **Editing words keeps your chords** — deleting a space in "Edit lyrics" no longer knocks the chords out of place.
- **A rare editor crash** when opening a display menu is fixed.
- **Team stuff stays in the team** — your band, church members, and team activity no longer show up in your Personal space.
- **One colour for rehearsals** — rehearsal times use the same blue everywhere (they'd drifted to purple and amber in a few places).

## 0.15.0 — A hands-on editor, and sync you can trust
*July 2026*

### Added
- **Drag to rearrange** — grab a section by its handle and drag it into a new place; on a phone the whole song collapses to a tidy stack while you drag, with edge auto-scroll for long songs.
- **Drag a chord to move it** — nudge a chord onto a different word instead of deleting and re-adding it.
- **Paste a chord sheet into a section** — a new or empty section now takes lyrics inline (no pop-up); paste from Ultimate-Guitar or ChordPro and it converts to chords over lyrics automatically, splitting into sections when the paste has headers.
- **Undo / redo** — step backward and forward through your edits anywhere in the editor.
- **Version history** — every save keeps a snapshot; open the history to restore an earlier version.
- **Editable play order, inline** — build a custom sequence (repeats welcome) by dragging chips right in the header — reorder, remove, or add — with no separate dialog.
- **Pre-save checks** — a quiet heads-up before saving flags empty sections, or a play order that points at a section you removed.
- **Song editor cards (Labs)** — an opt-in redesign of the editor as clean cards: an editable song header, the editing surface, and a live preview that mirrors your chart display (with its own "Aa"), plus a Source view for raw markdown.
- **Push notifications** — get told on your phone, even when the app is closed, when you're added to a service, when someone can't make it, or when a "maybe" is coming up. Turn it on per device from the notifications panel.
- **Back up your whole library** — download every song, arrangement and setlist as a single `.zip` to keep somewhere safe (Settings → Data).
- **Sync check-up** — a new diagnostic (Settings → Sync, in a team Space) compares every song on your device against the team cloud and tells you exactly what differs, plus a live "notification worker" health light.

### Improved
- **Clearer play order** — the song map now says plainly whether it's Auto (follows your sections) or Custom, and shows the sequence at a glance.
- **Calmer editor header** — fewer buttons up top; secondary actions tuck into a "⋮" menu, and on a phone the song-details header collapses to free up room for editing.
- **Delete a song from its page** — deleting moved to the song's "⋮" menu, so you no longer open the editor just to delete.
- **Navigation that fits your phone** — the bottom bar scales to your screen size, so it isn't oversized on smaller phones.
- **Faster team sync on big libraries** — only the songs that actually changed are downloaded, and importing a large library goes up in far fewer steps.
- **Quicker to load, and lighter on data** — the app starts smaller, and returning to it after an update no longer re-downloads parts that didn't change.

### Fixed
- **Menus stay on screen** — the "add section" and section-type menus flip upward near the bottom of the screen instead of being cut off, and no longer open behind other elements.
- **Cleaner section renaming** — changing a section's type no longer creates two sections with the same name.
- **Drag works on touch** — dragging to rearrange no longer selects the text under your finger.
- **Notifications actually arrive** — schedule requests, decline alerts and "still a maybe?" reminders now reach every device reliably, instead of only showing while the app was open on the right screen.
- **Two songs can share a title** — a team library no longer refuses (or quietly merges) two different songs that happen to have the same name.

### Sync
- **Members always get the latest from the cloud** — team members no longer see false "sync conflict" prompts; the cloud copy is taken automatically.
- **Resolve conflicts in bulk** — when many items conflict at once, keep all yours or all cloud in a single tap.
- **No more phantom "conflict" storms** — the whole-library conflict prompts some teams saw are gone; an edit you make while a sync is running is never quietly reverted, and two open tabs or devices can no longer trip over each other.

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
- **Song hub** — opening a song now lands on a hub: its title, key, cover art and a row of tabs (Chart · Lyrics · Details), with the chart as the default. Read it, switch arrangement, transpose, or jump into Campfire all from one place.
- **Cover art** — songs show artwork pulled automatically from their Spotify or YouTube link.
- **Lyrics tab** — a clean, lyrics-only view of any song.
- **Details you can edit in place** — see all of a song's info (artist, themes, scripture, links, key history and more) and edit it right there, without opening the full editor.
- **Keep screen awake & Lock orientation** — new General settings to stop the screen dimming or rotating while you read or perform.
- **Labs: Neutral palette** — preview a cooler, neutral-dark colour scheme across the whole app before we make it the default.
- **Setlist end time** — give a service an optional end time and it stays in "Upcoming" (and on your dashboard) until it actually finishes, instead of dropping into "Past" the moment it begins.

### Improved
- **Redesigned setlist cards** — cleaner and far more compact, with a date badge, the essentials at a glance, and a one-tap Play Live — much easier to scan, especially on a phone.
- **Tidier setlist filters** — service and tags now live under a single "Filters" button.
- **Mobile lists open as cards** by default, with the view switcher right there to change it.
- **Cleaner chart header** — the view switch (Chords / Lyrics / Song map) moved into the "⋮" menu, the display controls collapsed into the single "Aa" button, and on phones the title and the key · tempo · time line now read with a clear hierarchy.
- **Friendlier new-song editor** — a new song starts with the Title and Key blank and asks for them before saving, gently nudges for tempo and time, and edits the slide order from one place shared by the Arrange and Advanced tabs.
- **Smarter chord entry** — the chord picker opens right at your cursor and suggests the chords that fit the song's key.
- **Reading follows you** — section highlighting tracks your scroll and the final sections light up as you reach the end.
- **Tap the key to transpose** — the key in the song header is a dropdown you tap to change key, and the chart reads a touch heavier so lyrics are easier on the eyes.
- **A cleaner section map** — the structure ribbon now shows tidy bordered code boxes by default (still switchable in Settings) and sits as a quiet song map above the chart.
- **A more polished Song hub** — the Chart / Lyrics / Details tabs now match the app's main navigation, the "Aa" display and full-screen controls sit with the chart (full-screen opens a clean, distraction-free reader), and Details reads as tidy grouped sections you can edit in place with a Save bar that stays at the bottom of the card.
- **A roomier "Advanced" panel** — spacing, repeated-section density, inline cues and your instrument role now live in their own focused dialog, without repeating the size and column controls already in the "Aa" menu.
- **One tidy backing-track player** — a song's audio plays from its YouTube link with simple play / scrub controls in its own bar; the scrubber sits on the same line as the title so it stays compact, even on a phone.

### Fixed
- **New songs no longer default to the key of C** — the key stays blank until you choose it.
- **Scroll all the way to the end** — the reading views no longer cut off the last sections.
- **Backing-track audio loads reliably** — fixed a content-security setting that was blocking the player from starting.

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
