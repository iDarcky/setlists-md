# Next session — the Reader, element 5 (Notes — all four layers)

> **Short-lived handoff.** It exists because a new chat session starts with **no
> memory of previous conversations** — only this repo.
>
> _Rewritten 2026-08-07. State: `0.17.0-beta.93`, and **`beta` is at the same
> commit** — elements 1, 2, 3, 4 and 4b are all promoted onto it. Start element
> 5 on a fresh branch off `beta`.
>
> The owner tests on his phone and compares against `beta`, so during an element
> ship each round to the **feature branch only** and promote at the close.
> 961 tests, 0 lint errors (8 pre-existing warnings)._
>
> ⚠ **`git checkout beta` may land you on a stale LOCAL branch.** It happened on
> 2026-08-07 and silently reverted a whole element's work in the tree. Always
> `git fetch origin beta` and branch from `origin/beta`.

---

## There is a real user. This is not a pre-launch repo any more.

Found 2026-08-07, by reading the production database rather than assuming:

- **24 accounts, three humans who actually use it.** The owner; **Centreap**
  (`r.centea00@`), who owns the *Inchinare Sincera* workspace — 108 songs, 18
  setlists, **active 20 of the last 30 days**; and Beniamin, 12 of 30.
- The other 21 accounts have **0 or 1 lifetime events**.
- Centreap's band has 8 members and 7 of them have ≤1 event — but
  `team_activity` only logs WRITES, so a member who only reads charts on a
  Sunday is invisible. **We cannot currently tell whether members use it.** A
  `last_opened` stamp on `team_members` would answer it; that is a real gap in
  a product whose thesis is team use.
- `main` is **169 commits / 20 days behind** `beta` and still on `0.16.0`. The
  live users are on `beta`, so `beta` is production AND staging at once.

**What this changes for you:** shipping a broken `beta` breaks somebody's
Sunday service. Measure before you ship, and prefer a round that is smaller
than you think it should be.

---

## Start here

1. **This file.**
2. **`docs/READER.md`** — the element-by-element decision log. **The important
   one.** Read element 5's section *and* element 4's pass above it: element 4
   already settled **where** an inline note goes (a gutter), so element 5
   inherits a decision rather than making it.
3. `CLAUDE.md` — how the app works.
4. `docs/PLAN.md` §1 — what is parked and in what order.

Ignore `docs/views-vision.md` and `docs/views_questions.md` — scrapped design.

---

## Working agreement (the owner's, stated repeatedly)

- **One element at a time. Ask the questions and let him decide BEFORE
  building.** Batch the questions (4–6; he answers them all in one go).
- Build exactly what is asked. **No adjacent settings, no knobs nobody
  requested.** He has now removed one knob for being pointless (`readerRail`)
  and declined another (a heading-size stepper) on menu-density grounds.
- **Ship every round** — he tests on his phone. A description of a change is not
  a change. Push the **feature branch only** while an element is in flight;
  promote to `beta` when he says the element is done.
- Serialise the **builds** — anything visual goes one at a time, because "it
  doesn't feel right" only surfaces on the device.
- > **If he says something looks wrong, IT IS WRONG.** Go and measure it — in
  > the code, and in a real browser — before explaining why it should be fine.
  > Every root cause is in `READER.md`'s trap list.

### Measure in a real browser. It is what elements 3 and 4 were made of.

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and
Playwright installs into the project (`npm i --no-save playwright`; import it by
absolute path from a scratch script). Seed IndexedDB directly (store
`keyval-store` / `keyval`, key `setlists-md:settings`, `unifiedReader: true`),
overwrite a demo song's `arrangements[0].sections` with a purpose-built fixture,
then drive Library → song → **Full screen**.
⚠ Scope every query to the full-screen dialog — see the two-readers trap.

**Element 4 found seven bugs this way, five of them older than the element.**
Two were pure-CSS traps that read as correct in review (`undefined` deleting a
style key; `@theme` tree-shaking JS-only tokens). One was a colour palette that
passed every contrast check and still looked wrong to the owner — *his eye is
the test for anything visual; the numbers only stop you shipping something
provably unreadable.*

---

## Where the walk got to

