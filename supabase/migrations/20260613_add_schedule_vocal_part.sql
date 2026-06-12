-- Per-assignment vocal part for the roster (separate from the instrument, which
-- lives in team_schedules.role). Lets a worship leader assign, e.g., Electric
-- Guitar + Backing, or no instrument + Lead female.
alter table public.team_schedules add column if not exists vocal_part text;
