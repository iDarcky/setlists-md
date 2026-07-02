-- Advisor follow-up: trigger functions created after the 20260615 audit kept
-- the default PUBLIC EXECUTE grant, which exposes them at
-- /rest/v1/rpc/<name> to anon/authenticated callers. They are only ever run
-- by their triggers (fired with the table owner's privileges — trigger
-- execution does not require the caller to hold EXECUTE), so no client role
-- needs direct access. `notify_on_schedule_decline` is SECURITY DEFINER and
-- writes notification rows for OTHER users — the one you really don't want
-- callable by hand.
revoke execute on function public.notify_on_schedule_decline() from public, anon, authenticated;
revoke execute on function public.stamp_team_setlist_creator() from public, anon, authenticated;
revoke execute on function public.set_user_cloud_tokens_updated_at() from public, anon, authenticated;

-- NOTE (dashboard-only, not expressible in SQL): enable leaked-password
-- protection under Authentication → Passwords (checks HaveIBeenPwned on
-- sign-up/password change). Flagged by the security advisor.
