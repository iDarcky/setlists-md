# Deployment

Setlists.md is a static Vite + React PWA. Production runs on Vercel against the `master` branch; preview deploys go up automatically for every other branch and pull request.

This doc walks through everything you need to wire up a fresh environment from scratch.

---

## Prerequisites

- Node.js ≥ 20
- A Vercel account with this repo connected
- A Supabase project (one per environment — separate projects for dev and prod is strongly recommended)
- *(Optional)* A Sentry project for production error tracking
- *(Optional)* Cloud-sync OAuth client IDs (Google / Dropbox / Microsoft) if you want to enable Bring-Your-Own-Cloud sync

---

## 1. Local development

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY at minimum
npm install
npm run dev   # http://localhost:5173
```

Without Supabase env vars the app still works as a guest-mode local PWA — auth controls hide and profile sync is a no-op. With them set, sign-in, account preferences sync, and the pricing waitlist all light up.

---

## 2. Supabase setup

### Create the project
1. Sign in at https://app.supabase.com → **New project** (pick a region close to your users).
2. Copy `Project URL` and `anon` key from **Project Settings → API** into your `.env.local` (or Vercel env vars for prod).

### Apply database migrations
Migrations live in `supabase/migrations/`. Two ways to run them:

**Option A — Supabase CLI (recommended):**
```bash
brew install supabase/tap/supabase   # or: npm i -g supabase
supabase link --project-ref <your-ref>
supabase db push
```

**Option B — Manual:**
Open **SQL Editor** in the Supabase dashboard, paste each migration file in order, run.

Currently shipped migrations:
- `20260424_add_profile_preferences.sql` — adds the `preferences` JSONB column on `profiles` so cross-device preference sync works. Without this, sign-in still works but preferences don't follow the user.

### Required RLS policies
The `profiles` table needs row-level security so each user can read/write only their own row:
```sql
-- in Supabase SQL editor
alter table public.profiles enable row level security;

create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
```

### Email + auth provider config
- **Auth → URL Configuration**: set Site URL to your production domain. Add redirect allow-list entries for `http://localhost:5173`, your Vercel preview wildcard (`https://*-yourteam.vercel.app/**`), and `https://yourdomain.com/auth/callback`.
- **Auth → Providers**: enable Email (with "confirm email" on for password sign-up). Enable any social providers you want; OAuth callback path is `/auth/callback`.

### Pricing waitlist (optional)
The new `PricingScreen` writes to a `pro_waitlist` table when users opt in for early access. Create it once:
```sql
create table public.pro_waitlist (
  email text primary key,
  created_at timestamptz default now()
);
alter table public.pro_waitlist enable row level security;
create policy "anyone can sign up"
  on public.pro_waitlist for insert
  with check (true);
```

---

## 3. Vercel deployment

1. Import this repo into Vercel — framework preset auto-detects Vite.
2. **Environment Variables** — add every key from `.env.example` you intend to use. Set them per environment (Production / Preview / Development).
3. Production deploys trigger on push to `master`. Preview deploys trigger on every other branch.
4. Default build settings work as-is:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

---

## 4. Sentry (optional)

1. Create a Sentry project (React platform).
2. Copy the DSN into `VITE_SENTRY_DSN` in Vercel.
3. *(Recommended)* Set `VITE_APP_VERSION` to the Vercel commit SHA so releases line up — add `VITE_APP_VERSION=$VERCEL_GIT_COMMIT_SHA` as a build-time env in Vercel.
4. `npm install @sentry/react` once — `src/sentry.js` dynamically imports it, so until the package is installed the init is a silent no-op.

---

## 5. Cloud-sync OAuth (optional)

For Bring-Your-Own-Cloud sync to Google Drive / Dropbox / OneDrive you need OAuth client IDs from each provider. They're public values (not secrets) so it's safe to commit them to Vercel env vars. Add the three `VITE_*_CLIENT_ID` keys from `.env.example` once you have them. Without these, the corresponding sync providers are hidden in the UI.

---

## 6. Verifying a fresh deploy

After a deploy, walk through this list once:

- [ ] Visit production URL in an incognito window — onboarding should fire (Live Hello, quiz, personalized setup).
- [ ] Open DevTools → Application → Service Workers — confirm one is registered.
- [ ] Sign up with a fresh email — verification email should arrive within ~1 minute.
- [ ] Confirm email, sign in — Account page should show your email.
- [ ] Create a song, refresh — it persists (IndexedDB).
- [ ] Sign in on a second device — preferences should sync (theme, font size, etc.).
- [ ] Open Stage Mode — `WakeLockExplainer` should fire once, screen should stay on.
- [ ] Trigger a deploy after the app is open in a tab — within seconds you should see the "New version available" toast.
- [ ] If Sentry is wired, throw a test error from DevTools and confirm it lands in Sentry.

---

## 7. Common gotchas

- **`profiles.preferences` column missing** — the AuthProvider falls back to a base profile select, so sign-in works, but preferences won't sync across devices until you apply `20260424_add_profile_preferences.sql`.
- **Magic-link / password-reset stays on `?code=...` after sign-in** — `App.jsx` strips this in an effect, but only after `detectSessionInUrl` runs. Make sure your Supabase Site URL matches the production origin exactly (no trailing slash).
- **iOS PWA install** — `beforeinstallprompt` does not fire on iOS Safari. The app shows a custom Add-to-Home-Screen explainer (`IOSInstallHint`) once after onboarding.
- **Wake Lock not honoured on older Safari** — the hook silently no-ops; users on iPadOS < 16.4 may need to keep tapping the screen during stage mode.
