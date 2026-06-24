import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAmplificationGuard } from '../sync/amplification-guard';

afterEach(() => vi.useRealTimers());

describe('amplification guard', () => {
  it('allows normal push rates', () => {
    const g = createAmplificationGuard({ limit: 12, windowMs: 60000 });
    for (let i = 0; i < 12; i++) expect(g.shouldBlock('s1')).toBe(false);
  });

  it('trips after exceeding the limit within the window', () => {
    const g = createAmplificationGuard({ limit: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) expect(g.shouldBlock('s1')).toBe(false);
    expect(g.shouldBlock('s1')).toBe(true); // 6th in-window push is blocked
  });

  it('tracks items independently', () => {
    const g = createAmplificationGuard({ limit: 2, windowMs: 60000 });
    g.shouldBlock('a'); g.shouldBlock('a');
    expect(g.shouldBlock('a')).toBe(true);
    expect(g.shouldBlock('b')).toBe(false); // a different item is unaffected
  });

  it('recovers after the cooldown elapses', () => {
    vi.useFakeTimers();
    const g = createAmplificationGuard({ limit: 2, windowMs: 1000, cooldownMs: 5000 });
    g.shouldBlock('s1'); g.shouldBlock('s1');
    expect(g.shouldBlock('s1')).toBe(true); // tripped
    vi.advanceTimersByTime(5001);
    expect(g.shouldBlock('s1')).toBe(false); // cooled down, allowed again
  });
});
