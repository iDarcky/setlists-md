-- JSON on the wire — docs/SYNC-REDESIGN.md, step 5.
--
-- A song row gains `doc`: the whole v2 song as one JSON document (every
-- arrangement, the key-change overlay, the length, the tab library, unknown
-- frontmatter) — what the replica engine now reads and writes. `content`
-- (markdown, ONE arrangement) stays: older builds still read and write it,
-- the activity feed's no-op guard hashes it, the version history stores it,
-- and this build keeps writing it beside the document. Nothing here is
-- dropped; that is a later step, once no client reads the markdown.
--
-- The one rule the server enforces: A STALE DOCUMENT NEVER OUTLIVES THE
-- MARKDOWN IT DISAGREES WITH. A write that changes `content` without
-- bringing a new `doc` — an older build editing a song — drops the row's
-- document (trg_guard_song_doc), so a reader falls back to the markdown
-- instead of trusting a document that no longer describes the song. A
-- writer on this build then re-uploads the document on its next pass.
--
-- Additive and idempotent. Applied to production 2026-09-10.

-- ── 1. The column, on the songs and on their version history ────────────────
alter table public.team_songs add column if not exists doc jsonb;
comment on column public.team_songs.doc is
  'The whole v2 song as JSON (every arrangement). NULL = written by a build before step 5, or by an older build since: read `content` instead. Dropped by trg_guard_song_doc when content changes without it.';

alter table public.team_song_versions add column if not exists doc jsonb;

-- ── 2. The guard ────────────────────────────────────────────────────────────
-- BEFORE UPDATE, named to sort before trg_stamp_team_song_key and
-- trg_sync_stamp (BEFORE triggers fire in name order), so the stamp diff sees
-- the dropped document. Note that trg_sync_stamp already counts a changed
-- `doc` as a real change: it diffs every column not in its ignore list.
create or replace function public.guard_song_doc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.content is distinct from OLD.content
     and NEW.doc is not distinct from OLD.doc then
    NEW.doc := null;
  end if;
  return NEW;
end;
$$;

revoke all on function public.guard_song_doc() from public, anon, authenticated;

drop trigger if exists trg_guard_song_doc on public.team_songs;
create trigger trg_guard_song_doc
  before update on public.team_songs
  for each row execute function public.guard_song_doc();

-- ── 3. Version history: snapshot the document too ───────────────────────────
-- A change to the document alone (a second arrangement edited) is a version;
-- the restore of a multi-arrangement song needs the document, not the markdown.
create or replace function public.snapshot_team_song()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if TG_OP = 'UPDATE'
     and NEW.content is not distinct from OLD.content
     and NEW.doc is not distinct from OLD.doc then
    return null;
  end if;

  begin
    v_key := coalesce(NEW.song_key, substring(NEW.content from 'songId: ([a-z0-9_]+)'), NEW.id::text);

    insert into public.team_song_versions (team_id, song_key, title, content, content_hash, doc, author_id)
    values (NEW.team_id, v_key, NEW.title, NEW.content, NEW.content_hash, NEW.doc, auth.uid());

    delete from public.team_song_versions
    where team_id = NEW.team_id and song_key = v_key
      and id not in (
        select id from public.team_song_versions
        where team_id = NEW.team_id and song_key = v_key
        order by created_at desc
        limit 30
      );
  exception when others then
    return null;
  end;

  return null;
end;
$$;

revoke all on function public.snapshot_team_song() from public, anon, authenticated;

