# Next session — the Reader, element 28 (the ☰)

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-04. State: `0.17.0-beta.66` on
> `claude/reader-menu-element-28-qn9ofq`. `beta` is at **beta.44** — the
> owner asked (2026-08-04) for rounds to go to the **feature branch only** so he
> can compare against `beta`. 884 tests, 0 lint errors (8 pre-existing
> warnings)._

---

## Start here

1. **This file.**
2. **`docs/READER.md`** — the element-by-element decision log. **The important
   one.** Every element carries a decision the owner made and the reason behind
   it. Treat them as settled; don't re-open them.
3. `CLAUDE.md` — how the app works.
4. `docs/PLAN.md` §1 — what is parked and in what order.

Ignore `docs/views-vision.md` and `docs/views_questions.md` — scrapped design.

**Do not raise graduating the `unifiedReader` flag.** The owner has asked three
times to stop mentioning it. It is his call and it is not close.

---

## Working agreement (the owner's, stated repeatedly)

- **One element at a time. Ask the questions and let him decide BEFORE
  building.**
- Build exactly what is asked. **No adjacent settings, no knobs nobody
  requested.**
- **Ship every round** — he tests on his phone. A description of a change is not
  a change. Push the **feature branch only** for now.
- Batch the **questions** (4–6 at a time; he answers them all in one go).
  Serialise the **builds** — anything visual goes one at a time, because "it
  doesn't feel right" only surfaces on the device.
- > **If he says something looks wrong, IT IS WRONG.** Go and measure it in the
  > code before explaining why it should be fine. Sessions have lost three
  > rounds each to explaining instead of measuring, and shipped "fixes" that did
  > nothing. Every root cause is in `READER.md`'s trap list.

---

## Where the walk got to

**Element 1 (the top bar) is CLOSED** — 2026-08-04, after eleven rounds. It
turned out to contain all of **edit mode**, so that is what most of those rounds
were. Shipped in it: an orange edit chrome, structure editing by dragging the
song map, per-section lyric/source editing, chord replacement, undo + an undo
toast, "New version", pull-down-to-finish, the set-bar progress line, and a
persistent setlist rail.

Two surfaces were **split out of it as elements of their own** rather than
polished inside it a twelfth time:

| # | Element | State |
|---|---|---|
| **28** | **The ☰ menu** | **NEXT — this session.** |
| **29** | The setlist rail | Shipped as a persistent strip; owner: *"it will require some work in the future. Not quite now."* |

Then: element 2 (the ribbon, mostly settled by edit mode), then the 14–27 table
in `READER.md` with the owner's answers already recorded verbatim.

---

## Element 28 — the ☰. What is actually there today

Read `READER.md` → **"The ☰ menu — what actually belongs in it"** first; it is
the brief, and it already carries the owner's constraint (*"there would be more
options than just the visual"*) plus a candidate list.

The facts to check before designing anything:

- **Two menus, and NOT behind one glyph** (measured 2026-08-04). Standalone it
  is a three-line **☰**, top-LEFT → `ReaderMenu.jsx`. **Embedded** (the Song
  Hub, the side peek) it is the literal text **"Aa"**, top-RIGHT of the hub's
  tab header → **`AaMenu.jsx`**. Two glyphs, opposite corners, the SAME
  `aria-label` ("Display options"). And with the flag on, seven of `AaMenu`'s
  twelve controls do nothing in the hub — parked by the owner, `PLAN.md` §1.2
  #3b. That is deliberate (`READER.md` → "The hub view"): the hub is a
  browsing surface with a fixed look and giving it the reader's menu would
  reconnect two surfaces that were deliberately disconnected. **Do not
  "unify" it without asking.**
- The ☰ is **disabled, not removed, in edit mode** — dropping the button would
  change the bar's shape the moment you press edit and everything else would
  jump left.
- `resolveReaderConfig(settings, { embedded: true })` **ignores `settings`
  entirely** and returns `HUB_VIEW`. Deliberate — the hub view is the Reader
  with the settings wire cut. Do not reconnect it.
- What a view may *do* lives in the `VIEW` table in `src/lib/readerConfig.js`
  (`can.transpose`, `can.saveKey`, `can.practiceTools`, `can.editSong`,
  `can.switchArrangement`, `can.writeNotes`). If a menu row belongs to some
  views and not others, that is where it is expressed — not in the menu.
- Any new reader setting must be added to `PORTABLE_PREF_KEYS` or it will not
  follow the user across devices.

---

## Just shipped (beta.66) — element 28, rounds 1–6

