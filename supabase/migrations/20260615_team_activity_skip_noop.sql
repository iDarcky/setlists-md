-- Stop the team activity feed from logging "edited" entries for no-op writes.
--
-- The sync engine re-writes a team_songs / team_setlists row whenever it pushes
-- a member's library, which fired the UPDATE trigger and logged a spurious
-- "X edited <song>" even though the content was identical. team_availability
-- already guards against no-op status updates; this adds the same guard for
-- songs and setlists (compare the canonical `content` column, and the name).
--
-- Idempotent: just replaces the trigger function in place. Re-run safely.

create or replace function public.log_team_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    -- Skip no-op updates (e.g. a sync re-write with identical content/title).
    if TG_OP = 'UPDATE'
       and NEW.content is not distinct from OLD.content
       and NEW.title is not distinct from OLD.title then
      return null;
    end if;
    v_team_id := coalesce(NEW.team_id, OLD.team_id);
    v_entity_id := coalesce(NEW.id, OLD.id)::text;
    v_entity_name := coalesce(NEW.title, OLD.title);
    v_action := case TG_OP when 'INSERT' then 'song_added' when 'UPDATE' then 'song_edited' else 'song_removed' end;
  elsif TG_TABLE_NAME = 'team_setlists' then
    if TG_OP = 'UPDATE'
       and NEW.content is not distinct from OLD.content
       and NEW.name is not distinct from OLD.name then
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

  insert into public.team_activity (team_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  values (v_team_id, v_actor, v_action, v_entity_type, v_entity_id, v_entity_name, v_meta);

  return null;
end;
$$;
