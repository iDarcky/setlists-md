# Setlists MD - Multidisciplinary Product Audit

## 1. The Developer Perspective
### Architecture & Sync Resilience
**Observations:** The synchronization engine (`sync/engine.js`) relies directly on file timestamps (`modifiedTime`) to pull changes or pushes based on file hash changes. 
**Risks:** It operates heavily on a **"Last Write Wins" (LWW)** model and there is no automatic 3-way merge or conflict resolution UI. If a user edits a song on their phone offline while simultaneously editing on desktop, the engine will overwrite the older file based on the sync timestamp. 
**Recommendation:** Implement a CRDT-based approach or prompt the user with a "Conflict Detected" screen showing both versions if a collision happens.

### Maintainability & Tech Debt
**Observations:** The codebase is well-structured and uses modern technologies (Vite, React 19, Tailwind V4, IndexedDB). `parser.js` acts as the single source of truth for converting Text to the internal `Song` object.
**Scalability:** Adding a parser for `.cho` or PDF is straightforward—you just need a function that maps `.cho` to the `Song` representation. However, the custom regex markdown parsing is tightly coupled to string processing, which might make edge-cases hard to scale.

### Test Coverage
**Observations:** There are **zero** automated tests (no Jest or Vitest dependencies in `package.json`).
**Vulnerabilities:** The custom Markdown parsing engine (`parser.js`) is highly susceptible to regression bugs. A user forgetting a closing bracket `[G` could potentially throw fatal errors mapping line placements, crashing the React view. 
**Recommendation:** Immediately implement unit testing for `parser.js`.

### Battery/Resource Drain
**Observations:** After reviewing the code, there is **no usage of the `navigator.wakeLock` API**. 
**Impact:** A musician relying on this app on stage will have their tablet screen go dark in the middle of a 2-hour gig due to system inactivity timeouts. React/Vite rendering is efficient, but without virtualized views for large setlists, memory usage could grow.
**Recommendation:** Add Wakelock API to `SetlistPlayer` immediately.

---

## 2. The Legal & Compliance Perspective 
### User-Generated Content (UGC) Liability
You are protected. The app handles data predominantly on the client side (`idb-keyval`) and syncs directly to the user's personal cloud drives (Dropbox, GDrive, OneDrive). 
You are acting as a "Bring Your Own Storage" client, meaning you are completely shielded from copyright hosting liability, as the files live in the users' personal infrastructure.

### Worship Context (CCLI)
The app is well-prepared. `parser.js` actively parses out `ccli:` metadata from the frontmatter. This allows churches to easily maintain compliance for CCLI reporting while projecting or distributing lyrics directly via Setlists MD.

### Data Privacy
**GDPR/CCPA Compliance:** The privacy overhead is practically zero. You do not maintain user databases, servers, or auth systems; the app relies securely on OAuth tokens that live on the device.

---

## 3. The QA / Hardware Tester Perspective
### Device Fragmentation
Being built on Tailwind + HTML, responsiveness is good. However, Android tablets generally have weaker WebView rendering performance compared to iPads. A 5-year-old Android tablet might struggle parsing and rendering a 40-song setlist simultaneously without optimizations like React Window.

### Peripheral Integration (AirTurn / PageFlip)
The app correctly intercepts page-turning! In `storage.js`, the default settings correctly map `pedalNext: 'ArrowRight'` and `pedalPrev: 'ArrowLeft'`. 
Since standard Bluetooth pedals emulate QWERTY keyboard clicks (Up/Down or Left/Right), the app naturally audits perfectly with gig hardware out of the box.

---

## 4. The Customer Success / Onboarding Perspective
### The "Blank Canvas" Problem
Setlists MD has solved this beautifully. `App.jsx` detects a new user (`songs.length === 0 && !savedSettings.onboardingComplete`) and deliberately prevents them from looking at an empty database. Instead, it seamlessly boots `Onboarding.jsx` and injects `DEMO_SONGS_MD` to immediately populate their library, allowing them to experiment with the syntax instantly.

### Migration Problem
There is high friction here. Moving 300 existing songs over requires the user to already have them in a Markdown format to use `handleImportSong(...)` or `importSetlistZip`. 
Without an "Import from OnSong backup" or a bulk `.doc/.pdf/.cho` converter, boarding power users from existing platforms will be a massive roadblock.

---

## 5. The Competitor / Market Analyst Perspective
### Feature Parity vs. Innovation
**Table Stakes Missing:**
- Native PDF rendering.
- Auto-scroll (Crucial for musicians).
- Built-in Metronome interface.

### The Moat (USP)
Your marketing moat is unparalleled: **"Offline-First, Own Your Data."** 
While Planning Center and OnSong lock users into subscription-based walled gardens or proprietary XML files, Setlists MD's decision to rely entirely on transparent, raw `.md` files in a user's local Dropbox makes alternative apps look bloated maliciously anti-consumer. You are offering total data ownership.

---

## 6. Product Manager Perspective
**Short-Term Roadmap Recommendations:**
1. **P0 (Critical):** Implement `navigator.wakeLock.request('screen')` during Setlist Play mode.
2. **P1:** Implement simple text file bulk dragging & dropping (Parse `.txt` as `.md`).
3. **P2:** Set up Vitest to ensure `parser.js` guarantees error containment on bad user inputs.

---

## 7. UI/UX Designer Perspective
Aesthetic foundations are strong. The app uses Radix UI and Tailwind v4, utilizing a customized internal design system. The default `theme: 'dark'` is crucial; musicians *hate* bright light blasting them on stage, and dark mode guarantees a premium, distraction-free environment. 
However, there is room for a specialized "Stage View" that hides all chrome, toolbars, and menus entirely, maximizing purely on lyrics.

---

## 8. Sales & Monetization Strategy
Since you aren't paying server hosting fees or maintaining a massive cloud database:
- **Option 1 (One-Time Premium):** Sell the app for a flat \$15-30 fee (similar to ForScore).
- **Option 2 (Freemium):** App is 100% free for local data. Multi-device Cloud Sync (Dropbox/Drive engines) is locked behind a $15/year license.
- **Option 3 (Power Upgrades):** Introduce an AI-arranger tool ("Turn these lyrics to Chords") and charge a premium subscription.

