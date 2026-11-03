# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users
- **Primary: worship leaders at small and mid-size churches.** They choose the songs, build the set for each service, ask musicians to serve and pay for the team. They plan midweek on a laptop or phone and lead on Sunday from an iPad on a music stand.
- **Team members: church musicians and singers.** Volunteers who read charts, answer rehearsal and service requests, and play from a tablet or phone, often in a room with poor or no signal.
- **Secondary: bands** (youth teams, church plants, gigging worship bands) on the smaller Team plan.

## Product Purpose
Setlists.md gets a worship team from "what are we playing Sunday?" to playing it: chord charts, setlists, rosters and availability in one app that keeps working offline. Success means a leader can plan a service in minutes, everyone on the roster has the right charts in the right key before they arrive, and nothing fails on stage.

## Positioning
Affordable for small churches: one flat monthly price covers the whole team (Church $25 for 30 members, Team $15 for 10), with every member getting every feature. There are no per-user licences and no paid tiers inside the team.

## Operating Context
- The weekly worship rhythm: plan early in the week, rehearse midweek, play on Sunday. Many churches run more than one service a week (e.g. 9:00 and 11:00).
- Live use happens on an iPad on a music stand, often in landscape, under stage lighting, with no reliable Wi-Fi. The reader switches to live mode by the service clock (from 30 minutes before the service until it ends).
- Musicians are volunteers with a wide range of tech comfort. Requests to serve arrive as push notifications.
- Songs are stored in an `.md` chord-chart format (frontmatter + `[Chord]lyrics`) that can be exported and imported.

## Capabilities and Constraints
- Installable PWA (Vite + React), offline-first, IndexedDB on the device. Server sync through Supabase for accounts with cloud sync and for team libraries.
- Chord charts: transpose, capo, key changes, tabs, chord diagrams, multiple arrangements per song. Stored songs are always in their original key; transpose happens at render time.
- Setlists with per-service keys, tempos and notes; breaks (prayer, announcements) in the running order.
- Teams: shared library, roles (admin/leader/member), scheduling, availability, push notifications, private per-user notes. Church plan adds multiple services.
- Billing: each team or church is its own Stripe subscription paid by the owner. Billing is scaffolded but not live.
- **Launch:** public launch on 1 February 2027. Until then the landing page takes reservations: account and church are created, the team uses the beta, and nothing is charged until launch.
- **Pricing (decided October 2026):** Church $25/month, 30 members, extra seats in packs of 5 for $5/month. Team $15/month, 10 members, no extra seats. Yearly billing is 20% off. Founding reservations keep 20% off for life. Prices are shown in the visitor's local currency at checkout.
- **Domains:** marketing site on `setlists.md`, the app on `app.setlists.md`.
- **Undecided:** whether the founding discount also applies to seat packs, and whether it stacks with the yearly discount.
- Not yet available, so pages must not promise it: migration or import from other services (Planning Center etc.) as a selling point, and CCLI reporting.

## Brand Commitments
- Name: **Setlists.md** (always with the `.md`).
- Voice: calm and practical. Professional and minimal; reliable on stage. Plain words a musician uses.
- Logo: `public/setlists-md-mark.svg`, three stacked bars on a teal (#53796F) rounded square.
- No competitor is named in marketing.
- English only for now.

## Evidence on Hand
- **None yet:** no testimonials, customer logos, usage numbers or press. Future work must not invent any of them.
- Real content available for demos: the three public-domain demo songs in `src/data/demos.js` (e.g. Amazing Grace). Hymn titles that are in the public domain are safe for mock setlists.

## Product Principles
1. **The whole team, one price.** Never gate a reading or playing feature behind a per-member upgrade.
2. **Sunday cannot fail.** Offline, fast and predictable on stage beats anything clever.
3. **Planning and playing are one thing.** A change made while planning reaches the music stand without anyone re-sending it.
4. **Respect volunteers' time.** Every request and screen should be answerable in one tap by someone who isn't technical.

## Accessibility & Inclusion
- Charts are read at a distance under stage lighting: high contrast and adjustable text size matter more than density.
- Touch targets of at least 44px, because use is on tablets and phones, often mid-song.
- Respect reduced-motion settings.
