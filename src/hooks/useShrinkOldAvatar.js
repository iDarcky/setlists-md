import { useEffect, useRef } from 'react';
import { supabase } from '@/auth/supabase';
import { needsShrink, uploadAvatar, removeOldAvatars } from '@/lib/avatarUpload';

const TRIED_KEY = 'setlists-md:avatar-shrink-tried';

/**
 * One-time catch-up for profile photos uploaded before photos were shrunk on
 * the device (Nov 2026). When the signed-in person's photo is still the
 * full-size original, shrink it here and point the profile at the small copy.
 * Then the original (and any older unused photos) are deleted. Tried once per person per device, so
 * a photo that fails to load never loops.
 */
export default function useShrinkOldAvatar(user, profile, updateProfile) {
  const uid = user?.id;
  const url = profile?.avatar_url;
  // Held in a ref: a new updateProfile identity must not cancel a shrink in flight.
  const updateRef = useRef(updateProfile);
  useEffect(() => { updateRef.current = updateProfile; });
  useEffect(() => {
    if (!supabase || !uid || !needsShrink(url)) return;
    const tried = `${TRIED_KEY}:${uid}`;
    try { if (localStorage.getItem(tried)) return; localStorage.setItem(tried, '1'); } catch { return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        const smallUrl = await uploadAvatar(blob, `users/${uid}`);
        if (cancelled) return;
        await updateRef.current({ avatar_url: smallUrl });
        await removeOldAvatars(`users/${uid}`, smallUrl);
      } catch { /* leave the original in place */ }
    })();
    return () => { cancelled = true; };
  }, [uid, url]);
}
