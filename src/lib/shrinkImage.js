/**
 * Shrinks a profile photo or team logo on the device before upload.
 *
 * The photo is cropped to a centred square (avatars are always shown as a
 * circle or rounded square) and scaled down to `size` px, then encoded as
 * WebP. Safari can't encode WebP from a canvas and silently hands back a PNG,
 * so we fall back to JPEG there. A phone photo of 2-5 MB ends up around
 * 10-30 KB.
 */

export const AVATAR_SIZE = 256;

/** Square crop box (in source pixels) centred on the image. */
export function centreSquare(width, height) {
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
  };
}

/** File extension for the encoded blob's type. */
export function extFor(type) {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/jpeg') return 'jpg';
  return 'png';
}

async function loadBitmap(file) {
  // createImageBitmap applies EXIF rotation by default in current browsers.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function shrinkImage(file, { size = AVATAR_SIZE, quality = 0.82 } = {}) {
  const bmp = await loadBitmap(file);
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error('Could not read that image.');

  const { sx, sy, side } = centreSquare(w, h);
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, out, out);
  bmp.close?.();

  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('Could not process that image.');
  return blob;
}
