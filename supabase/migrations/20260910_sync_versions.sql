-- Sync foundations for the replica model — docs/SYNC-REDESIGN.md, step 2.
--
-- What a server-authoritative replica needs, and nothing the current engines
-- notice:
--
--   * `version`     — an integer the server bumps on every real change. The
--                     compare-and-swap token. Replaces "CAS on the text
--                     rendering of a timestamptz".
--   * `seq`         — a workspace change-feed position from ONE global
--                     sequence. A replica stores the last seq it has seen and
--                     asks for everything after it. Replaces "fetch the heads
--                     of every row and diff them against a manifest".
--   * `updated_by`  — who wrote it (auth.uid()). Free, and the activity feed
--                     and a future "edited by" chip want it.
--   * `team_deletions` — deletions as DATA. A row deleted from team_songs /
--                     team_setlists leaves a tombstone with its own seq, so the
--                     feed carries deletes and nothing is ever inferred from a
--                     row's ABSENCE (the inference that once wiped a church
--                     library). Hard deletes stay: FK cascades (schedules on a
--                     setlist), the activity trigger's DELETE branch and every
--                     existing reader keep working unchanged.
--   * `apply_ops`   — the write door: a batch of {put|delete, kind, id,
--                     base_version, content} in one round trip, each op
--                     guarded by base_version, conflicts returned WITH the
--                     server's copy so the client can merge without a second
--                     read. Identity is the client id (song_key/setlist_key);
--                     the row UUID never leaves the server.
--   * `sync_changes` — the read door: every song, setlist and deletion after a
--                     cursor, one query, one cursor, ordered by seq.
--
-- Additive and idempotent. The old engines keep working: they never read the
-- new columns, their compare-and-swap on updated_at still holds (the trigger
-- stamps updated_at with the server clock and hands it back through RETURNING),
-- and a no-op write leaves version/seq/updated_at exactly as they were, so it
-- neither wakes replicas nor moves anyone's baseline.
--
-- Ordering guarantee: seq is assigned under a per-workspace advisory lock held
-- to commit, so within one workspace seq order == commit order and a cursor can
-- never skip a row that commits late. Writers to the SAME workspace serialize
-- for the length of one transaction (a batch of ops, milliseconds); no
-- transaction touches two workspaces, so there is nothing to deadlock on.

-- ── 1. The change-feed sequence ─────────────────────────────────────────────
create sequence if not exists public.sync_seq;
-- The stamp trigger runs as the writing user (SECURITY INVOKER), so the
-- client role needs to be able to advance the sequence.
grant usage, select on sequence public.sync_seq to authenticated;

-- ── 2. Columns ──────────────────────────────────────────────────────────────
alter table public.team_songs
  add column if not exists version    integer not null default 1,
  add column if not exists seq        bigint,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.team_setlists
  add column if not exists version    integer not null default 1,
  add column if not exists seq        bigint,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

comment on column public.team_songs.version    is 'Bumped by trg_sync_stamp on every real change. The compare-and-swap token for apply_ops.';
comment on column public.team_songs.seq        is 'Change-feed position (public.sync_seq). sync_changes(team, since) returns rows with seq > since.';
comment on column public.team_songs.updated_by is 'auth.uid() of the last real change.';
comment on column public.team_setlists.version    is 'Bumped by trg_sync_stamp on every real change. The compare-and-swap token for apply_ops.';
comment on column public.team_setlists.seq        is 'Change-feed position (public.sync_seq). sync_changes(team, since) returns rows with seq > since.';
comment on column public.team_setlists.updated_by is 'auth.uid() of the last real change.';

-- ── 3. Backfill BEFORE the stamp trigger exists ─────────────────────────────
-- Existing rows get a seq so a replica's first pull (since = 0) sees them.
-- Order is irrelevant for correctness (everything is > 0). These UPDATEs touch
-- only `seq`, so the activity and snapshot triggers see no change and stay
-- silent, and updated_at is untouched — the old engines' baselines still match.
update public.team_songs    set seq = nextval('public.sync_seq') where seq is null;
update public.team_setlists set seq = nextval('public.sync_seq') where seq is null;

alter table public.team_songs    alter column seq set not null;
alter table public.team_setlists alter column seq set not null;

create index if not exists team_songs_team_seq_idx    on public.team_songs    (team_id, seq);
create index if not exists team_setlists_team_seq_idx on public.team_setlists (team_id, seq);

