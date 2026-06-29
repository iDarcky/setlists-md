<div align="center">

# Setlists.md

**The worship chord-chart app that works on stage — offline, instant, and yours.**

[**Try it live →**](https://setlistsmd.insideahead.com/)

</div>

---

## What it is

Setlists.md is a Progressive Web App for worship teams. Install it on an iPad
or Android tablet, put it on your mic stand, and use it full-screen — it works
completely offline, with no Wi-Fi and no login required.

It replaces the usual mess of PDFs, screenshots, and scattered Google Docs with
one fast, dynamic chord chart that you can transpose, resize, and reflow
instantly while you play.

## Who it's for

A worship leader with a guitar and a tablet, leading a 3–7 piece band. No
playback engineer, no Ableton rig — just the people on stage who need the right
chart, in the right key, that works when the building Wi-Fi doesn't.

## Why it's different

- **🎵 Dynamic, not static** — transpose, add a capo, switch to Nashville
  Numbers, or jump between one and two columns with a single tap. No
  regenerating PDFs.
- **📡 Offline-first** — the whole app and your entire library live on your
  device. Full functionality at zero signal.
- **📂 You own your songs** — every song is a portable Markdown (`.md`) file.
  Export them anytime. Even if Setlists.md vanished tomorrow, your charts are
  plain, readable text.
- **🎸 Built for musicians, not admins** — mid-song key changes, a built-in
  capo calculator, guitar tab blocks, chord diagrams, and personal notes that
  don't touch the master chart.
- **⛪ Made for teams** — share a song library across your band or church,
  build setlists, assign roles, and plan services together.
- **🙌 Zero friction for guests** — a substitute musician can open a shared
  setlist without creating an account.

## How it works

Songs are written in a simple, human-readable format — YAML details at the top,
`## Section` headers, and `[Chord]` markers inline with the lyrics:

```
---
title: Amazing Grace
artist: Traditional
key: G
tempo: 72
---

## Verse 1
[G]Amazing grace how [G7]sweet the [C]sound
That [G]saved a [D]wretch like [G]me
```

The app renders that into a clean, transposable chart — and turns it back into a
file you can export, share, or back up to your own cloud.

## Status

Setlists.md is in active development, heading toward a **public beta on
October 1**. It's live now at
[setlistsmd.insideahead.com](https://setlistsmd.insideahead.com/).

## Documentation

| For | Start here |
| :--- | :--- |
| **Using the app** | [`docs/user/HOW-TO.md`](docs/user/HOW-TO.md) · [`docs/user/FAQ.md`](docs/user/FAQ.md) |
| **How it's built** | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`CLAUDE.md`](CLAUDE.md) |
| **Design system** | [`docs/BRAND.md`](docs/BRAND.md) |
| **Where it's going** | [`docs/PLAN.md`](docs/PLAN.md) — launch + polish + roadmap (single source of truth) |
| **Deploying** | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| **Business & strategy** | [`docs/analysis/`](docs/analysis/) |
| **Legal** | [`docs/legal/`](docs/legal/) |

---

<div align="center">
<sub>Built for the people on stage. Your songs, your files, your service.</sub>
</div>