| # | Element | State |
|---|---------|-------|
| **1** | Top bar | ✅ closed — it turned out to contain all of **edit mode** |
| **2** | The ☰ — the reader's settings menu | ✅ closed, 15 rounds |
| **3** | Structure ribbon | ✅ closed 2026-08-06, 13 rounds |
| **4** | Section heading | ✅ closed 2026-08-06, 5 rounds |
| **4b** | Band cue | ✅ closed with it |
| **5** | **Notes — all four layers** | **NEXT — this session** |
| 29 | The setlist rail | its permanent strip is gone; the rest is open |

---

## Element 5 — Notes. What it is now

**The owner widened it, 2026-08-06:** *"element 5 should actually become notes,
and this should include all the notes, not separate as we have them right now."*
Four layers exist, designed separately, at different times, with different
rules:

| | where it lives | who sees it | state |
|---|---|---|---|
| **Band cue** (`> text`) | on the section heading | everyone | ✅ 4b |
| **Inline note** (`{!…}`) | on a lyric line | everyone | placement settled, look open |
| **Arrangement note** | `arrangement.notes`, markdown | everyone | untouched by the walk |
| **My note** (`team_notes`) | per user, per scope | you only | `notes/usePrivateNotes.js` |
| **Setlist item note** | `items[i].note`, 100 chars | everyone | element 10's neighbour |

### Already settled — do not re-open

- **An inline note goes in a GUTTER, at every width** — a strip down the right
  that the words stop before, **reserved only by sections that actually carry a
  note**. A permanent gutter measured **+24%** on a song's height. 132px in a
  wide column, 88px on a phone (`--note-gutter`, set in `Reader`).
- ⚠ **A note lands on its own line, and neither end of its cell is that line.**
  A rendered line is a chord row above a lyric row: top-aligned it sits level
  with the chords (20px adrift), bottom-aligned a wrapped line drops it to the
  second row (50.8px adrift), and `baseline` cannot help. Top-aligned, offset by
  exactly one chord row. Re-measured to 0.0px.
- **Capped at 40 characters at the input**; a leading `!` means loud.
- The **dotted leader is retired** — at 1280 in two columns it left ~400px of
  dots running across the page.

### The questions this element inherits

- Can you write a cue or a note **from the reader**, or only from the editor?
  `LyricEditor` in `ReaderSection` edits `section.lines` only — the cue is
  neither shown nor editable there. §1.2 #3d asks the same about the hub.
- Do four layers keep four treatments, or one treatment with a marker for scope?
- Does **My note** belong in the reader at all, or only in the hub?
- The ☰'s **Notes** row was built and then moved out to the setlist. Where does
  it land?
- Does the arrangement note (markdown, unbounded) need the same discipline the
  cue just got — a cap, a clamp, a place?

---

## Just closed — element 4, the section heading (5 rounds, beta.91 → beta.92)

Sizes you can read (14px, 17px on a chorus, cue always a size below), **eleven
section types in eleven colours** with saturation saying who sings, **four
frames that take no width from the words** (None · Rule · Margin bar · Tint —
Block and Card are gone), the words starting at the **left edge** of a phone, a
**note gutter** down the right, pinning tied to the **column count** rather than
screen width, `↩ BRIDGE ×3` for a run of repeats, and a tag that closes again.

Full account: `READER.md` → "The element-4 pass".

### ⚠ The lesson to carry into element 5

Element 2's was "grep both ends". Element 3's was "drive it in a browser".
Element 4's is narrower and sharper:

> **A default that is written in three places is a default in none of them.**
> `storage.js DEFAULT_SETTINGS`, `lib/readerConfig.js DEFAULTS` and
> `ReaderMenu MENU_DEFAULTS` disagreed for as long as all three existed — so no
> user had ever seen the documented default, and pressing **Reset** on a fresh
> profile *changed* a setting nobody had touched. Nothing failed. Nothing
> logged. It took rendering a real profile and comparing it against the doc.
>
> The same shape produced the retired frames (`block`/`card`) needing an
> explicit legacy MAP rather than `pick()`'s fallback, and the retired repeat
> value (`ref`) needing one too. **When you retire a stored value, map it; when
> you change a default, check every place that names it.**

---

## Known-open, carried forward

