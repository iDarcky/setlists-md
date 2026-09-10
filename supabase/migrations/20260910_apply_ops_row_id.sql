-- apply_ops: return the server row id in every applied `put`.
--
-- A writer that just created a setlist points team_schedules at its row UUID
-- right away (the roster picker, the calendar); waiting for the feed echo would
-- leave that window empty. Conflict payloads carry `row_id` too. Otherwise the
-- semantics of 20260910_sync_versions are unchanged. Idempotent (CREATE OR
-- REPLACE). Applied to production 2026-09-10.

create or replace function public.apply_ops(p_team_id uuid, p_ops jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  op          jsonb;
  v_kind      text;
  v_op        text;
  v_key       text;
  v_base      integer;
  v_title     text;
  v_hash      text;
  v_md        text;
  v_doc       jsonb;
  r           record;
  v_applied   jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if p_team_id is null then
    raise exception 'apply_ops: p_team_id is required' using errcode = '22023';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'apply_ops: p_ops must be a JSON array' using errcode = '22023';
  end if;
  if not (
    p_team_id in (select public.get_user_editable_teams())
    or p_team_id in (select id from public.teams where owner_id = auth.uid())
  ) then
    raise exception 'apply_ops: not a writer of this workspace' using errcode = '42501';
  end if;

  for op in select value from jsonb_array_elements(p_ops) loop
    v_kind := op->>'kind';
    v_op   := op->>'op';
    v_key  := op->>'id';
    v_base := nullif(op->>'base_version', '')::integer;
    v_hash := op->>'content_hash';
    if v_kind not in ('song', 'setlist') or v_op not in ('put', 'delete') or coalesce(v_key, '') = '' then
      raise exception 'apply_ops: malformed op %', op using errcode = '22023';
    end if;

    if v_kind = 'song' then
      v_md    := op->>'content';
      v_title := coalesce(nullif(op->>'title', ''), 'Untitled');
      select id, version, seq, content, title, updated_at into r
        from public.team_songs
       where team_id = p_team_id and song_key = v_key
       for update;

      if v_op = 'delete' then
        if not found then
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'delete', 'version', null);
        elsif v_base is null or r.version = v_base then
          delete from public.team_songs where id = r.id;
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'delete', 'version', r.version);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'delete', 'reason', 'version',
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.title, 'updated_at', r.updated_at));
        end if;
      else
        if v_md is null then
          raise exception 'apply_ops: put without content for song %', v_key using errcode = '22023';
        end if;
        if not found then
          if v_base is null then
            insert into public.team_songs (team_id, song_key, title, content, content_hash)
              values (p_team_id, v_key, v_title, v_md, v_hash)
              returning id, version, seq, updated_at into r;
            v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
          else
            v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'reason', 'missing');
          end if;
        elsif v_base is not null and r.version = v_base then
          update public.team_songs set title = v_title, content = v_md, content_hash = v_hash
           where id = r.id
           returning id, version, seq, updated_at into r;
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        elsif r.content = v_md then
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put',
            'reason', case when v_base is null then 'exists' else 'version' end,
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.title, 'updated_at', r.updated_at));
        end if;
      end if;

    else
      v_doc   := op->'content';
      v_title := coalesce(nullif(op->>'title', ''), nullif(v_doc->>'name', ''), 'Untitled Setlist');
      select id, version, seq, content, name, updated_at into r
        from public.team_setlists
       where team_id = p_team_id and setlist_key = v_key
       for update;

      if v_op = 'delete' then
        if not found then
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'delete', 'version', null);
        elsif v_base is null or r.version = v_base then
          delete from public.team_setlists where id = r.id;
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'delete', 'version', r.version);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'delete', 'reason', 'version',
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.name, 'updated_at', r.updated_at));
        end if;
      else
        if v_doc is null or jsonb_typeof(v_doc) <> 'object' then
          raise exception 'apply_ops: put without a JSON object content for setlist %', v_key using errcode = '22023';
        end if;
        if not found then
          if v_base is null then
            insert into public.team_setlists (team_id, setlist_key, name, content, content_hash)
              values (p_team_id, v_key, v_title, v_doc, v_hash)
              returning id, version, seq, updated_at into r;
            v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
          else
            v_conflicts := v_conflicts || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'reason', 'missing');
          end if;
        elsif v_base is not null and r.version = v_base then
          update public.team_setlists set name = v_title, content = v_doc, content_hash = v_hash
           where id = r.id
           returning id, version, seq, updated_at into r;
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        elsif r.content = v_doc then
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put',
            'reason', case when v_base is null then 'exists' else 'version' end,
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.name, 'updated_at', r.updated_at));
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end;
$$;

revoke execute on function public.apply_ops(uuid, jsonb) from public, anon;
grant  execute on function public.apply_ops(uuid, jsonb) to authenticated;
