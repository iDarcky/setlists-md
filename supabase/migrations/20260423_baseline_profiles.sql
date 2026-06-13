-- 20260423_baseline_profiles.sql  (S-4 from the June 2026 audit)
--
-- BACKFILL, NOT A CHANGE. The `profiles` table, its RLS policies, the
-- handle_new_user trigger, and the `pro_waitlist` table were created by hand
-- in the Supabase dashboard before this repo tracked migrations — so a fresh
-- environment built from `supabase db push` came up without the table the
-- whole signed-in experience (and several later migrations) depends on.
--
-- This file reproduces those live objects verbatim (dumped from production on
-- 2026-06-15). It is named 20260423_* so it sorts before the earliest tracked
-- migration (20260424_add_profile_preferences, which ALTERs profiles).
-- Everything is idempotent, so applying it against the live project is a
-- harmless no-op. Columns added by later tracked migrations (preferences,
-- is_pro, subscription_tier, avatar_url) are intentionally NOT included here —
-- those migrations add them.

-- ── profiles ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- No INSERT policy: rows are created exclusively by the auth trigger below.

-- ── handle_new_user trigger ──────────────────────────────────────────────────
-- (search_path pinned and EXECUTE revoked by the later hardening migrations;
-- reproduced here in its final form so a fresh DB matches production.)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── pro_waitlist ─────────────────────────────────────────────────────────────
-- (the email-format CHECK is added by 20260608_storage_and_waitlist_hardening)

create table if not exists public.pro_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.pro_waitlist enable row level security;

drop policy if exists "Anyone can join waitlist" on public.pro_waitlist;
create policy "Anyone can join waitlist"
  on public.pro_waitlist for insert
  with check (true);
