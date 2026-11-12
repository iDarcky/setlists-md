# Website (setlists.md)

The public website: what Setlists.md is, join the beta, pricing, help, and
terms/privacy/copyright. It is plain static HTML with no build step, kept
separate from the app in `src/` so a website change never redeploys or
breaks the app.

## Deploying

This folder is its own Vercel project, separate from the app's project:

1. In Vercel, **Add New → Project**, import `iDarcky/setlists-md` again.
2. Set **Root Directory** to `website`.
3. Framework preset: **Other**. No build command, no output directory.
4. Production branch: `main` (same release train as the app).

Domains are not moved yet. The plan is: website on `setlists.md`, app on
`app.setlists.md`, with redirects so old links and home-screen icons keep
working. That switch happens in its own step.

## Pages

- `index.html` (/) — what it is, how it works, pricing, FAQ.
- `help.html` (/help) — contact, invite links, starting a church, Add to Home Screen.
- `start.html` (/start) and `ro/start.html` (/ro/start) — the "Start your church" form.
  It posts straight to the `feedback` table with Supabase's publishable key (the
  table allows anyone to insert; only the service role reads), tagged
  `[church request]` like the app's own request. `connect-src` in `vercel.json`
  allows that one Supabase host.
- `ro/index.html` (/ro) — the Romanian landing page. Help and legal pages are English
  only for now; Romanian pages link to them with `hreflang="en"`.
- `/privacy`, `/terms`, `/copyright` — linked in the footer, added in the legal PR.

Shared styles in `site.css`, the header menu in `site.js` (no inline scripts, so
the CSP is `script-src 'self'`). Header and footer are repeated in each page on
purpose: no build step.

Join the beta links to `https://app.setlists.md/?start=signup&from=site` and Log in
to `https://app.setlists.md/?from=site`. The `from=site` tag is how we count
sign-ups that came from the website.

## Preview locally

```bash
npx serve website
```

## Old app links

The app used to live on setlists.md. Once that address points at this
project, old links are sent on to app.setlists.md:

- `vercel.json` redirects `/join/<code>`, `/auth/...`, `/design`, shared
  setlist links (`/?setlist=...`) and sign-in returns (`/?code=...`).
- `site.js` sends on what the server never sees: a Home Screen icon saved
  before the move (opens full screen on `/`) and password-reset links whose
  tokens ride in the `#fragment`.
