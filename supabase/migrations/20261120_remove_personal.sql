-- Remove the old one-person library ("Personal") from the database. v2, 21 Nov 2026.
--
-- Run ONLY after the app without Personal is released to main. An older app
-- would call ensure_personal_workspace() again and fail once it is gone.
--
-- v1 failed with "team_activity_team_id_fkey": deleting the team deleted its
-- 45 songs, and each deleted song tried to log "song removed" for a team that
-- no longer existed. v1 was one transaction, so nothing changed.
--
-- What it does (one transaction, all or nothing):
--   0. the activity log skips a team that has just been deleted (the fix;
--      also stops the same error when someone alone in a team with songs
--      deletes their account);
--   1. deletes every teams row of kind 'personal' (1 row, 45 songs, no
--      setlists, no members). Its songs and activity go with it;
--   2. drops ensure_personal_workspace() and its one-per-owner index;
--   3. stops the database accepting kind/plan 'personal' again.
-- Nothing else is touched: churches and bands keep every row.

begin;

-- 0. Activity log: do nothing for a team that is gone.
create or replace function public.log_team_activity()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_team_id uuid;
  v_actor uuid := auth.uid();
  v_action text;
  v_entity_type text := TG_ARGV[0];
  v_entity_id text;
  v_entity_name text;
  v_meta jsonb := '{}'::jsonb;
begin
  if TG_TABLE_NAME = 'team_songs' then
    if TG_OP = 'UPDATE'
       and NEW.title is not distinct from OLD.title
       and (
         (NEW.content_hash is not null and OLD.content_hash is not null
            and NEW.content_hash is not distinct from OLD.content_hash)
         or ((NEW.content_hash is null or OLD.content_hash is null)
            and NEW.content is not distinct from OLD.content)
       )
       and (NEW.doc is not distinct from OLD.doc or OLD.doc is null) then
      return null;
    end if;
    v_team_id := coalesce(NEW.team_id, OLD.team_id);
    v_entity_id := coalesce(NEW.id, OLD.id)::text;
    v_entity_name := coalesce(NEW.title, OLD.title);
    v_action := case TG_OP when 'INSERT' then 'song_added' when 'UPDATE' then 'song_edited' else 'song_removed' end;
  elsif TG_TABLE_NAME = 'team_setlists' then
    if TG_OP = 'UPDATE'
       and NEW.name is not distinct from OLD.name
       and (
         (NEW.content_hash is not null and OLD.content_hash is not null
            and NEW.content_hash is not distinct from OLD.content_hash)
         or ((NEW.content_hash is null or OLD.content_hash is null)
            and NEW.content is not distinct from OLD.content)
       ) then
      return null;
    end if;
    v_team_id := coalesce(NEW.team_id, OLD.team_id);
    v_entity_id := coalesce(NEW.id, OLD.id)::text;
    v_entity_name := coalesce(NEW.name, OLD.name);
    v_action := case TG_OP when 'INSERT' then 'setlist_created' when 'UPDATE' then 'setlist_edited' else 'setlist_removed' end;
  elsif TG_TABLE_NAME = 'team_members' then
    v_team_id := NEW.team_id;
    v_actor := NEW.user_id;
    v_entity_id := NEW.user_id::text;
    v_action := 'member_joined';
  elsif TG_TABLE_NAME = 'team_schedules' then
    v_team_id := NEW.team_id;
    v_entity_id := NEW.user_id::text;
    v_meta := jsonb_build_object('role', NEW.role, 'vocal_part', NEW.vocal_part, 'setlist_id', NEW.setlist_id);
    v_action := 'roster_assigned';
  elsif TG_TABLE_NAME = 'team_availability' then
    if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then
      return null;
    end if;
    v_team_id := NEW.team_id;
    v_actor := NEW.user_id;
    v_meta := jsonb_build_object('date', NEW.date, 'status', NEW.status);
    v_action := 'availability_set';
  else
    return null;
  end if;

  -- The team is being deleted (its rows go with it): nothing to log.
  if not exists (select 1 from public.teams where id = v_team_id) then
    return null;
  end if;

  insert into public.team_activity (team_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  values (v_team_id, v_actor, v_action, v_entity_type, v_entity_id, v_entity_name, v_meta);

  return null;
end;
$function$;

-- Safety: stop if more than one Personal row exists (someone else has one).
do $$
declare n int;
begin
  select count(*) into n from public.teams where kind = 'personal';
  if n > 1 then
    raise exception 'Expected at most 1 Personal row, found %. Nothing was deleted.', n;
  end if;
end $$;

-- 1.
delete from public.teams where kind = 'personal';

-- 2.
drop function if exists public.ensure_personal_workspace();
drop index if exists public.teams_personal_owner_idx;

-- 3.
alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams
  add constraint teams_kind_check check (kind in ('team', 'church'));

alter table public.teams drop constraint if exists teams_plan_check;
alter table public.teams
  add constraint teams_plan_check check (plan in ('free', 'team', 'church'));

commit;

-- Check afterwards (both should say 0):
--   select count(*) from public.teams where kind = 'personal';
--   select count(*) from pg_proc where proname = 'ensure_personal_workspace';
