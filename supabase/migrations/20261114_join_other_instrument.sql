-- "Other" instrument (2026-11-14): a church sax player could not be scheduled.
--
-- The app now has an `other` instrument token (src/data/instruments.js). The
-- join form's last choice, which used to read "Something else" and stayed on
-- the request only, now reads "Other instrument" and stores the same `other`
-- token, so approval must carry it into team_members.instruments like the
-- other instruments. This re-creates approve_join_request_internal with
-- `other` added to the list; nothing else changes.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

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
  -- "Sound desk" and "Lyrics / slides" are not instruments, so they stay on the
  -- request only.
  select coalesce(array_agg(p), '{}') into v_insts
    from unnest(v_req.parts) p
   where p in ('vocals', 'acoustic-guitar', 'electric-guitar', 'bass-guitar', 'keys', 'piano', 'drums', 'other');

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
