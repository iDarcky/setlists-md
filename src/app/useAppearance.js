import { useEffect } from 'react';
import { setAppBarColor } from '@/lib/systemBars';

/**
 * Document-level appearance: theme, the Labs neutral palette, and orientation
 * lock. All three write to <html> or the document head rather than to React
 * state, which is why they live together and outside the component tree.
 */
export function useAppearance(settings) {
  // Apply theme to document — 'default' follows system preference.
  // Also keeps the active <meta name="theme-color"> in sync so Android's system
  // bars (status bar + navigation pill) tint to match the current theme.
  useEffect(() => {
    if (!settings) return;
    // Midnight is retired (to-do row 75): a stored 'midnight' paints as Dark.
    // Its navy surfaces otherwise survive on every screen still on the old
    // tokens — the boot screen first of all.
    const theme = settings.theme === 'midnight' ? 'dark' : settings.theme;

    const setThemeColor = (mode) => {
      // Must track `--background` (ds.css, what `<main>` paints) per theme, or the phone's status bar is
      // a different colour from the page under it. A reader on screen overrides
      // this with the chart's own background (`lib/systemBars.js`).
      setAppBarColor(mode === 'light' ? '#f6f4ef' : '#11100e');
    };

    if (theme === 'default') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => {
        const mode = mq.matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', mode);
        setThemeColor(mode);
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    document.documentElement.setAttribute('data-theme', theme);
    setThemeColor(theme);
  }, [settings?.theme]);

  // Settings → General → "Lock orientation". Best-effort: the Screen Orientation
  // lock API only resolves in full screen / an installed PWA on most engines and
  // throws on iOS Safari — swallow failures so it's a no-op where unsupported.
  useEffect(() => {
    if (!settings?.lockOrientation) return undefined;
    const o = typeof screen !== 'undefined' ? screen.orientation : null;
    if (!o?.lock) return undefined;
    o.lock(o.type).catch(() => {});
    return () => { try { o.unlock?.(); } catch { /* unsupported */ } };
  }, [settings?.lockOrientation]);
}
