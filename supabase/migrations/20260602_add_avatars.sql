-- Profile pictures (personal avatars) + team/church logos.
--
-- Applied live to the setlists.md project on 2026-06-02. Stored here to keep
-- the repo in sync. Adds nullable URL columns that point into a public
-- `avatars` storage bucket, and the bucket + RLS policies.
--
-- The client degrades gracefully when these are absent (AuthProvider falls
-- back to a base select; TeamProvider reads teams with select('*')), so older
-- deployments keep working until this is applied.

-- 1. Columns ------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.teams    add column if not exists logo_url  text;

-- 2. Storage bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3. RLS policies on storage.objects (scoped to the avatars bucket) -----------

-- Anyone can read avatar/logo images (the bucket is public).
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Users manage their own personal avatar folder: users/{uid}/...
drop policy if exists "avatars user write own" on storage.objects;
create policy "avatars user write own"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Team owners/admins manage their team logo folder: teams/{team_id}/...
drop policy if exists "avatars team admin write" on storage.objects;
create policy "avatars team admin write"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'teams'
    and (
      exists (select 1 from public.teams t where t.id::text = (storage.foldername(name))[2] and t.owner_id = auth.uid())
      or exists (select 1 from public.team_members m where m.team_id::text = (storage.foldername(name))[2] and m.user_id = auth.uid() and m.role = 'admin')
    )
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'teams'
    and (
      exists (select 1 from public.teams t where t.id::text = (storage.foldername(name))[2] and t.owner_id = auth.uid())
      or exists (select 1 from public.team_members m where m.team_id::text = (storage.foldername(name))[2] and m.user_id = auth.uid() and m.role = 'admin')
    )
  );
