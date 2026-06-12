# Brand & Design System ("Lydian")

The single reference for how Setlists.md looks and feels. Consolidates the brand
identity, the functional color system, and component status.

---

## 1. Brand Identity

**Setlists.md** is the intelligent workspace for modern musicians — built for
speed, precision, and reliability on stage.

**Lydian** is the name of the design system. Like the musical mode it's named
after, it's bright, uplifting, and structurally sound. It's heavily inspired by
the **Vercel Geist** design system.

### Brand Voice
- **Professional** — built for experts who need precision.
- **Minimalist** — focus on the music, not the interface.
- **Reliable** — works offline, everywhere, every time.

### Design Philosophy
- **Typography** — clean sans-serif + high-utility monospace.
- **Space** — generous whitespace balanced with dense information grids.
- **Materials** — flat surfaces with subtle depth from 1px borders and soft
  shadows.

---

## 2. Visual Language

### Primary Color: `#53796F`
A professional, calm teal used for brand accents, primary buttons, and active
states. Stands out without distracting. Exposed in code as `--chord` (gold) is
reserved separately for chord coloration.

### Typography
- **Geist Sans** — primary font for headings and body text.
- **Geist Mono** — chords, metadata, and editor components.

### Materials
- `.material-page` — base background layer.
- `.material-card` — elevated containers, 12px radius.
- `.material-panel` — flat containers, 6px radius.

---

## 3. Functional Color Scale (1–10)

Every color family (Gray, Blue, Red, Amber, Green, Teal, Purple, Pink) follows
the same numeric logic, mapped to the `--ds-*-[100-1000]` tokens.

| Logic | Scale | Functional Role | Global Alias |
| :--- | :--- | :--- | :--- |
| Color 1 | `100` | Default Background | `--bg-1` |
| Color 2 | `200` | Hover Background | `--bg-2` |
| Color 3 | `300` | Active Background | `--bg-3` |
| Color 4 | `400` | Default Border | `--border-1` |
| Color 5 | `500` | Hover Border | `--border-2` |
| Color 6 | `600` | Active Border | `--border-3` |
| Color 7 | `700` | High Contrast BG | `--bg-hc-1` |
| Color 8 | `800` | HC Hover BG | `--bg-hc-2` |
| Color 9 | `900` | Secondary Text | `--text-2` |
| Color 10 | `1000` | Primary Text | `--text-1` |

### Page Backgrounds

| Token | Dark Mode | Light Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--ds-background-100` | `#0a0a0a` | `#FFFFFF` | Panels, insets, secondary containers |
| `--ds-background-200` | `#000000` | `#F9FAFB` | **Primary page/body background** |

> **Primary rule:** Use `--ds-background-200` for the page body or main
> scrollable container. Use `--ds-background-100` for cards or panels that sit
> *on top* of the page.

### Implementation Guidelines
- Prefer global semantic aliases (`--bg-1`, `--border-1`) over direct scale
  variables (`--ds-gray-100`) for generic UI.
- Direct scale variables are fine for status-specific elements (e.g.
  `var(--ds-red-100)` for an error card background).
- **No hardcoded hex values in component files.**

---

## 4. Component Status

All reusable UI components live in `src/components/ui/`, built on Geist tokens
via Tailwind v4.

| Component | Status | Notes |
| :--- | :--- | :--- |
| Avatar, Badge, Button, Card | ✅ Ready | Core primitives |
| Checkbox, IconButton, Input | ✅ Ready | |
| SegmentedControl, Select, Separator | ✅ Ready | |
| Spinner, Switch, Tabs | ✅ Ready | |
| Toast/Toaster, Tooltip | ✅ Ready | |
| BottomNav, PageHeader | ✅ Ready | |
| SongCard, SetlistCard | ✅ Ready | 16px radius |
| Dashboard, Library, Setlists | ✅ Ready | |
| Editor (all tabs), ChartView, Settings | ✅ Ready | |

---

## 5. Known Design Debt

1. **Section color contrast audit** — `src/music.js` uses hardcoded hex colors
   for song sections (Verse, Chorus, etc.). Audit these for contrast against
   Geist background tones.
2. **Leftover inline CSS** — validate no stray `style={{ ... }}` layout
   declarations circumvent the Tailwind 4px/8px grid.
3. **Advanced Modal component** — the app still falls back to native browser
   `window.confirm` in places. A unified `Dialog`/`Modal` in `components/ui`
   would standardize popover UI. (Tracked as a launch item in `ROADMAP.md`.)
