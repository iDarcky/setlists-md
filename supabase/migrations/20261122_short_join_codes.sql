-- Short join codes (2026-11-20, new first-run screens).
--
-- New codes are 6 characters, so people can type one ("K7M2QX") on the
-- "Enter your invite code" screen. Codes that already exist (12 characters)
-- keep working: the checks only drop their minimum from 8 to 6.
--
-- 31-letter alphabet with no look-alikes, as before: 31^6 ≈ 887 million codes.
-- A code only lets someone ASK to join; a leader still says yes.
--
-- Safe to run more than once.

-- 1. New codes are 6 characters.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alpha constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_pos   int[] := array[0, 1, 2, 3, 4, 5];
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

-- 2. The table's check allows 6.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.team_join_links'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%{8,32}%'
  loop
    execute format('alter table public.team_join_links drop constraint %I', c);
  end loop;
end $$;

alter table public.team_join_links drop constraint if exists team_join_links_code_check;
alter table public.team_join_links
  add constraint team_join_links_code_check check (code ~ '^[a-z0-9]{6,32}$');

-- 3. Every function that checks a code's shape (peek_join_link,
--    request_to_join, …) allows 6. Each is re-created from its own current
--    definition with only the length changed, so nothing else moves.
do $$
declare
  f   record;
  def text;
begin
  for f in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%{8,32}%'
  loop
    def := replace(pg_get_functiondef(f.oid), '{8,32}', '{6,32}');
    execute def;
  end loop;
end $$;

-- Check: should list no function still asking for 8.
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%{8,32}%';
