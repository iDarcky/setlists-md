-- Team is full: tell someone joining before they wait for nothing.
-- (2026-11-20, for the new first-run screens.)
--
-- Until now a full team still took join requests, and the leader only found
-- out when Approve failed. This:
--   1. peek_join_link also returns is_full (members >= max_seats), so the
--      invite screen can say "<team> is full" straight away;
--   2. request_to_join returns { status: 'full' } instead of creating a new
--      request (and notifying leaders) when the team has no seat left.
--      Someone already waiting keeps their request.
--
-- Both functions are otherwise unchanged. peek_join_link accepts 6- to
-- 32-character codes, so this file is safe before or after
-- 20261122_short_join_codes.sql. The live app ignores is_full; a full team
-- shows "This invite doesn't work" there instead of a request that can never
-- be approved. Safe to run at any time.

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
  v_full    boolean;
begin
  if v_code !~ '^[a-z0-9]{6,32}$' then
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
  -- Same rule as approving a request: members only, against max_seats.
  v_full := v_count >= coalesce(v_team.max_seats, 10);

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
    'is_full', v_full,
    -- Only for a signed-in caller (the Waiting screen matches its request on
    -- it); an anonymous peek gets no ids at all.
    'team_id', case when v_uid is not null then v_team.id end
  );
end;
$$;

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

  -- A full team takes no new requests: the leader could never approve one.
  -- Someone already waiting keeps their request (it is updated above).
  if v_id is null and (select count(*) from public.team_members where team_id = v_team.id)
                        >= coalesce(v_team.max_seats, 10) then
    return json_build_object('status', 'full', 'team_id', v_team.id);
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

-- Check (read-only):
--   select public.peek_join_link('<a code>');   -- has "is_full"
