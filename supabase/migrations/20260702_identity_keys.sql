-- First-class server-side identity for team library rows.
--
-- Until now a row's identity lived INSIDE its content (the `songId:`
-- frontmatter / the setlist JSON's `id`), and the only server-side uniqueness
-- was on (team_id, title) / (team_id, name). Two consequences:
--   * two DIFFERENT songs with the same title in one team could not both
--     sync — the second insert collided and the engine "healed" by adopting
--     (silently merging) the other song's row;
--   * identity questions (duplicates, drift) required parsing every row's
--     content client-side.
-- `song_key` / `setlist_key` promote the embedded id to a real column with a
-- real unique constraint, and the title/name uniqueness is dropped.
--
-- Stamp triggers keep the columns correct even for writers that don't send
-- them (older deployed clients, manual SQL): the key is extracted from the
-- content itself, falling back to the row UUID.

alter table public.team_songs add column if not exists song_key text;
alter table public.team_setlists add column if not exists setlist_key text;

create or replace function public.stamp_team_song_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.song_key is null or NEW.song_key = '' then
    NEW.song_key := coalesce(
      nullif(trim(substring(NEW.content from E'\\nsongId:[[:blank:]]*([^\\n\\r]+)')), ''),
      NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

create or replace function public.stamp_team_setlist_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.setlist_key is null or NEW.setlist_key = '' then
    NEW.setlist_key := coalesce(nullif(NEW.content->>'id', ''), NEW.id::text);
  end if;
  return NEW;
end;
$$;

-- Trigger functions are only ever run by their triggers — no client role
-- needs (or should have) direct EXECUTE (see 20260702_trigger_fn_hardening).
revoke execute on function public.stamp_team_song_key() from public, anon, authenticated;
revoke execute on function public.stamp_team_setlist_key() from public, anon, authenticated;

drop trigger if exists trg_stamp_team_song_key on public.team_songs;
create trigger trg_stamp_team_song_key
  before insert or update on public.team_songs
  for each row execute function public.stamp_team_song_key();

drop trigger if exists trg_stamp_team_setlist_key on public.team_setlists;
create trigger trg_stamp_team_setlist_key
  before insert or update on public.team_setlists
  for each row execute function public.stamp_team_setlist_key();

-- Backfill existing rows (verified duplicate-free before the unique indexes).
update public.team_songs
   set song_key = coalesce(
     nullif(trim(substring(content from E'\\nsongId:[[:blank:]]*([^\\n\\r]+)')), ''),
     id::text)
 where song_key is null or song_key = '';

update public.team_setlists
   set setlist_key = coalesce(nullif(content->>'id', ''), id::text)
 where setlist_key is null or setlist_key = '';

create unique index if not exists idx_team_songs_team_key
  on public.team_songs (team_id, song_key);
create unique index if not exists idx_team_setlists_team_key
  on public.team_setlists (team_id, setlist_key);

-- Same-title songs (and same-name setlists) are legitimate; identity is the
-- key now.
drop index if exists public.idx_team_songs_team_title;
drop index if exists public.idx_team_setlists_team_name;
