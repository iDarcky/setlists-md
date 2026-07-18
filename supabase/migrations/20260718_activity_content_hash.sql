-- Stop the team activity feed from logging "edited" for canonical no-op writes.
--
-- The skip-noop guard (20260615) only skips writes whose `content` is BYTE
-- identical. But the sync engine can legitimately re-serialize a song to
-- semantically-equal-but-byte-different markdown (frontmatter key order, a
-- defaulted-vs-omitted field, whitespace) and the self-heal pass can re-link a
-- setlist item — both bump `content` without the user editing anything, and the
-- feed cries "Daniel edited X".
--
-- Fix: carry a CANONICAL `content_hash` (the same hash the sync engine uses for
-- change detection — see src/sync/canonical.js) as a real column, and skip the
-- activity log when it is unchanged. The client stamps it on every write; rows
-- written before the client update (or by an older client) leave it NULL, so we
-- FALL BACK to the byte comparison and behaviour is unchanged until the client
-- catches up. Idempotent — safe to re-run.

alter table public.team_songs    add column if not exists content_hash text;
alter table public.team_setlists add column if not exists content_hash text;

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
    -- Skip no-op updates. Prefer the canonical content_hash when both sides
    -- have one; else fall back to the raw content+title byte comparison.
    if TG_OP = 'UPDATE'
       and NEW.title is not distinct from OLD.title
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

  insert into public.team_activity (team_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  values (v_team_id, v_actor, v_action, v_entity_type, v_entity_id, v_entity_name, v_meta);

  return null;
end;
$$;
