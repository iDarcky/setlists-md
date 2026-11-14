// The phone's status bar follows whatever owns the screen: the app theme
// everywhere, the CHART theme while a reader is open (owner, 2026-11-13, an
// installed Android app showed a light bar over a dark chart).
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { setAppBarColor, useChartSystemBars, __resetSystemBars } from '@/lib/systemBars';

const meta = () => document.querySelector('meta[name="theme-color"]:not([media])')?.getAttribute('content');

// What a browser would resolve `--chart-bg` to.
const fromRoot = () => document.documentElement.style.getPropertyValue('--chart-bg') || null;

beforeEach(() => {
  __resetSystemBars(fromRoot);
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  document.documentElement.style.removeProperty('--chart-bg');
});

describe('system bars', () => {
  it('writes the app colour and drops media-scoped tags', () => {
    const scoped = document.createElement('meta');
    scoped.setAttribute('name', 'theme-color');
    scoped.setAttribute('media', '(prefers-color-scheme: light)');
    scoped.setAttribute('content', '#ffffff');
    document.head.appendChild(scoped);
    setAppBarColor('#f6f4ef');
    expect(meta()).toBe('#f6f4ef');
    expect(document.querySelectorAll('meta[name="theme-color"][media]')).toHaveLength(0);
  });

  it('a reader takes the bar over with the chart background, and gives it back', () => {
    setAppBarColor('#f6f4ef');
    document.documentElement.style.setProperty('--chart-bg', '#050505');
    const { unmount } = renderHook(() => useChartSystemBars());
    expect(meta()).toBe('#050505');
    unmount();
    expect(meta()).toBe('#f6f4ef');
  });

  it('follows a chart theme change while open', async () => {
    setAppBarColor('#f6f4ef');
    document.documentElement.style.setProperty('--chart-bg', '#050505');
    const { unmount } = renderHook(() => useChartSystemBars());
    document.documentElement.style.setProperty('--chart-bg', '#fbfaf6');
    await new Promise(r => setTimeout(r, 0));
    expect(meta()).toBe('#fbfaf6');
    unmount();
  });

  it('an app theme change under an open reader lands when the reader closes', () => {
    setAppBarColor('#f6f4ef');
    document.documentElement.style.setProperty('--chart-bg', '#050505');
    const { unmount } = renderHook(() => useChartSystemBars());
    setAppBarColor('#11100e');
    expect(meta()).toBe('#050505');
    unmount();
    expect(meta()).toBe('#11100e');
  });
});
