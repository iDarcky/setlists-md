# Setlists.md — Plan

> What to do, in what order. One page: **Now → Next → Later**, plus the
> decisions still open.
>
> _Last updated: 2026-10-14 · `0.18.0` released to `main` on 2026-10-12 ·
> Target: **public beta 1 February 2027**._

**Three docs, three jobs.** `CLAUDE.md` = how it works · `docs/COMPONENTS.md` =
what the pieces are · **this file = what order to do them in.**

**Old section numbers.** Code comments and docs that cite `PLAN §1.2 #6`,
`PLAN §2.3` and so on point at the previous plan, archived as
[`archive/PLAN-2026-10-11.md`](archive/PLAN-2026-10-11.md). Its Stream B
(foundation), backlog by area and recently-shipped list are still useful as
reference; nothing in it is the current order.

**Where this order comes from.** The app-flow review of 12–14 October 2026,
which walked ten flows (first launch to Sunday morning) and settled how each
should work. The full reasoning, flow by flow, is in the
[app flows doc](https://claude.ai/code/artifact/98d17404-ba6d-4e47-b42d-faa117a1023a).
The [backlog doc](https://claude.ai/code/artifact/27dc34dc-ee10-46d8-ae6a-bfac4e34d50f)
holds every idea and bug by area.

---

## The product, in one paragraph

Setlists.md is for **churches and bands first**. Anyone who belongs to a church
lands in that church; it is their home. **Personal stays**: it is where a solo
musician starts ("Try it solo"), where someone waits while their join request is
approved, and where members keep songs of their own. A church is **one space**:
there are no sub-groups, because song **arrangements** (youth vs main) and
**services** (who plays when) already cover that. A **setlist is the service**:
one object, polished rather than split into "event" and "setlist".

---

## 1. Now — fix first

### 1.1 P0 bugs and safety (from the backlog)

- [ ] **Delete song** asks "are you sure" and offers undo (no confirmation today).
- [ ] **Warn before leaving an unsaved edit** in the song and setlist editors, on refresh, back and tab switch.
- [ ] **Team danger zone** clearly red; deleting a team requires typing its name.
- [ ] **Accept / Decline on a request gives feedback** (toast, card updates).
- [ ] **Notify a member removed from a setlist**, in-app and push.
- [ ] **Notify the leader when a member declines**: push exists, check the in-app entry.
- [ ] **Pending requests** pinned to the top of the dashboard, My schedule right after.
- [ ] **Break notes** up to 2,000 characters (today 500).
- [ ] **Bug:** moving songs adds numbers to setlist names.
- [ ] **Bug:** set order can't scroll to the bottom (the save/cancel card covers it).
- [ ] **Settings panel:** background scrolls behind it; clicking outside should close it. Verify.
- [ ] **Verify older bugs:** themes sometimes don't change; fonts don't change on tablet/mobile; login screen scroll; iPad top overflow and sidebar scroll.

### 1.2 Beta critical path (carried over; each waits on the one above)

- [ ] **Custom domain split** `setlists.md` → `app.setlists.md`. Gates email, OAuth, and the church-creation page on the website (§2.2).
- [ ] **Transactional email** (Resend): confirmation, reset, magic link.
- [ ] **Google / Apple OAuth** re-enabled.
- [ ] **Leaked-password protection** toggle in Supabase.
- [ ] **Turn Sentry on** (`VITE_SENTRY_DSN` in Vercel) and **wrap every route in `ErrorBoundary`**.
- [ ] **Verify on real hardware:** Web Push on a phone, PDF print on the installed PWA, one real Stripe payment.
- [ ] **Backups + one real restore drill.**

---

## 2. Next — the new flows, before 1 February

In build order. Each line names the flow it comes from.

### 2.1 First launch (flow 1)

- [ ] **Remove the onboarding quiz.** First screen: **Log in · Create account · Try it solo**.
- [ ] **After sign-up** (not arriving by invite): **Create a church or team** (opens the website) · **I have an invite link** · **Just me for now**.
- [ ] **Instrument question moves to after sign-up**; solo users without an account get it the first time they open a chart. It still sets the chart view (`displayRole`).
- [ ] **Redo the setup checklist.** Today it restarts on every new device; progress must be saved on the account.
- [ ] **Ask for install and push right after joining a church** ("Get notified when you're scheduled").

### 2.2 Creating a church (flow 2)

- [ ] **Church creation and payment live on the website**, not in the PWA, for now.
- [ ] **Prices: Team $14.99, Church $24.99 a month.** Update both places in the app (today `PricingScreen`/entitlements say $15/$25 and `TeamScreen` says $12/$24) and the Stripe prices.
- [ ] **A new church starts with an empty library**, on purpose (copyright). Its empty state offers **"Move songs from Personal"** when there are any, next to "Add your first song".
- [ ] **Leader checklist** on a new church's home: add a song · invite your band · plan a service. Ticks itself, disappears when done, saved on the account.

### 2.3 Joining (flow 3)

- [ ] **One join link per church** (code inside, also as a QR). **Admin approval on**; the admin can **reset the link** when it leaks. Replaces email invites.
- [ ] Admin gets a notification per request (name + email). The person sees **"Waiting for approval"** and can use Personal meanwhile. Everyone joins as **Member**.
- [ ] **Invite landing:** "Name invited you to join Church" → sign in or create account. Already signed in → **"Congratulations, you joined Church."** (nothing else on that screen).
- [ ] **On iPhone, the invite screen says "Add to Home Screen first"**: Safari and the installed app keep separate logins and storage.
- [ ] **The first church you join becomes home.** If you're already in one, the congratulations screen asks whether the new one should be home.

### 2.4 Adding songs (flow 4)

- [ ] Rename **"Blank song" → "Paste or type a song"**, and show **"Not in the catalog? Paste it"** when catalog search finds nothing. The flow itself stays.

### 2.5 Setlists and Sunday (flows 5, 7, 8)

- [ ] **Ready notifies the band.** The existing Draft/Ready switch only sets a badge today; switching to Ready notifies everyone scheduled ("Sunday's set is ready, 5 songs").
- [ ] **Changes since Ready, kept on the setlist** (not the activity feed): key, song order, songs added/removed, arrangement. Typos are ignored. Members see a line at the top and a dot on each changed song since they last opened it (tracked per account), plus a notification. Dropped after the service. Library edits stay in the activity feed.
- [ ] **A setlist with a band but no songs** reads "Band booked, songs coming", not as an empty set.
- [ ] **Play syncs first:** tapping Play on a Ready set runs the existing delta sync (`triggerSync`, `App.jsx`) for up to ~2 s, then opens the reader. Never blocks; offline opens the saved copy.
- [ ] **Sync status on the home screen only:** a dot plus words ("Up to date" / "Offline, last updated 9:41").

### 2.6 Guests (flow 9)

- [ ] **Share links follow the live set** and **expire 2–3 h after the service ends**. The guest sees only that set, in the Live reader, with **"Ask to join"** at the bottom (leads into the §2.3 approval link). Replaces today's frozen snapshot.

### 2.7 Soft launch

- [ ] **Private soft launch to 5–10 worship teams by early December 2026**, so January is for fixing what they find.

---

## 3. Later — after the beta, or when there's room

- **Member song suggestions** to the leader (flow 4).
- **Availability rounds**: the leader opens "November", members are notified and tap their dates, reminders go to whoever hasn't answered (flow 6). Until then: members fill availability, the leader picks.
- **Service presets**: time, place and rehearsal slot, never the people (flow 5).
- **Practice rework** (flow 7).
- **Home screen cleanup**; the next-up card with its Play button already exists (flows 7, 8).
- **"Create a church" button inside the app**, opening the website (flow 1).
- **Replace the demo songs** with a "Hello Setlists" song and setlist (flow 1).
- **Help a church import its songs** (flow 2).
- **Flag library edits on a Ready set** ("edited in the library since Thursday") (flow 7).
- **Native apps** in Kotlin Multiplatform; space creation in-app gets rethought then (`docs/NATIVE-READINESS.md`).

---

## 4. Decisions still open

| # | Decision | Notes |
| :-- | :--- | :--- |
| 1 | **Solo pricing: keep Pro ($25 once, Google Drive backup)?** | Claude's case: drop it, it's the costliest tier to maintain. Owner's case: some people hate subscriptions. |
| 2 | Supabase Pro (~$25/mo) for a staging project | Until then every migration must be additive and backward-compatible. |
| 3 | Analytics: Plausible, PostHog, or none | Evidence for every bet after the beta. |

Older open questions (bottom sheets, chord model, reading-mode vocabulary…) are
in the archived plan, §7.
