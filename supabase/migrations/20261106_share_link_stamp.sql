-- A cheap "has it changed?" for guest links.
--
-- A live guest page used to re-download the whole setlist and its songs
-- (~14 KB on 2026-11-06) every 60 seconds. It now asks for this stamp every
-- 10 seconds instead (32 bytes) and downloads the setlist only when the stamp
-- moves, so a leader's change reaches guests within ~10 s for less traffic
-- than the old once-a-minute download.
--
-- The stamp is the md5 of exactly what `get_shared_setlist` would return, so
-- it moves on any change a guest could see (order, keys, notes, a song edit,
-- the church name, the end time) and never on one they couldn't. NULL when the
-- link is missing or ended, same as `get_shared_setlist`. It reveals nothing
-- the token holder can't already read.

create or replace function public.get_shared_setlist_stamp(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(public.get_shared_setlist(p_token)::text);
$$;

revoke execute on function public.get_shared_setlist_stamp(text) from public;
grant execute on function public.get_shared_setlist_stamp(text) to anon, authenticated;
