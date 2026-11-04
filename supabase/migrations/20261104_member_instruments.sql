-- What each person plays, saved for real (2026-11-04).
--
-- ⚠ The bug this fixes: the only UPDATE policy on team_members lets the TEAM
-- OWNER change rows, nobody else. So when a member picked "Drums" in their
-- profile, the update matched 0 rows, returned no error, and nothing was
-- saved. On 2026-11-04, 15 of 17 non-owners had no parts at all.
--
-- Rather than widen the UPDATE policy (which would let a member change their
-- own `role` too), parts go through one function that writes ONLY the
-- `instruments` column:
--   * anyone may set their own parts;
--   * the church owner and leaders (role admin or leader) may set anyone's.
--
-- Safe to run more than once.

create or replace function public.set_member_instruments(p_member_id uuid, p_instruments text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.team_members%rowtype;
  v_clean text[];
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select * into v_member from public.team_members where id = p_member_id;
  if not found then
    raise exception 'That person is not in this church.' using errcode = 'P0002';
  end if;

  if v_member.user_id <> v_uid
     and not exists (select 1 from public.teams t where t.id = v_member.team_id and t.owner_id = v_uid)
     and not exists (select 1 from public.team_members m
                      where m.team_id = v_member.team_id and m.user_id = v_uid
                        and m.role in ('admin', 'leader')) then
    raise exception 'Only leaders can change what someone else plays.' using errcode = '42501';
  end if;

  -- Trimmed, no blanks, no repeats, order kept; short tokens only
  -- (`drums`, `vocals:lead-female`).
  select coalesce(array_agg(tok order by first_pos), '{}')
    into v_clean
    from (
      select btrim(x) as tok, min(pos) as first_pos
        from unnest(coalesce(p_instruments, '{}')) with ordinality as u(x, pos)
       where btrim(x) <> '' and length(btrim(x)) <= 40
       group by btrim(x)
    ) s;

  if cardinality(v_clean) > 20 then
    raise exception 'That is too many parts.' using errcode = '22023';
  end if;

  update public.team_members set instruments = v_clean where id = p_member_id;
  return v_clean;
end;
$$;

revoke all on function public.set_member_instruments(uuid, text[]) from public, anon;
grant execute on function public.set_member_instruments(uuid, text[]) to authenticated;