-- ── 4. Stamp trigger: version / seq / updated_by / updated_at ───────────────
-- BEFORE INSERT OR UPDATE on both tables. A "real change" is any column other
-- than the stamps themselves, the derived content_hash, or the identity key
-- (which a stamp trigger may fill in on an otherwise unchanged row). A no-op
-- write is frozen to the OLD stamps so it is invisible to every replica.
create or replace function public.stamp_sync_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ignored constant text[] := array['version', 'seq', 'updated_at', 'updated_by', 'content_hash', 'song_key', 'setlist_key'];
begin
  if TG_OP = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('setlists-md:sync:' || NEW.team_id::text));
    NEW.version    := 1;
    NEW.seq        := nextval('public.sync_seq');
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
    NEW.updated_at := now();
    return NEW;
  end if;

  if (to_jsonb(NEW) - ignored) is distinct from (to_jsonb(OLD) - ignored) then
    perform pg_advisory_xact_lock(hashtext('setlists-md:sync:' || NEW.team_id::text));
    NEW.version    := coalesce(OLD.version, 0) + 1;
    NEW.seq        := nextval('public.sync_seq');
    NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
    NEW.updated_at := now();
  else
    -- Nothing that matters changed: keep every stamp exactly as it was.
    NEW.version    := OLD.version;
    NEW.seq        := coalesce(OLD.seq, nextval('public.sync_seq'));
    NEW.updated_by := OLD.updated_by;
    NEW.updated_at := OLD.updated_at;
  end if;
  return NEW;
end;
$$;

revoke all on function public.stamp_sync_row() from public, anon, authenticated;

-- Named so it sorts AFTER trg_stamp_team_*_key: BEFORE triggers on one table
-- fire in name order, and the key must be filled in before the diff runs.
drop trigger if exists trg_sync_stamp on public.team_songs;
create trigger trg_sync_stamp
  before insert or update on public.team_songs
  for each row execute function public.stamp_sync_row();

drop trigger if exists trg_sync_stamp on public.team_setlists;
create trigger trg_sync_stamp
  before insert or update on public.team_setlists
  for each row execute function public.stamp_sync_row();

-- ── 5. Deletions as data ────────────────────────────────────────────────────
create table if not exists public.team_deletions (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  kind       text not null check (kind in ('song', 'setlist')),
  key        text not null,                 -- the client id (song_key / setlist_key)
  row_id     uuid not null,                 -- the server row it was
  seq        bigint not null default nextval('public.sync_seq'),
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);

create index if not exists team_deletions_team_seq_idx on public.team_deletions (team_id, seq);

alter table public.team_deletions enable row level security;

-- Members (and the owner) read their workspace's tombstones. No client writes:
-- rows come only from the SECURITY DEFINER trigger below.
drop policy if exists "team members read deletions" on public.team_deletions;
create policy "team members read deletions"
  on public.team_deletions
  for select
  using (
    team_id in (select public.get_user_teams())
    or team_id in (select id from public.teams where owner_id = (select auth.uid()))
  );

create or replace function public.record_team_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case TG_TABLE_NAME when 'team_songs' then 'song' else 'setlist' end;
  -- Read the key through jsonb: plpgsql resolves `OLD.<column>` per table at
  -- compile time, so naming a column the other table lacks fails even inside
  -- the CASE branch that is not taken.
  v_row  jsonb := to_jsonb(OLD);
  v_key  text := coalesce(v_row->>'song_key', v_row->>'setlist_key');
begin
  -- A workspace being deleted cascades through here; its tombstones would
  -- reference a team row that no longer exists. Nothing to record.
  if not exists (select 1 from public.teams where id = OLD.team_id) then
    return null;
  end if;
  begin
    perform pg_advisory_xact_lock(hashtext('setlists-md:sync:' || OLD.team_id::text));
    insert into public.team_deletions (team_id, kind, key, row_id, deleted_by)
    values (OLD.team_id, v_kind, coalesce(v_key, OLD.id::text), OLD.id, auth.uid());
  exception when others then
    -- Never let the tombstone block the delete itself.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.record_team_deletion() from public, anon, authenticated;

drop trigger if exists trg_record_deletion on public.team_songs;
create trigger trg_record_deletion
  after delete on public.team_songs
  for each row execute function public.record_team_deletion();

drop trigger if exists trg_record_deletion on public.team_setlists;
create trigger trg_record_deletion
  after delete on public.team_setlists
  for each row execute function public.record_team_deletion();

-- Realtime: a tombstone INSERT carries team_id, so a `team_id=eq.` filter
-- passes — unlike a DELETE event on the song table, which carries only the
-- primary key. This is how a replica hears about deletes while it is open.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_deletions'
  ) then
    execute 'alter publication supabase_realtime add table public.team_deletions';
  end if;
