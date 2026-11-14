import { describe, it, expect } from 'vitest';
import { centreSquare, extFor } from '@/lib/shrinkImage';

describe('shrinkImage helpers', () => {
  it('crops a landscape photo to a centred square', () => {
    expect(centreSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000 });
  });
  it('crops a portrait photo to a centred square', () => {
    expect(centreSquare(3000, 4000)).toEqual({ sx: 0, sy: 500, side: 3000 });
  });
  it('names the file after the encoded type', () => {
    expect(extFor('image/webp')).toBe('webp');
    expect(extFor('image/jpeg')).toBe('jpg');
    expect(extFor('image/png')).toBe('png');
  });
});

import { needsShrink } from '@/lib/avatarUpload';

describe('needsShrink', () => {
  const base = 'https://x.supabase.co/storage/v1/object/public/avatars/users/u1/';
  it('flags a full-size photo from before shrinking', () => {
    expect(needsShrink(base + 'avatar-1794418409511.png')).toBe(true);
    expect(needsShrink(base + 'avatar-1780445578809.webp')).toBe(true);
  });
  it('leaves a shrunk photo, an empty one and outside links alone', () => {
    expect(needsShrink(base + 'avatar-1794418409511-s256.webp')).toBe(false);
    expect(needsShrink(null)).toBe(false);
    expect(needsShrink('https://lh3.googleusercontent.com/a/photo.jpg')).toBe(false);
  });
});

import { pathFromUrl } from '@/lib/avatarUpload';

describe('pathFromUrl', () => {
  it('reads the storage path from a public URL', () => {
    expect(pathFromUrl('https://x.supabase.co/storage/v1/object/public/avatars/users/u1/avatar-1-s256.webp'))
      .toBe('users/u1/avatar-1-s256.webp');
  });
  it('returns null for anything else', () => {
    expect(pathFromUrl(null)).toBe(null);
    expect(pathFromUrl('https://example.com/a.png')).toBe(null);
  });
});
