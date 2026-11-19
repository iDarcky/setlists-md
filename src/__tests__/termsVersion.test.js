import { describe, expect, it } from 'vitest';
import { TERMS_VERSION, termsAcceptance } from '@/features/legal/termsVersion';

describe('termsAcceptance', () => {
  it('records the current terms version and when it was accepted', () => {
    const at = new Date('2026-11-19T12:00:00Z');
    expect(termsAcceptance(at)).toEqual({ terms_version: TERMS_VERSION, terms_accepted_at: '2026-11-19T12:00:00.000Z' });
  });
});
