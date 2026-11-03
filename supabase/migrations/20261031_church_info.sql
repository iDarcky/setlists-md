-- Church info on the Team page (2026-10-31): address, website and the CCLI
-- licence number. City stays in `teams.location`. Only the owner edits them
-- ("Owner can update team" already says so); every member reads them through
-- "Members can view their team". Additive and nullable: older builds ignore them.

alter table public.teams
  add column if not exists address text,
  add column if not exists website text,
  add column if not exists ccli_licence text;

alter table public.teams
  drop constraint if exists teams_address_len,
  add constraint teams_address_len check (address is null or char_length(address) <= 200),
  drop constraint if exists teams_website_len,
  add constraint teams_website_len check (website is null or char_length(website) <= 200),
  drop constraint if exists teams_ccli_licence_len,
  add constraint teams_ccli_licence_len check (ccli_licence is null or char_length(ccli_licence) <= 40);
