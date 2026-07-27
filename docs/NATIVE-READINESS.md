# Native Packaging & App Store Feasibility — June 2026

Companion to `docs/archive/AUDIT-2026-06.md` (archived). Assesses what it takes to ship Setlists.md beyond the
web PWA: Apple App Store, Google Play, and Windows. Store-policy facts below were verified
against June-2026 sources (linked inline) — several are in active legal flux, so re-verify
before committing to a billing architecture.

## TL;DR — recommended sequencing

1. **Windows first (days of work):** package the existing PWA with PWABuilder for the
   Microsoft Store. Free individual registration, ~24–48 h review, and non-game apps may use
   their own commerce (Stripe) at **0% store fee**. **Electron is unnecessary** — it adds a
   maintenance burden with no policy or capability benefit for this app.
2. **Google Play second (weeks):** a Trusted Web Activity (TWA) wraps the deployed PWA with
   near-zero code change; the 2026 Epic-settlement rules permit linking out to Stripe
   checkout (expect ~10% fee on subscription link-outs once Google assesses them).
3. **Apple last (months):** Capacitor build with real work required — Sign in with Apple,
   OAuth deep links, native storage backstop, PDF-export rework, 4.2 "native feel" polish —
   and a billing strategy that's region-split and legally unstable until the Supreme Court
   resolves *Epic v. Apple* (~July 2026).

---

## 1. Codebase webview blockers (apply to Capacitor and any wrapped build)

