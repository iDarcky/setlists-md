// The phone Save/Cancel bar (user, 13 Nov 2026: "move save/cancel on the
// bottom on phone everywhere"). jsdom has no keyboard, so the visual viewport
// is stubbed: the bar must lift by exactly what the keyboard covers.
import { describe, it, expect, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { BottomActions } from '@/ui/shadcn/bottom-actions';

function stubViewport({ height, offsetTop = 0 }) {
  const listeners = new Set();
  const vv = {
    height, offsetTop,
    addEventListener: (_, cb) => listeners.add(cb),
    removeEventListener: (_, cb) => listeners.delete(cb),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  return { set(next) { Object.assign(vv, next); listeners.forEach(cb => cb()); } };
}

afterEach(() => { delete window.visualViewport; });

describe('BottomActions', () => {
  it('sits on the safe area when the keyboard is closed', () => {
    stubViewport({ height: 844 });
    const { container } = render(<BottomActions fixed><button>Save</button></BottomActions>);
    const bar = container.firstChild;
    expect(bar.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(bar.style.bottom).toBe('');
  });

  it('lifts a fixed bar above the keyboard, and drops back when it closes', () => {
    const vv = stubViewport({ height: 844 });
    const { container } = render(<BottomActions fixed><button>Save</button></BottomActions>);
    const bar = container.firstChild;
    act(() => vv.set({ height: 508 })); // a 336px iPhone keyboard
    expect(bar.style.bottom).toBe('336px');
    expect(bar.style.paddingBottom).toBe('10px');
    act(() => vv.set({ height: 844 }));
    expect(bar.style.bottom).toBe('');
  });

  it('uses a margin in the flow, so the scroller above it shrinks instead', () => {
    const vv = stubViewport({ height: 844 });
    const { container } = render(<BottomActions><button>Save</button></BottomActions>);
    act(() => vv.set({ height: 500 }));
    expect(container.firstChild.style.marginBottom).toBe('344px');
  });

  it('ignores small gaps from browser toolbars settling', () => {
    const vv = stubViewport({ height: 844 });
    const { container } = render(<BottomActions fixed><button>Save</button></BottomActions>);
    act(() => vv.set({ height: 800 }));
    expect(container.firstChild.style.bottom).toBe('');
  });
});
