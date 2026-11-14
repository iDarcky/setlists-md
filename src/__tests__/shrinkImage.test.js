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