| # | Blocker | Where | Impact |
|---|---|---|---|
| N-1 | ~~**PDF export uses `window.open('about:blank')` + `document.write`**~~ | `src/pdf/pdfDocument.js` | **Fixed (June 2026).** `openPrintWindow()` now always renders an in-app `<iframe srcdoc>` overlay and prints via `contentWindow.print()` — no popups on any platform, webview-compatible. |
| N-2 | **IndexedDB is the only persistence layer** | `src/storage.js` (idb-keyval) | iOS WKWebView may **evict** WebView storage under disk pressure — users could silently lose their entire library. Capacitor's own docs say don't rely on IndexedDB. Mitigation: mirror to native SQLite (`@capacitor-community/sqlite`) or at minimum aggressive `navigator.storage.persist()` + cloud-sync nudges. ([Capacitor storage guide](https://capacitorjs.com/docs/guides/storage), [WebKit policy](https://webkit.org/blog/14403/updates-to-storage-policy/)) |
| N-3 | **OAuth assumes a web origin** | `src/auth/AuthProvider.jsx` (`${origin}/auth/callback`), magic links to `${origin}/` | Inside Capacitor the origin is `capacitor://localhost` — Supabase redirects must go through universal/app links + `@capacitor/app` `appUrlOpen` + `exchangeCodeForSession`. Known pitfalls: Google requires an HTTPS intermediate redirect (not a raw custom scheme), and the PKCE code verifier can be lost when the OAuth tab opens on iOS. ([Supabase deep-linking docs](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [discussion #11548](https://github.com/orgs/supabase/discussions/11548)) |
| N-4 | **Stripe checkout navigates via `window.location.assign`** | `src/billing/checkout.js` | In a native shell this must open the **system browser** (`@capacitor/browser`) and return via deep link, and on iOS it collides with IAP policy (see §3). Billing is dormant today, so this can wait — but don't enable it in a store build without resolving §3. |
| N-5 | No platform-detection layer | — | Trivial to add (`Capacitor.isNativePlatform()`), but every fix above needs a branch point. Introduce one `src/platform.js` shim early. |

Things that are already native-friendly: origin-dynamic redirects (no hardcoded URLs),
`navigator.*` usage is feature-detected, no cookies/session assumptions (Supabase token
storage), service worker is harmless-redundant inside a bundled native shell.

## 2. Per-platform paths

### Windows — PWABuilder (recommended) vs Electron
- **PWABuilder:** valid manifest already exists (`vite.config.js` VitePWA). Package and
  submit with no code changes; review ~24–48 h; individual registration **free** since
  Sept 2025. Non-game apps may use their own commerce system and keep 100%.
  ([Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store),
  [Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies))
- **Electron:** would require IPC bridges, a custom protocol (the `file://` origin breaks
  Supabase redirects), an auto-update pipeline, and code signing — for zero policy benefit.
  **Recommendation: skip Electron entirely.**
- Remaining work item: N-1 (PDF export) behaves better in Edge-webview PWAs than iOS but
  should still move off `window.open`.

### Google Play — TWA (recommended) or Capacitor
- **TWA requirements** the app must meet: `/.well-known/assetlinks.json` on the production
  domain matching the signing cert; PWA installability (✅ already); **Lighthouse
  performance ≥ 80** at the start URL (verify — 1.95 MB precache is fine, but measure);
  branded offline fallback (✅ `navigateFallback`).
  ([TWA docs](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities),
  [PWA-in-Play codelab](https://developers.google.com/codelabs/pwa-in-play))
- **Billing:** under the court-approved (March 2026, final hearing pending) Epic v. Google
  settlement, apps may use alternative billing **or link out to web checkout**, fees ~9–20%
  (≈10% for subscription link-outs), rolling out US/EEA/UK by June 30 2026.
  ([Android Developers Blog](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html))
  The dormant Stripe model maps cleanly onto this — enroll in the alternative-billing
  program when enabling it.
- TWA shares the browser profile, so IndexedDB eviction risk is the normal-web one (N-2 is
  iOS-specific in severity).

### Apple App Store — Capacitor (the long pole)
Work items beyond N-1…N-5:
- **Sign in with Apple (Guideline 4.8):** required because the app offers Google OAuth.
  Supabase supports the Apple provider; add it before submission.
- **Guideline 4.2 minimum functionality:** wrapped apps get rejected when they feel like a
  website. Mitigations already in hand: offline-first, bespoke mobile shell, installable UX.
  Strengthen with at least one native capability (push notifications are the usual fix).
- **Account deletion (5.1.1(v)):** the in-app entry point calling the `delete-account` edge
  function **satisfies Apple**. (Google additionally requires a **public web URL** for
  deletion — add e.g. `setlists.md/delete-account` before the Play listing; enter it in the
  Data Safety form.)
- **Privacy labels / Data Safety:** both stores require disclosure of Supabase auth data
  (email, identifiers) and any analytics/Sentry usage.

## 3. Billing feasibility (the genuinely hard part — Apple)

Region-split as of June 2026:
- **US storefront:** external purchase links allowed with no entitlement (post-*Epic*
  injunction, upheld by the Ninth Circuit Dec 2025; Apple's Supreme Court petition is at
  conference June 25 2026 — outcome could restore a commission requirement).
- **EU (DMA):** external checkout allowed under an entitlement; combined fees ~5–20%
  (Core Technology Commission replaced the CTF Jan 2026).
- **Rest of world:** standard rules — digital subscriptions must use Apple IAP; no steering
  to Stripe.

Practical options for the team/church subscriptions:
1. **Don't sell in the iOS app** (reader-app pattern): teams subscribe on the web; the iOS
   app just signs in. Zero IAP work, fully compliant everywhere. **Recommended for v1.**
2. Stripe link-out for US/EU + hide purchase elsewhere (region logic + legal churn).
3. Full StoreKit IAP integration alongside Stripe (webhook reconciliation on `teams`
   subscription columns) — most work, only needed if in-app conversion matters.

Google Play and Microsoft Store both accommodate the existing Stripe model with at most an
enrollment + fee.

## 4. Suggested pre-native checklist (in order)

1. Fix N-1 (PDF export) — fixes today's iPad PWA bug *and* unblocks every native path.
2. Add the Google **public account-deletion URL** (cheap, needed for Play regardless).
3. Run Lighthouse on production; confirm ≥ 80 performance for TWA eligibility.
4. Ship **Microsoft Store via PWABuilder** (validation of the packaging pipeline, zero risk).
5. Ship **Google Play TWA** (assetlinks + signing + Data Safety form).
6. Start the **Capacitor iOS** track: platform shim (N-5) → deep-link auth (N-3) → SQLite
   mirror (N-2) → Sign in with Apple → 4.2 polish → reader-app billing posture.
7. Re-verify Apple billing rules after the Supreme Court outcome (~July 2026) before
   wiring any in-app purchase flow.
