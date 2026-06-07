# Feasibility Analysis & Strategic Positioning

## Overview
This document analyzes the current state of the Setlists MD codebase to assess its technical feasibility for launch and outlines the product's strategic positioning in the market, particularly against established competitors like Planning Center Online (PCO) and OnSong.

## Technical Feasibility & Codebase Assessment

### 1. Core Architecture
The app is built as an offline-first Progressive Web App (PWA) using React (via Vite) and `idb-keyval` for persistent local storage (IndexedDB).
- **Pros:** Extremely fast, works offline without an account, zero server costs for the core app, easily installable on any modern device.
- **Cons:** Dependent on browser storage limits and eviction policies. Safari, for instance, may clear IndexedDB if the app is unused for a week. The current implementation mitigates this through cloud sync (Google Drive, Dropbox, OneDrive).

### 2. State of Features
- **Song Format (.md):** The core value proposition—storing songs in a human-readable, easily parseable Markdown format—is fully implemented and working well. The parser and renderer handle chords, lyrics, sections, tabs, and modulations.
- **Editor:** A robust editor with visual, form, and raw modes is implemented, lowering the barrier to entry for users unfamiliar with Markdown or ChordPro.
- **Setlists:** Users can build, reorder, transpose, and play setlists. Setlists can be exported and imported as zip files containing the markdown songs and a JSON manifest.
- **Sync:** Cloud synchronization with Google Drive, Dropbox, and OneDrive is implemented. This is a crucial feature for collaboration and backup, especially given the ephemeral nature of PWA local storage on some platforms.

### 3. Readiness for Launch
The codebase is currently robust enough for a "soft launch" or a public beta. The core loop of importing/creating songs, building setlists, and playing them works seamlessly.
- **Immediate Needs before Launch:**
    - Final polish of the UI (ensuring accessibility and responsiveness).
    - Comprehensive user documentation (which this effort is currently addressing).
    - Setting up the cloud provider API keys (Google, Dropbox, OneDrive) for production sync.

## Strategic Positioning

### The Market Context
Worship leaders and musicians currently rely on tools that are either highly expensive (OnSong), lock data into a proprietary ecosystem (Planning Center), or require complex infrastructure (Ableton, backing tracks).

### Our Differentiators
Setlists MD positions itself as the "Obsidian of Worship Charts."
1. **Data Ownership:** You own your files. They are simple `.md` files that can be edited in any text editor. You are never locked into a subscription to access your own charts.
2. **Offline First:** The app doesn't require an internet connection to render charts or play a setlist.
3. **Frictionless Onboarding:** No accounts required to start. Open the web app, and start playing.
4. **Platform Agnostic:** It runs beautifully on an iPad, Android tablet, phone, or desktop browser.

### The Pitch
"Your songs, your way. Setlists MD is a lightning-fast, offline-first chord chart renderer that uses simple Markdown files. Build setlists, transpose keys, and sync across devices via your own cloud storage—all for free, with zero vendor lock-in."

### Feasibility Summary
Setlists MD is highly feasible as a product. The technology stack perfectly supports the product vision of a lightweight, offline, and portable tool. The challenge will not be technical, but rather behavioral: convincing worship leaders to migrate their libraries from established formats (like PDF or PCO's internal format) to Markdown. The "Smart Import" features planned on the roadmap will be critical to overcoming this friction.
