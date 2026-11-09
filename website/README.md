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

## Preview locally

```bash
npx serve website
```
