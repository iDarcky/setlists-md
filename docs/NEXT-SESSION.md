# Next session — finish element 8, then the tablet/instrument list

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-21. State: `0.17.0-beta.96`, and **`beta` is at the same
> commit**. 1067 tests, 0 lint errors (7 pre-existing warnings), build clean._
>
> ⚠ **`git checkout beta` may land you on a stale LOCAL branch.** It happened on
> 2026-08-07 and silently reverted a whole element's work in the tree. Always
> `git fetch origin beta` and branch from `origin/beta`.

---

## Where the element walk actually is

Closed: **1** top bar · **2** the ☰ · **3** structure ribbon · **4** section
heading · **5/5a** notes and the band cue · **6/7** chords and lyrics · **19**
capo. Closed this session, and not numbered elements: the **`unifiedReader`
graduation** and the **Practice/Live union**.

**You are on element 8 — key change.** Most of it is done; it is deliberately
NOT closed. See "What is left in element 8" below.

After 8: **9** tabs · **10** getting to the next song · **11** chord diagrams ·
**12** practice tools (⚠ carries a known correction — the metronome must not
start on tap) · **13** the finale. Then 29, then the 14–27 table.

---

## The working agreement (the owner's, restated)

1. **One element at a time.** Ask the open questions and let him decide **before
   building**. Batch them — 4–6 is fine.
2. **Build exactly what is asked.** No adjacent settings, no knobs nobody
   requested.
3. **Ship every round to the feature branch only.** He tests and says when it is
   done; you promote at the close.
