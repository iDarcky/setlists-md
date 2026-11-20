-- Limits on the public `avatars` bucket (audit 19 Nov 2026, finding 6).
--
-- The bucket had no size or type limit, so any signed-in user could put a
-- file of any size and any type (HTML, video, zip) into their own folder and
-- get a public link to it. The app only ever uploads a 256px photo it has
-- already shrunk on the device (lib/shrinkImage.js -> WebP, JPEG fallback),
-- which is a few KB, so 1 MB and these three image types change nothing for
-- real users.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
update storage.buckets
   set file_size_limit    = 1048576,                                   -- 1 MB
       allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
 where id = 'avatars';

-- Check: 1048576 and the three types.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars';
