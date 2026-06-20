-- Wave 5 scale quick-win: standalone team_id indexes.
--
-- The team sync engine and library load filter `team_songs` / `team_setlists`
-- by `team_id` on every pull and on every realtime echo. Without a leading
-- team_id index those become sequential scans as a workspace's library grows.
-- (Composite indexes that merely *include* team_id as a non-leading column
-- don't serve an equality filter on team_id alone.)

create index if not exists team_songs_team_id_idx
  on public.team_songs (team_id);

create index if not exists team_setlists_team_id_idx
  on public.team_setlists (team_id);
