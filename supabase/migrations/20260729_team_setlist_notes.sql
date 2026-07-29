-- Leaders-only setlist notes — the reflection on the reader's finale (element 13).
--
-- WHY A TABLE AND NOT A FIELD. The finale's reflection used to live on the
-- setlist object itself (`serviceNote` / `practiceNote`), which the team library
-- engine syncs to EVERY member's device. That is the wrong home for a leader's
-- candid read on how a service went: "keys were a semitone too high for the
-- congregation", "the drummer was behind all morning". Hiding such a field in
-- the UI would not hide the text — it would still be sitting in the synced
-- payload on every member's phone. Only row-level security actually keeps it
-- off their device, so this is a separate table with its own policies.
--
-- Scope is (team, setlist, kind). ONE row per setlist per kind, shared between
-- that team's leaders — deliberately NOT per-user like `team_notes`, because a
-- service review is a single shared record the leaders write together, not a
-- private jotting.
--
-- `setlist_key` is the LOCAL setlist id (the same value promoted onto
-- `team_setlists.setlist_key` by 20260702_identity_keys.sql), NOT the
-- `team_setlists` row uuid. `team_schedules.setlist_id` uses the row uuid and
-- that mismatch is a documented source of silent lookup failures; keying off the
-- local id means the client never has to bridge through the sync manifest to
-- read or write its own note.

create table if not exists public.team_setlist_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  setlist_key text not null,
  kind text not null default 'live',
  body text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint team_setlist_notes_kind_check check (kind in ('live', 'practice')),
  unique (team_id, setlist_key, kind)
);

create index if not exists team_setlist_notes_team_setlist_idx
  on public.team_setlist_notes (team_id, setlist_key);

-- Teams where the caller leads: an admin member OR the owner.
--
-- `createTeam` always inserts the creator as an admin member, so the ownership
-- arm is belt-and-braces — it stops a legacy team with a missing member row from
-- locking its own owner out of notes they wrote.
--
-- SECURITY DEFINER for the same reason `get_user_teams()` is: a policy that
-- queries team_members from inside a team_members-derived check recurses, and
-- a plain subquery on `teams` would itself be filtered by that table's RLS.
create or replace function public.get_user_leader_teams()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select team_id from team_members where user_id = auth.uid() and role = 'admin'
  union
  select id from teams where owner_id = auth.uid();
$$;

alter table public.team_setlist_notes enable row level security;

-- Leaders only, on every verb. A member of the team is NOT enough: the whole
-- point of the table is that the text never reaches their device.
drop policy if exists "team_setlist_notes_select_leaders" on public.team_setlist_notes;
create policy "team_setlist_notes_select_leaders" on public.team_setlist_notes
  for select using (team_id in (select public.get_user_leader_teams()));

drop policy if exists "team_setlist_notes_insert_leaders" on public.team_setlist_notes;
create policy "team_setlist_notes_insert_leaders" on public.team_setlist_notes
  for insert with check (team_id in (select public.get_user_leader_teams()));

drop policy if exists "team_setlist_notes_update_leaders" on public.team_setlist_notes;
create policy "team_setlist_notes_update_leaders" on public.team_setlist_notes
  for update using (team_id in (select public.get_user_leader_teams()))
  with check (team_id in (select public.get_user_leader_teams()));

drop policy if exists "team_setlist_notes_delete_leaders" on public.team_setlist_notes;
create policy "team_setlist_notes_delete_leaders" on public.team_setlist_notes
  for delete using (team_id in (select public.get_user_leader_teams()));

-- NOTE: nothing is backfilled from the old `serviceNote` / `practiceNote` setlist
-- fields on purpose. Those values are already on every member's device; copying
-- them into a leaders-only table would imply a privacy they never had. Existing
-- notes stay where they are and stay visible; only new ones are leaders-only.
