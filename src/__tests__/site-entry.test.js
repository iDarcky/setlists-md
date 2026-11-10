import { describe, it, expect } from 'vitest';
import { parseSiteEntry, stripSiteEntry, rememberSignupSource, signupSource, forgetSignupSource } from '@/lib/siteEntry';

const memory = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};

describe('siteEntry', () => {
  it('reads the website join link', () => {
    expect(parseSiteEntry('?start=signup&from=site')).toEqual({ start: 'signup', from: 'site' });
    expect(parseSiteEntry('?from=site')).toEqual({ start: null, from: 'site' });
    expect(parseSiteEntry('?start=login')).toEqual({ start: 'login', from: null });
  });

  it('ignores anything it does not know', () => {
    expect(parseSiteEntry('')).toEqual({ start: null, from: null });
    expect(parseSiteEntry('?start=admin&from=<script>')).toEqual({ start: null, from: null });
    expect(parseSiteEntry('?from=' + 'x'.repeat(40))).toEqual({ start: null, from: null });
  });

  it('strips only its own keys', () => {
    expect(stripSiteEntry('?start=signup&from=site')).toBe('');
    expect(stripSiteEntry('?setlist=abc&from=site')).toBe('?setlist=abc');
  });

  it('remembers the source until it is used', () => {
    const s = memory();
    expect(signupSource(s)).toBe(null);
    rememberSignupSource('site', s);
    expect(signupSource(s)).toBe('site');
    forgetSignupSource(s);
    expect(signupSource(s)).toBe(null);
  });
});
