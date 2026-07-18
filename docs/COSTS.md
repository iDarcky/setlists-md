# Running costs — setlists.md

> Recurring costs to build, run, and launch the app. Prices are list prices at
> time of writing and mix EUR/USD as billed — **verify at the vendor** before
> relying on a number. FX ≈ $1 = €0.92.
>
> _Last updated: 2026-07-18._

## Paying now

| Item | Cost | Notes |
| :--- | :--- | :--- |
| **Claude Code** | **€10 / mo** | AI dev assistant — the plan we're on. |
| **Total now** | **≈ €10 / mo** (≈ €120 / yr) | |

## Needed for public launch (not paying yet)

| Item | Est. cost | Why / when | Status |
| :--- | :--- | :--- | :--- |
| **`.md` domain** (`setlists.md`) | **~€50–90 / yr** | The product domain (Moldova ccTLD — pricier than .com). Renews yearly. | 🔴 needed |
| **Supabase Pro** | **$25 / mo** (~€23) | Unlocks a **second project for staging** (test schema changes off live church data — see PLAN §2b), daily backups + 7-day PITR, more compute/storage as the user base grows. On free tier today. | 🟡 wanted before riskier DB work |
| **Resend** (transactional email) | **$0 → $20 / mo** | Auth/confirmation/reset emails. Free tier = 3,000 emails/mo, 100/day — likely enough at launch; Pro when volume grows. | 🟡 launch blocker (free tier ok to start) |
| **Vercel** | **$0 → $20 / mo** | Hosting. Hobby (free) works for now; Pro ($20/mo) if we exceed limits or need team seats / better analytics. | 🟢 free for now |

## Usage-based / only when features go live

| Item | Cost | Notes |
| :--- | :--- | :--- |
| **Stripe** (billing) | **2.9% + €0.30 per charge** | No monthly fee. Only applies once paid team/church tiers go live (currently scaffolded + dormant). |
| **Google Places API** (venue autocomplete) | **pay-per-request, free monthly credit** | Only if the setlist Location→Maps feature ships (PLAN backlog). Needs a billing-enabled key. |
| **Sentry** (error monitoring) | **$0 → ~$26 / mo** | Wired + dormant (`VITE_SENTRY_DSN`). Free tier likely fine early. |

## Free / no ongoing cost

- **Web Push** (VAPID keys) — free, self-hosted in Supabase.
- **Cover art / oEmbed edge function** — runs on Supabase (counts toward its usage).
- **GitHub** (repo, CI Actions) — free tier.

## Rough launch budget

- **Minimum to launch** (domain + free tiers everywhere else): **~€10/mo + ~€70/yr domain** ≈ **€16/mo effective**.
- **Comfortable** (add Supabase Pro for staging + backups): **~€33/mo + domain** ≈ **€39/mo effective**.
- Everything above is before any revenue; Stripe fees only apply once teams pay, and are netted from what they pay you.

### Priority if money is tight
1. **`.md` domain** — non-negotiable for launch.
2. **Resend free tier** — €0, just needs setup.
3. **Supabase Pro** — the one that costs real money monthly; defer until you actually need staging or hit free-tier limits. Until then, "test on beta" = "test on live data" (safe only while changes stay additive — see PLAN §2b).
