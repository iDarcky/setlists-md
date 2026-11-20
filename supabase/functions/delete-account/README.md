# `delete-account` Edge Function

Implements the in-app "Delete account" flow (`settings/DeleteAccountScreen.jsx`,
opened from `Account.jsx`).

## What it does

1. Verifies the caller's JWT and resolves their `user.id`.
2. Hands each team they own to the earliest-joined admin, else the
   earliest-joined member, and makes that person an admin. A team is deleted
   only when the owner is its only member. Any failed lookup stops the whole
   deletion before anything is removed.
3. Deletes their `profiles` row (defence-in-depth).
4. Calls `auth.admin.deleteUser(userId)` to remove the auth record. This
   cascades to any remaining FK-referenced rows (`team_members`, etc.).

## Deploying

```bash
supabase functions deploy delete-account
```

The function relies on these environment variables, which Supabase
provides automatically:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is **never** sent to the client — it lives only
inside the function's runtime environment.

## Required schema bits

For the cascading delete to work cleanly, the foreign keys must declare
`ON DELETE CASCADE` from `auth.users(id)`:

- `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`
- `team_members.user_id REFERENCES auth.users(id) ON DELETE CASCADE`
- `teams.owner_id REFERENCES auth.users(id) ON DELETE CASCADE` *(optional;
  the function deletes owned teams explicitly first)*

If the existing migrations don't declare `ON DELETE CASCADE`, add a
follow-up migration to do so before relying on this function.

## Compliance note

Apple's App Store guideline 5.1.1(v) and Google Play's User Data policy
both require that account deletion be reachable from inside the app and
that all server-side data be erased. This function satisfies the
server-side erasure requirement; the client clears IndexedDB and
`localStorage` before signing out (see `Account.jsx`).