| What | Where |
|---|---|
| **Three tabs — Style · Layout · Music.** No root list, no drill-in, no back | `ReaderMenu.jsx` |
| **Notes left the ☰** for the setlist rail (element 29). ⚠ `song.notes` now appears NOWHERE in the reader, and the rail only exists inside a setlist | `ReaderMenu.jsx` |
| **The phone shape is a DOCK — the screen splits 70/30.** `Reader`'s root was the scroller; it is now a flex column with the scroller as `flex-1 min-h-0` and the dock as `flex: 0 0 30%`. No scrim, no drag, not portaled. The sheet and the push-down were both built, tried and deleted | `Reader.jsx`, `ReaderMenu.jsx`, `SetlistReader.jsx` |
| **The ☰ lights up while open** (`--chord`, like the practice icon). It was a ✕ for one round — two ✕ in one bar — and the owner reversed it. **Edit closes the ☰** | `ReaderTopBar.jsx`, `Reader.jsx` |
| **Style tab grouped** — Lyrics · Chords · Spacing · Tabs, two controls to a row, using **`AaMenu`'s** controls (`PanelControls`). The mockup's `MiniStepper`/`Seg` are gone | `ReaderMenu.jsx` |
| **Themes are a carousel with arrows**, and **locked themes are SHOWN dimmed with a padlock** + "Unlock N more themes". They used to be filtered out entirely | `ReaderMenu.jsx` |
| **Free vs Pro decided** — legibility is free (all sizes, all spacing, tab size/grid), taste is Pro (full themes, fonts, colours, tab colours). `onUpgrade` threaded App → reader | `ReaderMenu.jsx`, `App.jsx` |
| **Field labels** Geist Mono 10px ALL CAPS → sans 12px/600 sentence case · **theme ring** was two rings, now one · **reader theme** (`chartOverlaySurface`) · **Columns gated at 768** | `ReaderMenu.jsx`, `readerSurface.js` |

| **Everything is at the reader's size** — `PanelControls` takes `size`: `md` (the hub's Aa, unchanged) and `lg` (the ☰). The mockup's `Seg`/`MiniStepper` are deleted, so there is ONE pill style in the menu now | `PanelControls.jsx`, `ReaderMenu.jsx` |

**Next in element 28: the Layout tab, then Music** — the owner is doing Layout
"in the morning". Layout is nine controls in a flat column: it now has the right
pill and the right size, but NOT the grouping the Style tab got. Its nine do not
fall into obvious buckets the way Style's did, so bring a grouping proposal
before building.

⚠ **The dock is 30% and the controls are now bigger** — roughly 2½ rows visible
on an 800px phone. The owner chose 70/30, so it was left alone; if Layout feels
cramped the dial is `flex: 0 0 30%` in `Reader.jsx`.

---

## Known-open, carried out of element 1

- **§7 #13 — two chord pickers, and underneath them two chord MODELS.**
  `ArrangeTabV2` uses `{ plainText, chords: [{ pos, chord }] }`; the reader and
  the `.md` use `[C]inline` strings. This is why the reader can replace a chord
  but cannot yet *add* one to a word that has none, and why "just do it like the
  editor does" does not transfer. Unify the model first.
- **§7 #14 (prio 2) — draggable song sections on the page**, with a `+ section`
  at the end. Parked deliberately: the map's drag may turn out to be enough, and
  two drag systems on one screen is a cost.
- **Element 13 note:** the owner asked that the post-practice screen show a
  summary of what was changed in the session. Do it when 13 comes round.
- **Follow-the-leader indicator:** option (b) — the chrome carries the state, no
  new element in the bar. Build it with the follow-the-leader slice (element 25).

---

## True, and easy to get wrong

- **The Song Hub renders `Reader`, not `ChartView`,** when the flag is on. Three
  places can cause a "hub theme bug": the reader, the chart, and the hub's own
  card. `PLAN.md` §1.2 has the warning box.
- **`min-h-0` on every small control.** `button { min-height: 36px }` (44px on
  phones) lives in `@layer base` and beats every `height` utility. Four rounds
  lost to it, in three different places.
- **CSS custom-property cycles** are invalid at computed-value time and unset
  the whole subtree. Every fallback must be a literal or name a *different*
  property.
- **React's synthetic touch listeners are passive** — `preventDefault()` in an
  `onTouchMove` prop is a no-op. Native listener, `{ passive: false }`, in an
  effect.
- **An effect that owns a gesture must not depend on anything that changes**, or
  its cleanup tears down the gesture mid-drag. Mount once, read the moving parts
  from a ref. (`StructureRibbon`'s drag; `Reader`'s pull-to-finish.)
- **Tempo cannot come from a YouTube link.** No BPM in the IFrame API, and the
  audio can't be analysed from a cross-origin embed. Tapping is the answer, and
  it is built.
- **`applyKeyHistories` is reference-preserving on purpose.** A map that
  re-mints every object reintroduces whole-library IndexedDB rewrites on launch.
