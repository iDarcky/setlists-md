-- 20261019_join_links.sql — one resettable join link per church/team, and
-- leader-approved join requests (docs/PLAN.md §2.3).
--
-- Today an invite is email-only (`invite_user_to_team` + `claim_team_invites`,
-- matched on the exact address), which "Hide my email" breaks and which sends
-- no email at all. This adds the link flow beside it — the email path is left
-- exactly as it is:
--
--   * `team_join_links`   — one row per workspace: the code inside the URL
--                           (`/join/<code>`), an on/off switch, who made it.
--                           Resetting replaces the code; the old one simply
--                           stops resolving. Readable by roster managers only.
--   * `team_join_requests`— "I'd like to join", one PENDING row per
--                           (team, user). A requester reads their own rows; a
--                           roster manager reads their team's. No client
--                           INSERT/UPDATE/DELETE — every write is an RPC below.
--
-- Who manages it: the team owner, admins AND leaders — the same "roster
-- managers" set `notify_on_schedule_decline` already fans out to. That is one
-- step wider than the email invite (owner + admin only): the product decision
-- for the join link is "a leader/admin approves each person". Everyone who is
-- approved joins as `member`.
--
-- Seats: approval checks `team_members` against `teams.max_seats` exactly the
-- way `invite_user_to_team` does (pending email invites are NOT counted by the
-- DB; the client's "seats left" counter does count them). A pending join
-- request takes no seat until it is approved.
--
-- Anon surface: ONLY `peek_join_link(code)` — the landing page calls it before
-- sign-in. It returns the church's name, logo, member count and one leader's
-- display name, nothing else (no ids, no emails).
--
-- Additive and idempotent. Write new policies with `(select auth.uid())`
-- (20260911_db_hygiene).

-- ── 1. Tables ────────────────────────────────────────────────────────────────

create table if not exists public.team_join_links (
  team_id    uuid        primary key references public.teams(id) on delete cascade,
  code       text        not null unique check (code ~ '^[a-z0-9]{8,32}$'),
  enabled    boolean     not null default true,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.team_join_links is
  'One resettable join link per workspace. The code is the secret in /join/<code>; reset = new code. RPC-only writes.';

create table if not exists public.team_join_requests (
  id           uuid        primary key default gen_random_uuid(),
  team_id      uuid        not null references public.teams(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  display_name text        not null default '' check (char_length(display_name) <= 80),
  parts        text[]      not null default '{}' check (cardinality(parts) <= 12),
  -- The code the request was made with. Kept for the record only: resetting
  -- the link does NOT touch requests already made with the old code.
  code         text,
  status       text        not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid        references auth.users(id) on delete set null
);

comment on table public.team_join_requests is
  'Join-link requests. One pending row per (team,user); approve/decline via RPC. Requester reads own rows; owner/admin/leader read their team''s.';

-- One PENDING request per person per team (history rows may repeat).
create unique index if not exists team_join_requests_one_pending_idx
  on public.team_join_requests (team_id, user_id) where status = 'pending';
create index if not exists team_join_requests_team_status_idx
  on public.team_join_requests (team_id, status, created_at);
create index if not exists team_join_requests_user_idx
  on public.team_join_requests (user_id, created_at desc);
-- Covering indexes for the auth.users foreign keys (advisor 0001).
create index if not exists team_join_requests_decided_by_idx
  on public.team_join_requests (decided_by);
create index if not exists team_join_links_created_by_idx
  on public.team_join_links (created_by);

-- ── 2. Who may manage a workspace's link + requests ─────────────────────────
-- Owner, admins and leaders of a SHARED workspace (never a personal one).
-- Set-returning like get_user_admin_teams(), so policies can use it as an
-- InitPlan: `team_id in (select public.get_user_join_manager_teams())`.

create or replace function public.get_user_join_manager_teams()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.team_id
    from public.team_members m
    join public.teams t on t.id = m.team_id
   where m.user_id = auth.uid()
     and m.role in ('admin', 'leader')
     and t.kind <> 'personal'
  union
  select t.id
    from public.teams t
   where t.owner_id = auth.uid()
     and t.kind <> 'personal';
$$;

revoke execute on function public.get_user_join_manager_teams() from public, anon;
grant  execute on function public.get_user_join_manager_teams() to authenticated;

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

alter table public.team_join_links    enable row level security;
alter table public.team_join_requests enable row level security;

drop policy if exists "team_join_links_select_managers" on public.team_join_links;
create policy "team_join_links_select_managers" on public.team_join_links
  for select to authenticated
  using (team_id in (select public.get_user_join_manager_teams()));

drop policy if exists "team_join_requests_select" on public.team_join_requests;
create policy "team_join_requests_select" on public.team_join_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or team_id in (select public.get_user_join_manager_teams())
  );

-- No write policies: RLS already refuses client writes, and the explicit
-- revokes make that impossible to undo by adding a careless policy later.
revoke insert, update, delete, truncate on public.team_join_links    from anon, authenticated;
revoke insert, update, delete, truncate on public.team_join_requests from anon, authenticated;
revoke select on public.team_join_links    from anon;
revoke select on public.team_join_requests from anon;

-- ── 4. Code generation ───────────────────────────────────────────────────────
-- 12 characters from a 31-letter alphabet with no look-alikes (no 0/o, 1/l/i),
-- ≈59 bits. Randomness comes from gen_random_uuid() (core since PG13, CSPRNG),
-- skipping the uuid's version/variant bytes — pgcrypto lives in `extensions`
-- on Supabase, which this function's search_path deliberately excludes.

create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alpha constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_pos   int[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14];
  v_out   text := '';
  i       int;
begin
  foreach i in array v_pos loop
    v_out := v_out || substr(v_alpha, 1 + (get_byte(v_bytes, i) % 31), 1);
  end loop;
  return v_out;
end;
$$;

revoke execute on function public.generate_join_code() from public, anon, authenticated;

-- Shared guard for the management RPCs below.
create or replace function public.assert_join_manager(p_team_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_team_id is null or p_team_id not in (select public.get_user_join_manager_teams()) then
    raise exception 'Only the owner, an admin or a leader can manage join requests for this team.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_join_manager(uuid) from public, anon, authenticated;

-- ── 5. Link management (owner / admin / leader) ─────────────────────────────

-- Returns the team's link, creating it on first use.
create or replace function public.get_team_join_link(p_team_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.team_join_links%rowtype;
  v_try int := 0;
begin
  perform public.assert_join_manager(p_team_id);

  select * into v_row from public.team_join_links where team_id = p_team_id;
  while not found loop
    v_try := v_try + 1;
    begin
      insert into public.team_join_links (team_id, code, created_by)
      values (p_team_id, public.generate_join_code(), auth.uid())
      returning * into v_row;
    exception when unique_violation then
      -- Either another device created the team's row first (then read it),
      -- or the new code collided with another team's (then try again).
      if v_try >= 5 then raise; end if;
    end;
    if v_row.team_id is null then
      select * into v_row from public.team_join_links where team_id = p_team_id;
    end if;
  end loop;

  return json_build_object(
    'team_id', v_row.team_id,
    'code', v_row.code,
    'enabled', v_row.enabled,
    'created_at', v_row.created_at
  );
end;
$$;

-- New code; the old one stops resolving immediately. Re-enables the link.
-- Pending requests made with the old code are left alone.
create or replace function public.reset_team_join_link(p_team_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.team_join_links%rowtype;
  v_try int := 0;
begin
  perform public.assert_join_manager(p_team_id);
  loop
    v_try := v_try + 1;
    begin
      insert into public.team_join_links (team_id, code, created_by)
      values (p_team_id, public.generate_join_code(), auth.uid())
      on conflict (team_id) do update
        set code = excluded.code,
            enabled = true,
            created_by = excluded.created_by,
            created_at = now(),
            updated_at = now()
      returning * into v_row;
      exit;
    exception when unique_violation then
      -- The fresh code collided with another team's code: draw again.
      if v_try >= 5 then raise; end if;
    end;
  end loop;

  return json_build_object(
    'team_id', v_row.team_id,
    'code', v_row.code,
    'enabled', v_row.enabled,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.set_team_join_link_enabled(p_team_id uuid, p_enabled boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link json;
begin
  perform public.assert_join_manager(p_team_id);
  -- Make sure the row exists (turning on a link nobody opened yet).
  v_link := public.get_team_join_link(p_team_id);
  update public.team_join_links
     set enabled = coalesce(p_enabled, false), updated_at = now()
   where team_id = p_team_id;
  return public.get_team_join_link(p_team_id);
end;
$$;

-- ── 6. Peek (anon OK) ────────────────────────────────────────────────────────
-- What the landing page shows before sign-in. Statuses:
--   ok       — { team_name, logo_url, initials, kind, member_count, leader_name,
--                and when signed in: is_member, my_status, team_id }
--   disabled — the link exists but is switched off (no team details)
--   invalid  — no such code (never existed, or was reset)

create or replace function public.peek_join_link(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code    text := lower(btrim(coalesce(p_code, '')));
  v_link    public.team_join_links%rowtype;
  v_team    public.teams%rowtype;
  v_count   int;
  v_leader  text;
  v_uid     uuid := auth.uid();
  v_member  boolean := false;
  v_status  text;
  v_initials text;
begin
  if v_code !~ '^[a-z0-9]{8,32}$' then
    return json_build_object('status', 'invalid');
  end if;

  select * into v_link from public.team_join_links where code = v_code;
  if not found then
    return json_build_object('status', 'invalid');
  end if;

  select * into v_team from public.teams where id = v_link.team_id;
  if not found or v_team.kind = 'personal' then
    return json_build_object('status', 'invalid');
  end if;

  if not v_link.enabled then
    return json_build_object('status', 'disabled');
  end if;

  select count(*) into v_count from public.team_members where team_id = v_team.id;

  -- "<leader> and N others are already in": whoever made the link if they are
  -- still a manager, else the owner, else any admin/leader. Display name only.
  select nullif(btrim(p.display_name), '') into v_leader
    from (
      select v_link.created_by as uid, 0 as rank
       where v_link.created_by is not null
         and (v_link.created_by = v_team.owner_id
              or exists (select 1 from public.team_members m
                          where m.team_id = v_team.id and m.user_id = v_link.created_by
                            and m.role in ('admin', 'leader')))
      union all
      select v_team.owner_id, 1 where v_team.owner_id is not null
      union all
      select m.user_id, case m.role when 'admin' then 2 else 3 end
        from public.team_members m
       where m.team_id = v_team.id and m.role in ('admin', 'leader')
    ) c
    join public.profiles p on p.id = c.uid
   where nullif(btrim(p.display_name), '') is not null
   order by c.rank
   limit 1;

  v_initials := upper(left(regexp_replace(coalesce(v_team.name, ''), '[^[:alnum:] ]', '', 'g'), 1))
             || coalesce(upper(left(split_part(regexp_replace(coalesce(v_team.name, ''), '[^[:alnum:] ]', '', 'g'), ' ', 2), 1)), '');

  if v_uid is not null then
    v_member := exists (select 1 from public.team_members where team_id = v_team.id and user_id = v_uid);
    select r.status into v_status
      from public.team_join_requests r
     where r.team_id = v_team.id and r.user_id = v_uid
     order by (r.status = 'pending') desc, r.created_at desc
     limit 1;
  end if;

  return json_build_object(
    'status', 'ok',
    'team_name', v_team.name,
    'logo_url', v_team.logo_url,
    'initials', nullif(v_initials, ''),
    'kind', v_team.kind,
    'member_count', v_count,
    'leader_name', v_leader,
    'is_member', v_member,
    'my_status', v_status,
    -- Only for a signed-in caller (the Waiting screen matches its request on
    -- it); an anonymous peek gets no ids at all.
    'team_id', case when v_uid is not null then v_team.id end
  );
end;
$$;

-- ── 7. Ask to join (signed in) ───────────────────────────────────────────────
-- Returns { status: 'pending' | 'member' | 'invalid' | 'disabled', request_id?,
-- team_id? }. Idempotent: asking again while pending updates the name/parts.

create or replace function public.request_to_join(
  p_code text,
  p_display_name text default null,
  p_parts text[] default '{}'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text := lower(btrim(coalesce(p_code, '')));
  v_link  public.team_join_links%rowtype;
  v_team  public.teams%rowtype;
  v_name  text;
  v_parts text[];
  v_id    uuid;
  v_new   boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_link from public.team_join_links where code = v_code;
  if not found then
    return json_build_object('status', 'invalid');
  end if;
  select * into v_team from public.teams where id = v_link.team_id;
  if not found or v_team.kind = 'personal' then
    return json_build_object('status', 'invalid');
  end if;
  if not v_link.enabled then
    return json_build_object('status', 'disabled');
  end if;

  if exists (select 1 from public.team_members where team_id = v_team.id and user_id = v_uid) then
    return json_build_object('status', 'member', 'team_id', v_team.id);
  end if;

  -- Clean the input: trimmed name (≤80, falling back to the profile's), and at
  -- most 12 distinct non-empty parts of ≤40 chars each.
  v_name := left(btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g')), 80);
  if v_name = '' then
    select left(btrim(coalesce(display_name, '')), 80) into v_name from public.profiles where id = v_uid;
  end if;
  v_name := coalesce(v_name, '');

  select coalesce(array_agg(x order by ord), '{}') into v_parts
    from (
      select distinct on (lower(left(btrim(p), 40))) left(btrim(p), 40) as x, ord
        from unnest(coalesce(p_parts, '{}')) with ordinality as u(p, ord)
       where btrim(coalesce(p, '')) <> ''
       order by lower(left(btrim(p), 40)), ord
    ) d;
  v_parts := v_parts[1:12];

  update public.team_join_requests
     set display_name = v_name, parts = v_parts, code = v_code
   where team_id = v_team.id and user_id = v_uid and status = 'pending'
  returning id into v_id;

  -- A decline holds for a day: without this, one person could re-ask (and
  -- re-notify every leader) in a loop.
  if v_id is null and exists (
    select 1 from public.team_join_requests
     where team_id = v_team.id and user_id = v_uid and status = 'declined'
       and decided_at > now() - interval '24 hours'
  ) then
    return json_build_object('status', 'declined', 'team_id', v_team.id);
  end if;

  if v_id is null then
    begin
      insert into public.team_join_requests (team_id, user_id, display_name, parts, code)
      values (v_team.id, v_uid, v_name, v_parts, v_code)
      returning id into v_id;
      v_new := true;
    exception when unique_violation then
      -- A second tap raced the first: the pending row exists now.
      select id into v_id from public.team_join_requests
       where team_id = v_team.id and user_id = v_uid and status = 'pending';
    end;
  end if;

  -- Tell every roster manager, once per new request. The requester is not a
  -- member, so they never receive one themselves.
  if v_new then
    insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
    select v_team.id, mgr.user_id, v_uid, 'join_request',
           'Asking to join',
           coalesce(nullif(v_name, ''), 'Someone') || ' wants to join ' || v_team.name || '.',
           jsonb_build_object('request_id', v_id, 'requester_id', v_uid, 'parts', to_jsonb(v_parts))
      from (
        select m.user_id from public.team_members m
         where m.team_id = v_team.id and m.role in ('admin', 'leader')
        union
        select v_team.owner_id where v_team.owner_id is not null
      ) mgr
     where mgr.user_id is not null and mgr.user_id <> v_uid;
  end if;

  return json_build_object('status', 'pending', 'request_id', v_id, 'team_id', v_team.id);
end;
$$;

-- ── 8. My requests (signed in) ───────────────────────────────────────────────
-- The requester cannot read `teams` before they are a member, so the church's
-- name and logo come through here.

create or replace function public.list_my_join_requests()
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  logo_url text,
  display_name text,
  parts text[],
  status text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.team_id, t.name, t.logo_url, r.display_name, r.parts, r.status, r.created_at, r.decided_at
    from public.team_join_requests r
    join public.teams t on t.id = r.team_id
   where r.user_id = auth.uid()
   order by r.created_at desc
   limit 50;
$$;

-- ── 9. A team's requests (owner / admin / leader) ───────────────────────────
-- The table is readable directly under RLS; this adds the requester's email so
-- the approver can tell two "Andrei"s apart.

create or replace function public.list_team_join_requests(p_team_id uuid, p_status text default 'pending')
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  email text,
  avatar_url text,
  parts text[],
  status text,
  created_at timestamptz,
  decided_at timestamptz,
  decided_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_join_manager(p_team_id);
  return query
    select r.id, r.user_id, r.display_name, coalesce(p.email, u.email)::text, p.avatar_url,
           r.parts, r.status, r.created_at, r.decided_at, r.decided_by
      from public.team_join_requests r
      left join public.profiles p on p.id = r.user_id
      left join auth.users u on u.id = r.user_id
     where r.team_id = p_team_id
       and (p_status is null or r.status = p_status)
     order by r.created_at
     limit 500;
end;
$$;

-- ── 10. Approve / decline ────────────────────────────────────────────────────
-- Internal worker shared by approve + approve-all. The caller has already
-- checked the manager role and locked the team row (serialises seat counting).
-- Returns 'approved' | 'already_member' | 'at_capacity' | <current status>.

create or replace function public.approve_join_request_internal(p_request_id uuid, p_team public.teams)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   public.team_join_requests%rowtype;
  v_seats int;
  v_insts text[];
  v_rows  int;
begin
  select * into v_req from public.team_join_requests
   where id = p_request_id and team_id = p_team.id
   for update;
  if not found then return 'not_found'; end if;
  if v_req.status <> 'pending' then return v_req.status; end if;

  if exists (select 1 from public.team_members where team_id = p_team.id and user_id = v_req.user_id) then
    update public.team_join_requests
       set status = 'approved', decided_at = now(), decided_by = auth.uid()
     where id = v_req.id;
    return 'already_member';
  end if;

  -- Same rule as invite_user_to_team: members only, against max_seats.
  select count(*) into v_seats from public.team_members where team_id = p_team.id;
  if v_seats >= coalesce(p_team.max_seats, 10) then
    return 'at_capacity';
  end if;

  -- Carry the instrument answers over as canonical tokens (data/instruments.js).
  -- "Sound desk" and "Something else" are not instruments, so they stay on the
  -- request only.
  select coalesce(array_agg(p), '{}') into v_insts
    from unnest(v_req.parts) p
   where p in ('vocals', 'acoustic-guitar', 'electric-guitar', 'bass-guitar', 'keys', 'piano', 'drums');

  insert into public.team_members (team_id, user_id, role, invited_by, instruments)
  values (p_team.id, v_req.user_id, 'member', auth.uid(), v_insts)
  on conflict (team_id, user_id) do nothing;
  get diagnostics v_rows = row_count;

  update public.team_join_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where id = v_req.id;

  if v_rows > 0 then
    insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
    values (p_team.id, v_req.user_id, auth.uid(), 'join_approved',
            'You''re in',
            'You''re now part of ' || p_team.name || '.',
            jsonb_build_object('request_id', v_req.id));
  end if;

  return case when v_rows > 0 then 'approved' else 'already_member' end;
end;
$$;

revoke execute on function public.approve_join_request_internal(uuid, public.teams) from public, anon, authenticated;

create or replace function public.approve_join_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_team    public.teams%rowtype;
  v_result  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  select team_id into v_team_id from public.team_join_requests where id = p_request_id;
  if v_team_id is null then
    return json_build_object('status', 'not_found');
  end if;
  perform public.assert_join_manager(v_team_id);

  select * into v_team from public.teams where id = v_team_id for update;
  v_result := public.approve_join_request_internal(p_request_id, v_team);

  if v_result = 'at_capacity' then
    raise exception 'Team is at maximum capacity (%). Upgrade plan for more seats.', v_team.max_seats;
  end if;
  return json_build_object('status', v_result, 'request_id', p_request_id);
end;
$$;

create or replace function public.decline_join_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_status  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  select team_id into v_team_id from public.team_join_requests where id = p_request_id;
  if v_team_id is null then
    return json_build_object('status', 'not_found');
  end if;
  perform public.assert_join_manager(v_team_id);

  update public.team_join_requests
     set status = 'declined', decided_at = now(), decided_by = auth.uid()
   where id = p_request_id and status = 'pending'
  returning status into v_status;

  if v_status is null then
    select status into v_status from public.team_join_requests where id = p_request_id;
  end if;
  return json_build_object('status', v_status, 'request_id', p_request_id);
end;
$$;

-- Approves oldest-first until the seats run out.
-- Returns { approved, already_member, remaining, at_capacity }.
create or replace function public.approve_all_join_requests(p_team_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team     public.teams%rowtype;
  v_req      record;
  v_result   text;
  v_approved int := 0;
  v_already  int := 0;
  v_full     boolean := false;
  v_left     int;
begin
  perform public.assert_join_manager(p_team_id);
  select * into v_team from public.teams where id = p_team_id for update;

  for v_req in
    select id from public.team_join_requests
     where team_id = p_team_id and status = 'pending'
     order by created_at
  loop
    v_result := public.approve_join_request_internal(v_req.id, v_team);
    if v_result = 'approved' then
      v_approved := v_approved + 1;
    elsif v_result = 'already_member' then
      v_already := v_already + 1;
    elsif v_result = 'at_capacity' then
      v_full := true;
      exit;
    end if;
  end loop;

  select count(*) into v_left from public.team_join_requests
   where team_id = p_team_id and status = 'pending';

  return json_build_object(
    'approved', v_approved,
    'already_member', v_already,
    'remaining', v_left,
    'at_capacity', v_full
  );
end;
$$;

-- ── 11. Grants ───────────────────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default (20260615_audit_hardening), so
-- revoke from PUBLIC first and grant back only to the role that calls each.

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_team_join_link(uuid)',
    'public.reset_team_join_link(uuid)',
    'public.set_team_join_link_enabled(uuid, boolean)',
    'public.request_to_join(text, text, text[])',
    'public.list_my_join_requests()',
    'public.list_team_join_requests(uuid, text)',
    'public.approve_join_request(uuid)',
    'public.decline_join_request(uuid)',
    'public.approve_all_join_requests(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- The landing page runs before sign-in.
revoke execute on function public.peek_join_link(text) from public;
grant  execute on function public.peek_join_link(text) to anon, authenticated;

-- ── 12. Realtime ─────────────────────────────────────────────────────────────
-- The Waiting screen listens for its own row flipping to approved/declined and
-- the Team screen for new requests (`team_id=eq.` filter) — both need the
-- table in the publication, and FULL identity so filtered UPDATE/DELETE events
-- carry team_id/user_id (Known Gotchas, 20260701_realtime_publication).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_join_requests'
     ) then
    execute 'alter publication supabase_realtime add table public.team_join_requests';
  end if;
end $$;

alter table public.team_join_requests replica identity full;
