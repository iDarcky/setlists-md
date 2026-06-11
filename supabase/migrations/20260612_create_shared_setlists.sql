-- Public, optionally-expiring setlist share links.
--
-- A signed-in user can publish a frozen snapshot of a setlist (plus the songs
-- it references) under a random token. Anyone with the link can read it until
-- it expires; the owner can revoke it. The snapshot keeps private libraries out
-- of the public read path — the viewer never touches the owner's other data.

create table if not exists public.shared_setlists (
  token text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  title text,
  setlist jsonb not null,
  songs jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shared_setlists enable row level security;

-- Anyone (including anonymous) may read a share link that hasn't expired.
create policy "public read non-expired shares"
  on public.shared_setlists
  for select
  using (expires_at is null or expires_at > now());

-- Signed-in users create shares they own.
create policy "owner can create shares"
  on public.shared_setlists
  for insert
  with check (auth.uid() = owner_id);

-- Owner can revoke (delete) their own shares.
create policy "owner can delete shares"
  on public.shared_setlists
  for delete
  using (auth.uid() = owner_id);

create index if not exists shared_setlists_owner_idx on public.shared_setlists(owner_id);
