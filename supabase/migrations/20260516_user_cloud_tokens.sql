-- user_cloud_tokens
--
-- Stores encrypted OAuth refresh tokens for cloud providers (Google Drive,
-- Dropbox, OneDrive) so the browser never has to hold them.
--
-- Security model: NO client policies. RLS is enabled but no SELECT/INSERT/
-- UPDATE/DELETE policy is granted to `authenticated` or `anon`. Only the
-- Edge Function `cloud-token-exchange`, running with the `service_role`
-- key (kept server-side in Supabase Function secrets), can read or write
-- this table. End users can never see their own refresh token via the
-- PostgREST API.
--
-- One row per (user_id, provider). Replacing a row revokes the previous
-- token's role in the app (Google may keep the old refresh token alive
-- until explicitly revoked).

create table if not exists public.user_cloud_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('google-drive','dropbox','onedrive')),
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  scope         text,
  account_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_cloud_tokens enable row level security;

-- Intentionally no policies. service_role bypasses RLS, and that's the
-- only role allowed to touch this table. Any leak via PostgREST is
-- therefore impossible without leaking service_role itself.

create index if not exists user_cloud_tokens_user_provider_idx
  on public.user_cloud_tokens (user_id, provider);

-- Keep updated_at fresh on every write.
create or replace function public.set_user_cloud_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_cloud_tokens_set_updated_at on public.user_cloud_tokens;
create trigger user_cloud_tokens_set_updated_at
  before update on public.user_cloud_tokens
  for each row
  execute function public.set_user_cloud_tokens_updated_at();