- **§7 #13 — two chord pickers, and underneath them two chord MODELS.**
  `ArrangeTabV2` uses `{ plainText, chords: [{ pos, chord }] }`; the reader and
  the `.md` use `[C]inline` strings. This is why the reader can replace a chord
  but cannot yet *add* one. Unify the model first.
- **§7 #14 (prio 2) — draggable song sections on the page.**
- **§1.2 #3d — add a cue/inline note from the SONG HUB**, without the editor.
  **This is element 5's neighbour** — the field you would type into is the one
  whose space bug was just fixed.
- **§1.1 #4 — graduate the flag and delete the old surfaces.** A session of its
  own; the owner will call it. ⚠ `PerformanceView`/`PracticeView` are the
  **only** writers of `showChords`, now just a migration fallback — deleting
  them is the moment to drop it. Settings → Chart Style goes with them.
- **Element 29 — the setlist rail.** Its permanent strip went in element 4's
  pass at the owner's request; how you *move through* a set from it is still
  open.
- **Element 13:** the post-practice screen should summarise what changed.
- **Stream A has not started** (`PLAN.md` §0) — domain, email, OAuth, staging,
  monitoring. It is the only real risk to the October 1 public beta, none of it
  is programming, and there is now a real church on the other end of it.
- **§1.2 #6 — the sync loop is root-caused and half-fixed.** The format side
  shipped in beta.93 (the parser carries frontmatter keys it does not model, so
  an older build can never delete a newer build's field). The loop that is
  RUNNING needs the stale client updated — no code reaches that device. Verify
  in a week: `select count(*) from team_activity where action='song_edited' and
  created_at > now() - interval '7 days'` should fall to roughly the number of
  songs actually edited. It was **5,482**.
- **A client build stamp is the missing diagnostic.** `team_songs` should carry
  the `__APP_VERSION__` that wrote each row. Proving "two clients, one stale"
  took an hour of diffing version snapshots; with the stamp it is
  `select app_version, count(*) from team_songs group by 1`. One column.

---

## True, and easy to get wrong

- **There are TWO readers in the DOM** with the flag on — the Song Hub's
  embedded one sits behind the full-screen one, and both render
  `id="section-N"`. Never `document.getElementById` for a section; scope to
  `scrollRef.current`. Same for any browser probe.
- **`undefined` in a style object is a DELETE.** `{...frame, x: cond ? v :
  undefined}` removes the frame's own `x`. Compose with `calc()` instead.
- **Tailwind v4 tree-shakes `@theme` variables nothing in the CSS references.**
  JS-only tokens (the `--section-*` palette) must ship in a plain unlayered
  rule or they vanish from the build — silently, rendering grey.
- **Margin collapse is doing more of this layout than the code admits.** The gap
  between sections is `max(--chart-section-gap, marginBottom)`, not the sum; a
  frame with vertical padding blocks the collapse and starts adding instead.
- **Paint order is hit-test order.** An overlay moved *under* content becomes
  untappable, including under the content's padding. Separate by geometry.
- **Firefox draws two focus artifacts Chromium does not** (`:-moz-focusring`
  and `::-moz-focus-inner`). Test round controls in Firefox.
- **The Song Hub renders `Reader`, not `ChartView`,** when the flag is on.
  Three places can cause a "hub theme bug": the reader, the chart, and the hub's
  own card.
- **`min-h-0` on every small control.** `button { min-height: 36px }` (44px on
  phones) lives in `@layer base` and beats every `height` utility.
- **Inside `overflow-y-auto`, a wrapper must GROW with its content**
  (`flex-1 min-h-0` caps it) — and on the CROSS axis a flex item needs `flex-1`
  or it is shrink-to-fit.
- **CSS custom-property cycles** are invalid at computed-value time and unset
  the whole subtree. Every fallback must be a literal.
- **`chartSurface` remaps `--ds-gray-` 100–400, 700 and 1000 only.**
- **jsdom drops `calc(-1 * var(…))`** on parse — assert on
  `getAttribute('style')`, not the CSSOM. Its `background` shorthand parser also
  throws on some values during the `cloneNode` every role query does; use
  longhands inline.
- **`mockWidth` in `reader.test.jsx` answers per query**, against a real width.
- **React's synthetic touch listeners are passive** — native listener,
  `{ passive: false }`, in an effect, for any gesture that must take the scroll.
- **`applyKeyHistories` is reference-preserving on purpose.**
