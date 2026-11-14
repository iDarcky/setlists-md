import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRevealList } from '@/hooks/useRevealList';

// Long lists draw a screenful first and the rest as the end nears.
let observers = [];
class FakeIO {
  constructor(cb) { this.cb = cb; observers.push(this); }
  observe() {}
  disconnect() { this.off = true; }
}
const nearEnd = () => act(() => { observers.filter(o => !o.off).forEach(o => o.cb([{ isIntersecting: true }])); });

afterEach(() => { delete globalThis.IntersectionObserver; observers = []; });

describe('useRevealList', () => {
  it('draws everything where IntersectionObserver is missing', () => {
    const { result } = renderHook(() => useRevealList(500));
    expect(result.current.count).toBe(500);
    expect(result.current.more).toBe(false);
  });

  it('starts with a screenful and grows as the end comes near', () => {
    globalThis.IntersectionObserver = FakeIO;
    const { result } = renderHook(() => useRevealList(500, { first: 40, step: 80 }));
    expect(result.current.count).toBe(40);
    act(() => result.current.sentinel(document.createElement('div')));
    nearEnd();
    expect(result.current.count).toBe(120);
    for (let i = 0; i < 10; i++) nearEnd();
    expect(result.current.count).toBe(500);
    expect(result.current.more).toBe(false);
  });

  it('starts again from the top when the search or tab changes', () => {
    globalThis.IntersectionObserver = FakeIO;
    const { result, rerender } = renderHook(({ k }) => useRevealList(500, { first: 40, step: 80, resetKey: k }), { initialProps: { k: 'a' } });
    act(() => result.current.sentinel(document.createElement('div')));
    nearEnd();
    expect(result.current.count).toBe(120);
    rerender({ k: 'a' });
    expect(result.current.count).toBe(120); // a sync landing keeps the rows shown
    rerender({ k: 'b' });
    expect(result.current.count).toBe(40);
  });
});
