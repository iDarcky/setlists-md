-- In-app feedback submissions.
--
-- The "Send feedback" button (components/FeedbackButton.jsx) inserts a row here
-- instead of opening a GitHub issue. Anyone — including signed-out guests — may
-- submit, so the INSERT policy is open. There is intentionally NO SELECT policy
-- yet: feedback is read directly from the database by the maintainer for now;
-- an in-app review surface (admin-only reads) is planned later.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('bug', 'feature', 'general')),
  description text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone may submit feedback (authenticated or anonymous).
create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  with check (true);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
