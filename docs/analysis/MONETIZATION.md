# Monetization Strategy & Cost Analysis

The business model behind Setlists MD — how the tiers work, what they cost to
run, and why the "free core, paid sync" approach (inspired by Obsidian) fits
this market.

> **⚠️ Plan-naming is not yet reconciled.** Three different naming schemes exist
> across the docs and code (this doc, `analysis/FINANCIAL.md`, and the in-app
> `src/data/terms.md`). Picking one canonical scheme is a pre-launch decision —
> see `ROADMAP.md` "Launch Blockers". The structure below is the recommended
> direction; the exact names and prices are still open.

---

## 1. The Tiered Model

### Tier 1 — Free Forever (the "tech-savvy solo" tier)
- **Price:** $0
- **Includes:** Full editor (Visual/Form/Raw), local storage, ZIP
  import/export, and Bring-Your-Own-Cloud sync (Google Drive / Dropbox /
  OneDrive).
- **Why it works:** A complete, professional product at $0 is the marketing
  engine. Solo musicians love it, then recommend it to their worship leader —
  who buys a team tier.

### Tier 2 — Private Sync (the "convenience" tier)
- **Price:** ~$3–5/mo or ~$30–50/yr, *or* a one-time unlock (~$9–25).
- **Includes:** Seamless hosted sync across devices (no Drive setup), Smart
  Import (Ultimate Guitar, ChordPro, plain text), and version history (30-day
  undo). Optionally End-to-End Encryption.
- **Why it works:** You keep BYO-cloud free as the lead magnet; users who want
  one-click convenience upgrade. Your storage cost on text-only data is near $0.

### Tier 3 — Team / Church (the "band" tier)
- **Price:** ~$8–24/mo depending on seats.
- **Includes:** Everything in Sync, plus shared Spaces ("Sunday Service",
  "Youth Band"), role management (admin / editor / viewer), and live
  leader-mode page-turning.

---

## 2. Why the Economics Work

Because the app stores **text only** (and optionally encrypted blobs), hosting
overhead is tiny compared to image/video apps.

| Service | Provider | Usage (5,000 users) | Est. cost |
| :--- | :--- | :--- | :--- |
| Storage | Supabase / S3 | ~15 GB | <$0.50/mo |
| Database | Supabase | metadata only | Free tier |
| Auth | Supabase | 5k MAU | Free tier |
| Edge functions | Supabase / Vercel | 100k/mo | Free tier |
| Domain & SSL | — | 1 domain | ~$1/mo |
| Reliability | Supabase Pro | dedicated (optional) | $25/mo |

**Total overhead at 5,000 users: ~$26/mo.**

### Illustrative revenue (5% paid conversion, ~$4.54 net/user after Stripe)

| Free base | Paid (5%) | Monthly net |
| :--- | :--- | :--- |
| 1,000 | 50 | ~$200 |
| 10,000 | 500 | ~$2,200 |
| 50,000 | 2,500 | ~$11,300 |

Just 50 churches on a $20/mo team plan adds ~$1,000/mo gross at near-zero extra
hosting cost.

---

## 3. Why "Free Core, Paid Sync" Fits (the Obsidian model)

1. **Trust over features** — if you ship E2EE, you're selling *privacy*. Users
   knowing you *can't* read their data is a powerful trust builder.
2. **Low friction** — free BYO-cloud sync is the marketing lead; the upgrade is
   pure convenience.
3. **Low risk for the user** — stop paying and you don't lose data, only the
   sync service. Files still export as `.md` or fall back to free Drive sync.
   This also keeps Setlists MD's legal exposure low (it's a sync utility, not a
   lyrics host).

---

## 4. What It Takes to Turn On

- **Stripe Billing** integration (scaffolded but dormant — see
  `STRIPE_BILLING.md` and `CLAUDE.md` "Billing").
- For E2EE: the Web Crypto API for client-side AES-GCM encryption, plus a
  generic blob-storage adapter in `src/sync/`.
- Reconcile the plan names/prices and align `PricingScreen.jsx` with the chosen
  model before any of this goes live.
