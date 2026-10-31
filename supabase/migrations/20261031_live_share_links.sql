-- Live guest links.
--
-- A share used to be a frozen copy: change the setlist after sharing and the
-- guest kept seeing the old order. A team setlist's link now points at the
-- setlist ROW, and the guest reads it through `get_shared_setlist(token)`,
-- which returns the current setlist and its songs every time.
--
-- What a guest gets, and what they don't:
--  * the setlist's name, date and times and its order, with each item's key,
--    note and length, and the songs it uses (every arrangement, so the chart
--    can be read in full);
--  * NOT who leads a song (items' `leadBy`), not the band, not the snapshot
--    taken at Ready (`readyItems`), and nothing else in the church;
--  * the church's name and logo, for the page header.
-- The link ends at `expires_at`. The app sets that to 3 hours after the service
-- ends (24 hours after sharing when the setlist has no date), and moves it
-- again if the service is moved.
--
-- Personal-library shares (no team) keep the old snapshot path.

alter table public.shared_setlists
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists setlist_row_id uuid references public.team_setlists(id) on delete cascade;

-- Snapshot rows keep `setlist` NOT NULL; a live row stores '{}'.
create index if not exists shared_setlists_row_idx on public.shared_setlists(setlist_row_id);

-- A live link can only point at a setlist in a church the creator can edit.
drop policy if exists "owner can create shares" on public.shared_setlists;
create policy "owner can create shares"
  on public.shared_setlists
  for insert
  with check (
    (select auth.uid()) = owner_id
    and (
      setlist_row_id is null
      or exists (
        select 1 from public.team_setlists s
        where s.id = setlist_row_id
          and s.team_id = shared_setlists.team_id
          and s.team_id in (select public.get_user_editable_teams())
      )
    )
  );

-- The owner moves the end time when the service moves.
drop policy if exists "owner can update shares" on public.shared_setlists;
create policy "owner can update shares"
  on public.shared_setlists
  for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Leaders see their own links (to show "Guest link" again, or stop sharing).
drop policy if exists "owner can read own shares" on public.shared_setlists;
create policy "owner can read own shares"
  on public.shared_setlists
  for select
  using ((select auth.uid()) = owner_id);

create or replace function public.get_shared_setlist(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sh public.shared_setlists%rowtype;
  sl public.team_setlists%rowtype;
  tm public.teams%rowtype;
  items jsonb;
  ids text[];
  songs jsonb;
begin
  if p_token is null or p_token !~ '^[a-z0-9]{16,32}$' then return null; end if;
  select * into sh from public.shared_setlists where token = p_token;
  if not found or (sh.expires_at is not null and sh.expires_at <= now()) then return null; end if;

  -- Old snapshot link.
  if sh.setlist_row_id is null then
    return jsonb_build_object('live', false, 'title', sh.title, 'setlist', sh.setlist,
      'songs', sh.songs, 'expires_at', sh.expires_at);
  end if;

  select * into sl from public.team_setlists where id = sh.setlist_row_id;
  if not found then return null; end if;
  select * into tm from public.teams where id = sl.team_id;

  -- Every item minus who leads it.
  select coalesce(jsonb_agg(it - 'leadBy' order by ord), '[]'::jsonb)
    into items
    from jsonb_array_elements(coalesce(sl.content->'items', '[]'::jsonb)) with ordinality as e(it, ord);

  select coalesce(array_agg(distinct it->>'songId'), '{}')
    into ids
    from jsonb_array_elements(items) as e(it)
   where it->>'songId' is not null;

  select coalesce(jsonb_agg(jsonb_build_object('key', s.song_key, 'doc', s.doc, 'content', s.content)), '[]'::jsonb)
    into songs
    from public.team_songs s
   where s.team_id = sl.team_id and s.song_key = any(ids);

  return jsonb_build_object(
    'live', true,
    'title', coalesce(nullif(sl.content->>'name', ''), sl.name),
    'setlist', jsonb_build_object(
      'id', sl.content->'id',
      'name', coalesce(nullif(sl.content->>'name', ''), sl.name),
      'date', sl.content->'date',
      'time', sl.content->'time',
      'endTime', sl.content->'endTime',
      'service', sl.content->'service',
      'items', items
    ),
    'songs', songs,
    'church', jsonb_build_object('name', tm.name, 'logo_url', tm.logo_url),
    'expires_at', sh.expires_at
  );
end;
$$;

revoke execute on function public.get_shared_setlist(text) from public;
grant execute on function public.get_shared_setlist(text) to anon, authenticated;

-- ⚠ LATER, once this build is on main: drop "public read non-expired shares".
-- It lets anyone with the public key LIST every active link (and read the old
-- snapshots) without knowing a token. The new viewer reads only through
-- get_shared_setlist, but the build on main today still reads the table
-- directly, so dropping it now would break links people open from main.
--   drop policy if exists "public read non-expired shares" on public.shared_setlists;
