-- Storage + waitlist hardening (applied to live DB).
--
-- 1. avatars bucket enumeration:
--    The "avatars public read" SELECT policy on storage.objects was broad
--    enough to let any client LIST every file in the bucket. The avatars
--    bucket is public, so getPublicUrl() object reads go through the
--    unauthenticated public endpoint (which bypasses RLS entirely) — dropping
--    this policy keeps avatar rendering working while blocking enumeration.
--    AvatarUploader only calls .upload() and .getPublicUrl(), never .list().
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

-- 2. pro_waitlist open INSERT:
--    The "Anyone can join waitlist" policy uses WITH CHECK (true), which is
--    intentional (public sign-up). Email uniqueness is already enforced by
--    pro_waitlist_email_key, so duplicate spam is blocked; this CHECK adds a
--    basic email-format guard so the open policy can't be used to fill the
--    table with non-email junk. NOT VALID skips re-checking existing rows.
ALTER TABLE public.pro_waitlist
  ADD CONSTRAINT pro_waitlist_email_format
  CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  NOT VALID;
