// The scroll-spy behind the structure ribbon and the song map.
//
// Two rules, both of which shipped wrong: nothing is "current" when the content
// does not scroll, and nothing is current at all on a surface where the reader
// isn't scrolling along.
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveSection } from '@/hooks/useActiveSection';

// A root whose scrollHeight/clientHeight we control. jsdom lays nothing out, so
// these are the only numbers the hook can read.
function makeRoot({ scrollHeight, clientHeight, sections = 3 }) {
  const el = document.createElement('div');
  for (let i = 0; i < sections; i++) {
    const s = document.createElement('div');
    s.setAttribute('data-section-index', String(i));
    el.appendChild(s);
  }
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  el.scrollTop = 0;
  document.body.appendChild(el);
  return { current: el };
}

describe('useActiveSection', () => {
  it('returns null when the content fits — nothing is "current"', () => {
    // THE BUG: the snap-to-last rule is `scrollTop + clientHeight >= scrollHeight - 16`,
    // which with no overflow is `0 + 800 >= 800 - 16` — true on the first frame.
    // The last section lit up immediately on a song that simply fit.
    const ref = makeRoot({ scrollHeight: 800, clientHeight: 800 });
    const { result } = renderHook(() => useActiveSection(ref, 'k'));
    expect(result.current).toBeNull();
  });

  it('still returns null for a hair of overflow, rather than flickering', () => {
    const ref = makeRoot({ scrollHeight: 810, clientHeight: 800 });
    const { result } = renderHook(() => useActiveSection(ref, 'k'));
    expect(result.current).toBeNull();
  });

  it('reports a section once the content really scrolls', () => {
    // WHICH section is not asserted: jsdom lays nothing out, so every element
    // reports a zero rect and the reading-line arithmetic has no real geometry
    // to work on. The claim under test is that scroll-spy engages at all.
    const ref = makeRoot({ scrollHeight: 4000, clientHeight: 800 });
    const { result } = renderHook(() => useActiveSection(ref, 'k'));
    expect(typeof result.current).toBe('number');
  });

  it('is off on static surfaces — the hub, the preview, the side peek', () => {
    const ref = makeRoot({ scrollHeight: 4000, clientHeight: 800 });
    const { result } = renderHook(() => useActiveSection(ref, 'k', 0.28, false));
    expect(result.current).toBeNull();
  });

  it('reports null, never 0, when disabled — 0 is a real section', () => {
    const ref = makeRoot({ scrollHeight: 4000, clientHeight: 800 });
    const { result } = renderHook(() => useActiveSection(ref, 'k', 0.28, false));
    expect(result.current).not.toBe(0);
  });
});
