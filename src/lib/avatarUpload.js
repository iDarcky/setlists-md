import { supabase } from '@/auth/supabase';
import { shrinkImage, extFor } from '@/lib/shrinkImage';

const BUCKET = 'avatars';

// Every photo shrunk on the device carries this in its file name, so an
// older full-size upload can be told apart from one that is already small.
export const SMALL_MARK = '-s256.';

/** Is this avatar URL a full-size photo in our bucket that predates shrinking? */
export function needsShrink(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes(`/storage/v1/object/public/${BUCKET}/`)) return false;
  return !url.includes(SMALL_MARK);
}

/** Shrink `file` (a File or Blob) and upload it under `pathPrefix`. Returns the public URL. */
export async function uploadAvatar(file, pathPrefix) {
  const small = await shrinkImage(file);
  const path = `${pathPrefix}/avatar-${Date.now()}${SMALL_MARK}${extFor(small.type)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, small, { upsert: true, cacheControl: '31536000', contentType: small.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Storage path of a public avatar URL, or null if it is not in our bucket. */
export function pathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = typeof url === 'string' ? url.indexOf(marker) : -1;
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

/**
 * Delete every file in `pathPrefix` except the one `keepUrl` points at
 * (pass null to clear the folder, e.g. after "Remove photo"). Call it only
 * AFTER the new URL is saved, so a failed save never loses the photo in use.
 * Best effort: a failure just leaves an unused file behind.
 */
export async function removeOldAvatars(pathPrefix, keepUrl) {
  if (!supabase || !pathPrefix) return;
  try {
    const keep = pathFromUrl(keepUrl);
    const { data, error } = await supabase.storage.from(BUCKET).list(pathPrefix, { limit: 100 });
    if (error || !data) return;
    const old = data
      .filter((f) => f.id && f.name)
      .map((f) => `${pathPrefix}/${f.name}`)
      .filter((p) => p !== keep);
    if (old.length) await supabase.storage.from(BUCKET).remove(old);
  } catch { /* leave them */ }
}
