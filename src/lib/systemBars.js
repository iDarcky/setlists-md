import { useEffect } from 'react';

/**
 * The phone's system bars — the status bar on Android, read from
 * `<meta name="theme-color">` — follow whatever owns the screen.
 *
 * Owner, 2026-11-13, installed app on Android: in the reader the status bar
 * stayed the APP's colour (light) over a dark chart, because `useAppearance`
 * was the only writer and it only knows the app theme. The reader wears the
 * CHART theme, so while a reader is on screen it takes the bar over.
 *
 * One module-level owner instead of two effects racing for the same tag:
 * `useAppearance` reports the app colour here, a reader pushes an override,
 * and `apply()` writes whichever wins. Leaving the reader drops the override
 * and the app colour comes straight back — including an app theme change
 * that happened while the reader was open.
 *
 * ⚠ The Android NAVIGATION bar (bottom) is not ours. Chrome paints an
 * installed app's navigation bar from the MANIFEST's `theme_color`, read at
 * install time, and no page-side tag changes it. See the PR notes.
 */

let appColor = null;
let override = null;
let resolve = () => resolveChartBg();

function writeMeta(color) {
  if (typeof document === 'undefined' || !color) return;
  // Media-scoped tags would win on the platforms that honour them; one
  // unscoped tag is the single source of truth once the app is running.
  document.querySelectorAll('meta[name="theme-color"][media]').forEach(m => m.remove());
  let tag = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'theme-color');
    document.head.appendChild(tag);
  }
  if (tag.getAttribute('content') !== color) tag.setAttribute('content', color);
}

function apply() {
  writeMeta(override || appColor);
}

/** The app theme's colour. Called by `useAppearance`. */
export function setAppBarColor(color) {
  appColor = color;
  apply();
}

/**
 * The colour `--chart-bg` resolves to right now, as `rgb(...)`.
 *
 * A probe rather than reading the custom property: the Warm theme names a
 * token (`var(--background)`), not a colour, so the property's text is not
 * something a meta tag can hold. The browser resolves it for us.
 */
export function resolveChartBg() {
  if (typeof document === 'undefined' || !document.body) return null;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;background-color:var(--chart-bg, var(--background))';
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  // Transparent / empty = nothing resolved (jsdom, or no theme yet).
  // An unresolved `var(` means the engine doesn't do custom properties (jsdom).
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color.includes('var(')) return null;
  return color;
}

/**
 * While `active`, the status bar wears the chart theme's background.
 *
 * It re-resolves whenever `<html>`'s `style` (where `useChartTheme` writes the
 * `--chart-*` tokens) or `data-theme` (Warm follows light/dark) changes, so
 * picking a theme in the ☰ repaints the bar in the same frame as the page.
 */
export function useChartSystemBars(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const sync = () => {
      override = resolve();
      apply();
    };
    sync();
    let mo = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(sync);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    }
    return () => {
      mo?.disconnect();
      override = null;
      apply();
    };
  }, [active]);
}

// Test seams. jsdom does not resolve custom properties, so tests hand in
// the resolved colour.
export function __resetSystemBars(resolver = null) {
  appColor = null;
  override = null;
  resolve = resolver || (() => resolveChartBg());
}
