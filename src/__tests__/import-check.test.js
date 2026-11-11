import { describe, it, expect } from 'vitest';
import { TO_CHECK, needsCheck, markToCheck, clearCheck } from '@/lib/importCheck';

describe('importCheck', () => {
  it('tags, reads and clears the To check tag', () => {
    const s = { id: 'a', tags: ['worship'] };
    const marked = markToCheck(s);
    expect(marked.tags).toEqual(['worship', TO_CHECK]);
    expect(needsCheck(marked)).toBe(true);
    expect(markToCheck(marked)).toBe(marked);
    expect(clearCheck(marked).tags).toEqual(['worship']);
    expect(clearCheck(s)).toBe(s);
    expect(needsCheck({ id: 'b' })).toBe(false);
  });
});
