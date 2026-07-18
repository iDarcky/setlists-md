-- Workspace timezone — needed so hour-precise reminders ("1 hour before a
-- 10:00 service") fire at the right real-world moment. Setlists store a naive
-- date + HH:MM; the notify-worker interprets that wall-clock time in the team's
-- timezone. IANA name (e.g. 'Europe/Bucharest'). Editable in Team settings.
-- Default seeds existing teams to the current user base's zone; new teams should
-- capture the creator's device timezone client-side. Idempotent.

alter table public.teams
  add column if not exists timezone text not null default 'Europe/Bucharest';
