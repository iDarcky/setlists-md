-- Cloud song version history (capture half).
--
-- Version history today is per-device (IndexedDB). Now that import UPDATES a
-- song in place (stable identity), a bad edit/import is only recoverable on the
-- device that made it. This adds a server-side, append-only snapshot of every
-- team song on each content change, so any device (and any team member) can see
-- and — via a later restore UI — roll back. Capture is a DB trigger: automatic,
-- covers every writer, and needs no engine change.
--
-- SAFETY: the snapshot is wrapped so a failure here can NEVER block or roll back
-- the underlying song write (an exception is swallowed). Retention is capped per
-- song so the table can't grow unbounded. Idempotent.

create table if not exists public.team_song_versions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  song_key text not null,
  title text,
  content text not null,
  content_hash text,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists team_song_versions_lookup_idx
  on public.team_song_versions (team_id, song_key, created_at desc);

alter table public.team_song_versions enable row level security;

-- Team members (and the owner) read their team's history. No client writes —
-- rows come only from the SECURITY DEFINER trigger below.
drop policy if exists "team members read song versions" on public.team_song_versions;
create policy "team members read song versions"
  on public.team_song_versions
  for select
  using (
    (team_id in (select get_user_teams()))
    or (team_id in (select id from public.teams where owner_id = auth.uid()))
  );

-- Keep at most this many snapshots per song.
create or replace function public.snapshot_team_song()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  -- Only snapshot when the content actually changed.
  if TG_OP = 'UPDATE' and NEW.content is not distinct from OLD.content then
    return null;
  end if;

  begin
    v_key := coalesce(NEW.song_key, substring(NEW.content from 'songId: ([a-z0-9_]+)'), NEW.id::text);

    insert into public.team_song_versions (team_id, song_key, title, content, content_hash, author_id)
    values (NEW.team_id, v_key, NEW.title, NEW.content, NEW.content_hash, auth.uid());

    -- Retention: keep the newest 30 per song, drop the rest.
    delete from public.team_song_versions
    where team_id = NEW.team_id and song_key = v_key
      and id not in (
        select id from public.team_song_versions
        where team_id = NEW.team_id and song_key = v_key
        order by created_at desc
        limit 30
      );
  exception when others then
    -- Never let history capture block the actual song write.
    return null;
  end;

  return null;
end;
$$;

-- Trigger functions are only ever run by their triggers.
revoke all on function public.snapshot_team_song() from public, anon, authenticated;

drop trigger if exists trg_snapshot_song on public.team_songs;
create trigger trg_snapshot_song
  after insert or update on public.team_songs
  for each row execute function public.snapshot_team_song();
