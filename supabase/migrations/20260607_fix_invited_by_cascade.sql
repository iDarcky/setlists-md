-- Fix FK constraints on invited_by columns from NO ACTION to SET NULL.
--
-- Without this, deleting a user who ever invited someone to a team fails
-- with a FK violation at the final auth.admin.deleteUser() call inside the
-- delete-account edge function. Changing to SET NULL means the invited_by
-- column becomes NULL when the inviter is deleted, preserving the member
-- row and the invite record rather than blocking the deletion.

ALTER TABLE public.team_members
  DROP CONSTRAINT team_members_invited_by_fkey,
  ADD CONSTRAINT team_members_invited_by_fkey
    FOREIGN KEY (invited_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

ALTER TABLE public.team_invites
  DROP CONSTRAINT team_invites_invited_by_fkey,
  ADD CONSTRAINT team_invites_invited_by_fkey
    FOREIGN KEY (invited_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
