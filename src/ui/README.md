# The design system

51 primitives. This file says **which one to reach for**, so the next person
doesn't add a 52nd because they couldn't tell `ScreenHeader` from `PageHeader`.

Rule of thumb: **if you're about to build a header, a sheet, a menu or a button,
it already exists.** If what exists is wrong, change it — don't add a sibling.
`Button2` and `PageHeaderLegacy` were exactly that, and they survived a year
because nothing ever forced the choice.

---

## Buttons

| Use | Primitive |
| :--- | :--- |
| Any button | **`Button`** |
| Icon-only button | **`IconButton`** |

`Button` takes `variant` × `size` × `loading`:

- **variant** — `brand` (primary CTA) · `primary` (neutral strong) · `secondary`
  (default) · `ghost` (in-place, low emphasis) · `warning` · `error` (soft, in
  forms) · `danger` (solid red, destructive confirm)
- **size** — `xs` · `sm` · `md` (default) · `lg` · `icon`
- **loading** — shows a `Spinner` and disables. For a form with several buttons,
  hold a `busyTarget` string in state so one spins while the rest stay idle.

There is no `success` variant. Add one to `Button` if a surface needs it — do
not fork the component.

## Headers

Three, and they are genuinely different jobs:

| Surface | Primitive |
| :--- | :--- |
| A main section (Library, Setlists, Settings) | **`PageHeader`** — sticky blurred bar, big title, optional `actions` / `onBack` / `onClose` |
| A reading surface (Chart, Practice, Live) | **`StageHeader`** — three rows: title + exit · meta + actions · structure ribbon. Collapses on scroll |
| A secondary view that always has a back button | **`ScreenHeader`** — required `onBack`, optional `subtitle` |

⚠️ **Open consolidation.** `PageHeader` can already do everything
`ScreenHeader` does (`onBack` is optional there, required here) and has 9
importers to `ScreenHeader`'s 2. `ScreenHeader` should be absorbed into
`PageHeader` — it is a visual change on two screens (`RecoveryScreen`,
`SetlistBuilder`), so it wants eyes on it, not a blind swap. Do it in the
Settings or setlist-editor pass.

## Overlays

| Use | Primitive |
| :--- | :--- |
| Centered modal, any size | **`Dialog`** |
| Confirm a destructive action | **`useConfirm`** / `useConfirmHook` — never `window.confirm` |
| Ask for one text value | **`PromptDialog`** — never `window.prompt` |
| Bottom sheet, plain titled content | **`BottomSheet`** — drag-to-dismiss, `SheetField` for rows |
| Bottom sheet, grouped drawer-style rows | **`MobileSheet`** — `SheetGroup` / `SheetGroupLabel` |
| Slide-in side panel | **`SidePeek`** (in `@/app`) |
| Anchored popover / menu | **`PopMenu`**, or **`OverflowMenu`** for a ⋮ |

⚠️ **Open decision — two bottom sheets.** `MobileSheet`'s own comment says it
exists "so every sheet shares one set of mechanics instead of each screen
re-deriving them and drifting apart" — but `BottomSheet` still has 6 importers
to its 1. They are not accidental twins: `BottomSheet` is a plain titled sheet,
`MobileSheet` is the drawer aesthetic (gradient surface, grouped rows,
safe-area). **Which one is the app's sheet is a design call, not a dedupe.**
Once decided, migrate the other's call sites and delete it. Until then, match
the surface you're on.

## Everything else

**Forms** — `Input` · `Select` · `Switch` · `Checkbox`¹ · `ChipInput` ·
`DatePicker` · `TimePicker` · `SegmentedControl` · `SelectCircle`

**Surfaces** — `Card` · `Separator` · `Badge` · `Chip` · `Spinner`

**Feedback** — `use-toast` + `Toaster` (never `alert`) · `UndoToastContent` ·
`OfflineBanner` · `UpdatePrompt`

**Data display** — `Highlight` (search matches, accent-correct) · `NoteContent` ·
`NotesStack` · `Avatar` / `AvatarUploader` · `CalendarWidget`

**Menus & controls** — `ColumnsMenu` · `CardFieldsMenu` · `SelectionBar` ·
`Tabs` · `EdgeNavArrows` · `FloatingNavPill` · `FloatingStructure`

**App-level** — `UpgradeGate` (wrap gated content) · `WorkspacePickerDialog` ·
`BrandWordmark` · `SearchBar`

¹ `Checkbox` was deleted in the 2026-07 pass — nothing imported it. If you need
one, restore it from git rather than writing a new one.

---

## Rules

1. **No siblings.** Fix the primitive; don't add `Thing2`.
2. **No raw `<button>`** for anything interactive — you lose focus rings,
   loading, and disabled handling. Exception: song rows in Library use
   `<div role="button">` deliberately, so they can nest interactive elements.
3. **No native `alert` / `confirm` / `prompt`** — they don't exist in an
   installed PWA shell. Use the toast and dialog primitives above.
4. **No `window.open`** — popups return `null` handles in installed PWAs and
   don't exist in native webviews. See `pdf/pdfDocument.js` for the pattern.
5. **Imports go through `@/ui/X`** from outside this folder, `./X` from inside.
   ESLint enforces it.
6. **Adding a primitive?** Add it to this file in the same commit, and to
   `features/design/LydianShowcase.jsx` if it's visual.