-- ── 4. Activity feed: a document-only edit is an edit; the one-time upgrade is not
-- Same function as 20260718_activity_content_hash, plus one clause on the
-- song branch. A write that changes the document with the markdown unchanged
-- (an edit to an arrangement the markdown does not carry) is logged. A write
-- that gives a row its FIRST document with the markdown unchanged — the
-- replica upgrading a row this build has not touched — is not: nobody edited
-- anything.
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

  insert into public.team_activity (team_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  values (v_team_id, v_actor, v_action, v_entity_type, v_entity_id, v_entity_name, v_meta);

  return null;
end;
$$;

-- ── 5. apply_ops: a song put carries `doc` ──────────────────────────────────
-- Same semantics as 20260910_sync_versions + 20260910_apply_ops_row_id, plus:
--   * a song put may carry `doc` (a JSON object). Stored beside `content`.
--   * a song put WITHOUT `doc` (an older build) keeps the row's document only
--     when the markdown is unchanged; otherwise the document is dropped.
--   * "identical content on a stale base counts as applied" now means the
--     markdown AND (when sent) the document are identical.
--   * conflict payloads carry the server's `doc`.
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
  v_sdoc      jsonb;
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
      v_sdoc  := case when jsonb_typeof(op->'doc') = 'object' then op->'doc' else null end;
      v_title := coalesce(nullif(op->>'title', ''), 'Untitled');
      select id, version, seq, content, doc, title, updated_at into r
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
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'doc', r.doc, 'title', r.title, 'updated_at', r.updated_at));
        end if;
      else
        if v_md is null then
          raise exception 'apply_ops: put without content for song %', v_key using errcode = '22023';
        end if;
        if not found then
          if v_base is null then
            insert into public.team_songs (team_id, song_key, title, content, content_hash, doc)
              values (p_team_id, v_key, v_title, v_md, v_hash, v_sdoc)
              returning id, version, seq, updated_at into r;
            v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
          else
            v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'reason', 'missing');
          end if;
        elsif v_base is not null and r.version = v_base then
          update public.team_songs
             set title = v_title, content = v_md, content_hash = v_hash,
                 doc = case when v_sdoc is not null then v_sdoc
                            when r.content = v_md then r.doc
                            else null end
           where id = r.id
           returning id, version, seq, updated_at into r;
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        elsif r.content = v_md and (v_sdoc is null or r.doc is not distinct from v_sdoc) then
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'row_id', r.id, 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put',
            'reason', case when v_base is null then 'exists' else 'version' end,
            'server', jsonb_build_object('row_id', r.id, 'version', r.version, 'seq', r.seq, 'content', r.content, 'doc', r.doc, 'title', r.title, 'updated_at', r.updated_at));
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

-- ── 6. sync_changes: song rows carry `doc` ──────────────────────────────────
create or replace function public.sync_changes(p_team_id uuid, p_since bigint default 0, p_limit integer default 500)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with lim as (
    select greatest(1, least(coalesce(p_limit, 500), 1000)) as n
  ),
  feed as (
    (
      select s.seq, 'song'::text as kind, s.song_key as key,
             jsonb_build_object(
               'row_id', s.id, 'title', s.title, 'content', s.content, 'content_hash', s.content_hash, 'doc', s.doc,
               'version', s.version, 'updated_at', s.updated_at, 'updated_by', s.updated_by) as row
        from public.team_songs s
       where s.team_id = p_team_id and s.seq > coalesce(p_since, 0)
    )
    union all
    (
      select l.seq, 'setlist'::text, l.setlist_key,
             jsonb_build_object(
               'row_id', l.id, 'name', l.name, 'content', l.content, 'content_hash', l.content_hash,
               'version', l.version, 'updated_at', l.updated_at, 'updated_by', l.updated_by, 'created_by', l.created_by)
        from public.team_setlists l
       where l.team_id = p_team_id and l.seq > coalesce(p_since, 0)
    )
    union all
    (
      select d.seq, 'deletion'::text, d.key,
             jsonb_build_object('kind', d.kind, 'row_id', d.row_id, 'deleted_at', d.deleted_at, 'deleted_by', d.deleted_by)
        from public.team_deletions d
       where d.team_id = p_team_id and d.seq > coalesce(p_since, 0)
    )
    order by seq
    limit (select n from lim)
  )
  select jsonb_build_object(
    'changes', coalesce(jsonb_agg(jsonb_build_object('seq', f.seq, 'kind', f.kind, 'key', f.key, 'row', f.row) order by f.seq), '[]'::jsonb),
    'next_seq', coalesce(max(f.seq), coalesce(p_since, 0)),
    'more', count(*) >= (select n from lim)
  )
  from feed f;
$$;

revoke execute on function public.sync_changes(uuid, bigint, integer) from public, anon;
grant  execute on function public.sync_changes(uuid, bigint, integer) to authenticated;