end $$;

-- ── 6. apply_ops — the write door ───────────────────────────────────────────
-- p_ops: JSON array of
--   { "kind": "song"|"setlist", "op": "put"|"delete", "id": <client id>,
--     "base_version": <int|null>, "content": <md text | setlist json>,
--     "title": <text>, "content_hash": <text|null> }
-- Returns { applied: [{kind,id,op,version,seq,updated_at}],
--           conflicts: [{kind,id,op,reason,server:{version,seq,content,title,updated_at}}] }.
--
-- Rules, per op (the row is locked FOR UPDATE for the length of the batch):
--   put, no row, base null       → insert (version 1)
--   put, no row, base set        → conflict 'missing' (deleted since you read it)
--   put, row, version == base    → update (version + 1)
--   put, row, content identical  → applied at the server's version (a retry
--                                  of an op the server already holds)
--   put, row, otherwise          → conflict 'exists' (base null) or 'version'
--   delete, no row               → applied (already gone)
--   delete, version == base      → delete (tombstone written by trigger)
--   delete, base null            → delete unconditionally
--   delete, otherwise            → conflict 'version' (an edit beats a stale delete)
-- Conflicts do not abort the batch; every other op still lands. The whole call
-- is one transaction, so a client sees either all of its applied ops or none.
-- SECURITY INVOKER: RLS decides who may write; the up-front check only turns a
-- silent 0-row write into a clear error.
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
            'server', jsonb_build_object('version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.title, 'updated_at', r.updated_at));
        end if;
      else
        if v_md is null then
          raise exception 'apply_ops: put without content for song %', v_key using errcode = '22023';
        end if;
        if not found then
          if v_base is null then
            insert into public.team_songs (team_id, song_key, title, content, content_hash)
              values (p_team_id, v_key, v_title, v_md, v_hash)
              returning version, seq, updated_at into r;
            v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
          else
            v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'reason', 'missing');
          end if;
        elsif v_base is not null and r.version = v_base then
          update public.team_songs set title = v_title, content = v_md, content_hash = v_hash
           where id = r.id
           returning version, seq, updated_at into r;
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        elsif r.content = v_md then
          v_applied := v_applied || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'song', 'id', v_key, 'op', 'put',
            'reason', case when v_base is null then 'exists' else 'version' end,
            'server', jsonb_build_object('version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.title, 'updated_at', r.updated_at));
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
            'server', jsonb_build_object('version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.name, 'updated_at', r.updated_at));
        end if;
      else
        if v_doc is null or jsonb_typeof(v_doc) <> 'object' then
          raise exception 'apply_ops: put without a JSON object content for setlist %', v_key using errcode = '22023';
        end if;
        if not found then
          if v_base is null then
            insert into public.team_setlists (team_id, setlist_key, name, content, content_hash)
              values (p_team_id, v_key, v_title, v_doc, v_hash)
              returning version, seq, updated_at into r;
            v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
          else
            v_conflicts := v_conflicts || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'reason', 'missing');
          end if;
        elsif v_base is not null and r.version = v_base then
          update public.team_setlists set name = v_title, content = v_doc, content_hash = v_hash
           where id = r.id
           returning version, seq, updated_at into r;
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        elsif r.content = v_doc then
          v_applied := v_applied || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put', 'version', r.version, 'seq', r.seq, 'updated_at', r.updated_at);
        else
          v_conflicts := v_conflicts || jsonb_build_object('kind', 'setlist', 'id', v_key, 'op', 'put',
            'reason', case when v_base is null then 'exists' else 'version' end,
            'server', jsonb_build_object('version', r.version, 'seq', r.seq, 'content', r.content, 'title', r.name, 'updated_at', r.updated_at));
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end;
$$;

revoke execute on function public.apply_ops(uuid, jsonb) from public, anon;
grant  execute on function public.apply_ops(uuid, jsonb) to authenticated;

-- ── 7. sync_changes — the read door ─────────────────────────────────────────
-- Everything in a workspace after a cursor, one query, ordered by seq:
--   { changes: [{seq, kind: 'song'|'setlist'|'deletion', key, row}],
--     next_seq: <the last seq returned, or p_since when empty>,
--     more: <true when the page was full — call again with next_seq> }
-- SECURITY INVOKER: RLS scopes it to workspaces the caller belongs to; a
-- stranger gets an empty feed, not an error.
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
               'row_id', s.id, 'title', s.title, 'content', s.content, 'content_hash', s.content_hash,
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
