-- Per-user PRIVATE notes for team workspaces ("My note").
--
-- Shared/team notes continue to live on the song & setlist objects (synced by
-- the team library engine). This table is ONLY the private layer: each row is
-- one user's private note at a given scope — a song, a song-in-a-setlist, or a
-- section of a song. Scope columns are NOT NULL with '' defaults so a plain
-- unique constraint (and ON CONFLICT upsert) works cleanly across the
-- partially-set scopes.

create table if not exists public.team_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null default '',
  setlist_id text not null default '',
  section_key text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (team_id, user_id, song_id, setlist_id, section_key)
);

create index if not exists team_notes_team_user_idx
  on public.team_notes (team_id, user_id);

alter table public.team_notes enable row level security;

-- A user can see and manage ONLY their own notes, and only within teams they
-- belong to. get_user_teams() is defined in the team RLS migrations.
drop policy if exists "team_notes_select_own" on public.team_notes;
create policy "team_notes_select_own" on public.team_notes
  for select using (
    user_id = auth.uid()
    and team_id in (select public.get_user_teams())
  );

drop policy if exists "team_notes_insert_own" on public.team_notes;
create policy "team_notes_insert_own" on public.team_notes
  for insert with check (
    user_id = auth.uid()
    and team_id in (select public.get_user_teams())
  );

drop policy if exists "team_notes_update_own" on public.team_notes;
create policy "team_notes_update_own" on public.team_notes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "team_notes_delete_own" on public.team_notes;
create policy "team_notes_delete_own" on public.team_notes
  for delete using (user_id = auth.uid());
