-- Ready notifies the band, and a ready setlist that changes says so.
--
-- A setlist's status lives in team_setlists.content (the whole setlist JSON).
--  * draft → ready: everyone on its band who has not said no gets a
--    'setlist_ready' notification.
--  * ready → still ready, with a different order (content->'items'): they get
--    'setlist_changed', at most once an hour per person and setlist, so a
--    leader tidying up does not buzz the band ten times.
-- The person making the change is never notified. Rows go through the
-- notify-worker like every other team_notifications row, so they reach lock
-- screens. metadata.setlist_id is the team_setlists ROW id, as for the
-- schedule notifications.

create or replace function public.notify_on_setlist_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_ready boolean := coalesce(OLD.content->>'status', '') = 'ready';
  is_ready  boolean := coalesce(NEW.content->>'status', '') = 'ready';
  label text := coalesce(nullif(NEW.content->>'name', ''), NEW.name, 'A setlist');
begin
  if is_ready and not was_ready then
    insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
    select distinct on (s.user_id)
      NEW.team_id, s.user_id, (select auth.uid()), 'setlist_ready',
      'Setlist ready',
      format('"%s" is final. Have a look before you practise.', label),
      jsonb_build_object('setlist_id', NEW.id)
    from public.team_schedules s
    where s.setlist_id = NEW.id
      and s.availability is distinct from 'unavailable'
      and s.user_id is distinct from (select auth.uid());

  elsif is_ready and was_ready and (NEW.content->'items') is distinct from (OLD.content->'items') then
    insert into public.team_notifications (team_id, user_id, actor_id, type, title, body, metadata)
    select distinct on (s.user_id)
      NEW.team_id, s.user_id, (select auth.uid()), 'setlist_changed',
      'Setlist changed',
      format('"%s" changed after it was marked ready.', label),
      jsonb_build_object('setlist_id', NEW.id)
    from public.team_schedules s
    where s.setlist_id = NEW.id
      and s.availability is distinct from 'unavailable'
      and s.user_id is distinct from (select auth.uid())
      and not exists (
        select 1 from public.team_notifications n
        where n.user_id = s.user_id
          and n.type = 'setlist_changed'
          and n.metadata->>'setlist_id' = NEW.id::text
          and n.created_at > now() - interval '1 hour'
      );
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_on_setlist_ready() from public, anon, authenticated;

drop trigger if exists trg_notify_setlist_ready on public.team_setlists;
create trigger trg_notify_setlist_ready
  after update of content on public.team_setlists
  for each row execute function public.notify_on_setlist_ready();
