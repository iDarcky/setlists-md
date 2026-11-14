import React, { useRef, useState } from 'react';
import { supabase } from '@/auth/supabase';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { Button } from './Button';
import { shrinkImage, extFor } from '@/lib/shrinkImage';

/**
 * Uploads an image to the public `avatars` storage bucket and reports the
 * resulting public URL via onChange. `pathPrefix` controls the storage folder
 * — `users/{uid}` for personal avatars, `teams/{teamId}` for team logos — which
 * the bucket's RLS policies authorize. Removing calls onChange(null).
 *
 * The photo is shrunk on the device first (256px square, WebP or JPEG on
 * Safari) so a 3 MB phone photo is stored as ~20 KB.
 */
export default function AvatarUploader({
  url,
  fallback = '?',
  pathPrefix,
  onChange,
  size = 72,
  shape = 'circle',
  label = 'photo',
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const radius = shape === 'square' ? 'rounded-2xl' : 'rounded-full';

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  // The original only has to fit in memory: it is shrunk before upload.
  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!supabase) { setError('Sign in to upload.'); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Use a JPEG, PNG, or WebP image.'); return; }
    if (file.size > MAX_BYTES) { setError('Image must be under 25 MB.'); return; }
    setBusy(true);
    setError(null);
    try {
      const small = await shrinkImage(file);
      const path = `${pathPrefix}/avatar-${Date.now()}.${extFor(small.type)}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, small, { upsert: true, cacheControl: '31536000', contentType: small.type });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      await onChange?.(publicUrl);
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try { await onChange?.(null); }
    catch (err) { setError(err?.message || 'Could not remove.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className={radius} style={{ width: size, height: size }}>
        {url ? <AvatarImage src={url} alt="" className={radius} /> : null}
        <AvatarFallback className={`${radius} text-base`}>{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || busy} loading={busy}>
            {url ? `Change ${label}` : `Upload ${label}`}
          </Button>
          {url && !busy && (
            <Button variant="ghost" size="sm" onClick={remove} disabled={disabled}>Remove</Button>
          )}
        </div>
        {error && <span className="text-label-12 text-[var(--ds-red-700)]">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}
