# Archive

Point-in-time documents, kept for the reasoning behind decisions already made.
**Nothing here is current** — do not plan against it.

- `AUDIT-2026-06.md` — pre-launch audit (June 2026). Findings folded into
  `../PLAN.md`; most are shipped.
- `AUDIT-WAVE3-SECURITY-SCALE.md` — security & scale wave (June 2026). Shipped:
  `team_id` indexes, realtime echo guard, per-song persistence, incremental hashing.
- `HANDOFF-WAVE6.md` — session handoff (June 2026). Superseded by `../PLAN.md`.
- `TEAM_SYNC_AUDIT.md` — team sync audit (June 2026) of the old
  `supabase-team.js` + `engine.js` pipeline. Findings fixed; that pipeline is
  being replaced per `../SYNC-REDESIGN.md`.
- `PLAN-2026-10-11.md` — the previous roadmap (two streams, component
  passes, backlog by area, decisions table). Replaced on 2026-10-14 by the
  one-page `../PLAN.md`. Code comments citing `PLAN §1.2 #6` and the like
  point here.
- `song-hub-build.md` — Song Hub V2 build spec. Built and shipped; the hub is
  now the song-open target. Live behaviour is in `CLAUDE.md`; the product
  reasoning is in `../views-vision.md`.

Current docs: `CLAUDE.md` (how it works) · `../COMPONENTS.md` (what the pieces
are) · `../PLAN.md` (what order).