4. **Serialise visual builds** — one at a time.
5. **"IF I SAY SOMETHING LOOKS WRONG, IT IS WRONG.** Go and measure it in the
   code — and in a real browser — before explaining why it should be fine."
   ⚠ Corollary, earned twice more this session: when you measure and **cannot**
   reproduce it, say so plainly with what you tried and ask for the missing
   condition. Both times the bug was real and conditional, and both times the
   missing condition was one sentence from him ("all songs with ș or ț **on the
   last line**" turned an unreproducible report into a diagnosis in ten minutes).
6. **He is often asking, not asserting.** *"Is this a good idea or not?"* means
   he wants your opinion. Answering by quoting his own hesitation back at him is
   dodging, and he will say so.
7. At the close: finish, promote to `beta`, update the docs, write this file, and
   give him the next super prompt **in chat**, not only in the file.

### How to measure in a real browser

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `playwright`
is installed **globally** (`/opt/node22/lib/node_modules`), so symlink it into
your scratch dir (`ln -s /opt/node22/lib/node_modules node_modules`) and drive
the real app. `npm install` first — `vite` is not in the image.

- ⚠ **Seed IndexedDB from a NON-APP page on the same origin**
  (`/manifest.webmanifest` works). Seeding with the app running loses the race:
  its debounced `saveSongs` fires with the in-memory demo library and DELETES
  ids that are not in it, so your seeded song is gone before the reload reads it.
  Keys: settings `setlists-md:settings`, songs `setlists-md:song:personal:<id>`
  with the index at `setlists-md:songidx:personal` (`{ids:[…]}`), setlists
  `setlists-md:setlists:personal`.
- ⚠ **Scope every chord query to `[data-section-index]`.** `getAllByText('G')`
  matches the KEY PILL in the top bar, and a count over the scroller picks up the
  ☰ itself (on desktop the menu lives inside that scroller). Both produced false
  results this session — one "confirmed broken" that was not.
- The SETLIST reader is a ROUTE, not a `[role=dialog]`.

---

## What is left in element 8

**The slot-level key change, and it is the whole remaining job.** Owner's case:
*"Chorus in C then Verse 2 then Chorus again but this time in D."* Unrepresentable
today — `{modulate}` lives in the section BODY, so `once` gives C then C, `every`
climbs Verse 2 and everything after, and the only workaround is duplicating the
chorus into two sections differing solely by key.

The fix is to let `structure` entries carry the change:

```
structure: [Verse 1, Chorus, Verse 2, Chorus ↗+2, Bridge]
```

That is an **`.md` format change** and a MAJOR-version conversation, like bars
(element 32). It would also make `once`/`every` mostly redundant — a body-level
marker would only mean "this song climbs internally". **Ask him before building
it**; he chose `once` over this once already, reasonably, because it was smaller.

Done in element 8 already: marker trimmed 68.1 → 36.9px (chip at chord size —
do not go below it); the ribbon's `C ×2` run splits at a key change; `once` /
`every`; and the "a repeat after a key change renders in full" promise verified
against a control rather than assumed.

---

## His open list, in his words, with what I found

1. 🔴 **The Romanian stray dot.** *"All songs that have ș or ț on the last
   line"*, both orientations. **Diagnosed, not fixed** — read the boxed note in
   `SectionBlock` before touching it. It is INK OVERFLOW, not fragmentation:
   measured, a section's box bottom and its last line's box bottom are the same
   pixel with `padding-bottom: 0`, so the comma under ț/ș (U+021B, U+0219) falls
   outside the section and multicol paints it at the top of the next column.
   Two fixes tried and reverted with measurements (a spacer child: +26.7px per
   section, trap 15 from the other side; padding + negative margin: net layout
   zero is also net effect zero). **The fix has to accept ~0.15em per section.**
   Wants screenshots, not blind measurement.
2. 🟡 **Your instrument should follow the SCHEDULE.** *"You're scheduled as
   electric guitar → you see the electric guitar view. Scheduled as instrument +
   vocals → instrument takes priority."* `src/lib/myInstrument.js` already reads
   `team_schedules.role`, so the plumbing exists; what is missing is **electric
   guitar as a distinct option** and that precedence. ⚠ Also: the role picker
   works in the setlist reader (verified — chords `G C D` before Vocals, none
   after) but is **dead in the Song Hub**, which passes a hard-coded
   `displayMode="chords"` prop that beats `settings.displayMode` by design.
3. 🟡 **Tablet UI is too small.** ⚠ NOT the reader — measured edge-to-edge and
   two-column at 820px. He means other screens; ask which before changing
   anything.
4. ⬜ **Empty chords for an intro** — a chord-only line with no lyrics. Check the
   parser round-trips it before assuming the gap is in the editor.
5. ✅ **Tempo history — BUILT.** *"show all the used tempos somewhere"*. It did
   mirror `keyHistory` cleanly, but only after the thing that made it
   impossible turned out to be already fixed: `songInfo.js` carried a ⚠ saying
   nothing records a tempo per performance, naming `SetlistItemRow`'s field
   that writes straight back to the SONG — and that row is the LEGACY one,
   unreachable since `SetlistBuilder` started defaulting `cards = true`. The
   live row (`SetlistCardRow`) has been writing `item.tempo` as a per-setlist
   override all along. So the resolved performance tempo is
   `item.tempo ?? arrangement.tempo`, exactly parallel to
   `arrangement.key + item.transpose`.
   - `performanceHistory.js` is new: the walk over past-dated setlists, the
     reference-preserving apply and the save-time diff, once, with `valueOf` as
     the only difference between the two histories. `keyHistory.js` is now a
     thin skin over it (its 15 tests unchanged and green); `tempoHistory.js` is
     the twin.
   - Three display sites: the reader's song panel ("Usually played at ♩ 72 ×5 ·
     76 ×2"), the hub's Details tab ("Tempo history" chips) and the editor's
     metadata panel ("Most played at").
   - ⚠ **The reader's panel stays quiet when the one recorded tempo equals the
     song's own** (`tempoHistoryIsInteresting`) — that surface already prints
     ♩ 118 six lines up, and a second row saying 118 under a longer label is the
     duplication `songInfoFacts` exists to prevent. The Details tab does NOT
     apply that rule: it is the catalogue, where "6× at 118" is a fact.
   - ⚠ **It hit trap 23 while being built.** `songInfoFacts` returning a new
     fact changed nothing on screen, because `SongInfoView`'s `Body` does not
     render the fact list — it *cherry-picks by label*. A render test caught it;
     reading the producer would not have. Anything added to `songInfoFacts`
     needs a matching pick in `Body`.
6. ❓ **"Changes in the reader should reflect everywhere"** — he was unsure
   himself and will re-check. Best guess: a key changed in LIVE is session-only
   by design (`can.saveKey` false), which now applies whenever the clock opens
   live.

---

## What changed under you this session

- **One reading route.** `setlist-read` + `setlist-finale`. `readerMode` is state
  in the history snapshot, not a route name.
- **The flag is gone**; `Reader` is the only reader everywhere. The seven legacy
  surfaces are a closed dead island — imported by nothing live. Deleting them is
  the moment to drop the `showChords` fallback (they were its only writers).
- **`lib/openingMode.js`** decides live vs practice from the clock. There is
  deliberately **no manual way into live** — the ☰'s Live row exists only while
  live, as the way out. If a wrong setlist time bites, the fix is the time.
- **`lib/songFlow.js` → `sectionModPlan`** returns `{ offsets, fires }`.
  `SectionBlock` takes `modFires` and must agree with it exactly.
- **`parser.js` → `modulateMarker` / `serializeModulate`.** `every` is ABSENT,
  not `false`, on a bare marker — the sync engines hash these objects.
- **`WakeLockExplainer` is deleted.** Live acquires the wake lock; `keepAwake`
  moved into the ☰.
- **Settings lost Chart Defaults**, and the ☰ lost 23 Reset buttons (only the
  four steppers keep one).
- **`onboardingComplete` and `seenLiveIntro` are portable prefs** — the intro no
  longer repeats per device. ⚠ It still shows once on a brand-new origin: the
  gate runs at boot, before any cloud read.

## Traps this session added

Full list in `READER.md` → "Traps that have already cost time"; 20–24 are new.
The two that will bite hardest:

- ⚠ **`break-inside: avoid` does not contain ink** (trap 21). It has now been
  mis-diagnosed as the cause of the Romanian dot twice, a year apart.
- ⚠ **A control rendered with no writer behind it** (trap 23). `onUpdateSettings?.()`
  is how a missing prop becomes silence instead of a crash. When you write `?.`,
  decide what it means for the thing to be absent.

## Things that are built and must NOT be deleted

- **`src/sync/merge.js`** — field-level three-way merge, 11 passing tests, wired
  to nothing. Owner, 2026-08-10: *"Ok, we need to wire it, I got it."* It has an
  owner; it needs a session.
- **The seven legacy reading surfaces** — deliberately left in the tree.
