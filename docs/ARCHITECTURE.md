# Architecture & Technical Overview

This document explains how Setlists.md fits together for anyone reading the
codebase for the first time. For the authoritative, always-current technical
reference, see `CLAUDE.md` at the repo root — this is the friendly orientation
version.

## 1. High-Level Architecture

Setlists.md is a **Progressive Web App (PWA)** built with React 19 and Vite 7.
It is **offline-first**:

- The app and rendering engine are downloaded to the browser via a Service
  Worker, so it runs full-screen and works with no connection.
- All song and setlist data lives **locally first** (IndexedDB).
- No server is required for the core experience. The cloud (Supabase) only
  handles optional sign-in, account preferences, and team features.

There is **no router** — `App.jsx` switches between views (`library`, `chart`,
`editor`, `setlist-build`, etc.) via a `view` state value.

## 2. The Storage Layer (`src/storage.js`)

Local data uses `idb-keyval`, a small wrapper around IndexedDB (chosen over
`localStorage` for its larger limits and async, non-blocking reads).

Keys are namespaced `setlists-md:` and scoped per library (Personal vs. each
team Space), e.g. `setlists-md:songs:personal`, `setlists-md:setlists:personal`.
Settings are global (`setlists-md:settings`).

Songs are stored on a **v2 multi-arrangement schema** (`src/arrangements.js`):
shared identity at the top (title, artist, tags) plus an `arrangements[]` array,
where each arrangement owns its own key, tempo, capo, structure, and sections.

## 3. The Parser Engine (`src/parser.js`)

The heart of the app. It converts the `.md` interchange format to structured
JSON the React components render, and back again.

- `parseSongMd(text)` — raw markdown → structured object (frontmatter, sections,
  inline `[Chord]` tokens, `{tab}` blocks, `{modulate}` markers).
- `songToMd(song)` — the reverse, reconstructing a valid `.md` string.

Chords are kept inline as `[Chord]` tokens; the renderer splits each line by
those tokens to align chords visually above the lyrics. Round-trip fidelity is a
core requirement — what you import, you can export unchanged.

## 4. The Sync Engine (`src/sync/`)

Because browser storage can be cleared (Safari may evict IndexedDB after ~7 days
of inactivity), cloud sync is offered as an optional safety net.

- **Bring-Your-Own-Cloud adapters** — Google Drive, Dropbox, and OneDrive share
  a common interface, handling OAuth and reading/writing files to a dedicated
  folder in the user's own cloud.
- **Team sync** — for team/church Spaces, data syncs through Supabase.
- **Conflict resolution** — Last-Write-Wins, comparing local `updatedAt`
  timestamps against remote modified dates. (Optimistic locking is a known gap;
  see `analysis/TEAM_SYNC_AUDIT.md`.)

## 5. Auth & Accounts (`src/auth/`)

Supabase is **optional** — `auth/supabase.js` exports `null` when env vars are
missing, and every call site degrades gracefully to a signed-out guest
experience. When present, it provides email/magic-link sign-in, account-level
preference sync, and the team/church tier.

## 6. UI & Styling

- **Tailwind CSS v4** with Vercel **Geist** design tokens (see `BRAND.md`).
- All components use inline styles or Tailwind utilities — no CSS modules.
- **No TypeScript** — plain JSX throughout (a TypeScript migration is planned
  incrementally, per touched file).
- State is React Context plus state lifting, mostly centralized in `App.jsx`.

## 7. Music Logic (`src/music.js`)

Transposition, capo shapes, and Nashville Number System conversion. It dissects
a chord like `F#m7/C#` into root, suffix, and bass note, transposes each piece
independently, and reassembles it.
