import { useEffect } from 'react';

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
    const theme = settings.theme;

    const setThemeColor = (mode) => {
      // Must track --ds-background-100 per theme, or the phone's status bar is
      // a different colour from the page under it.
      const color = mode === 'light' ? '#f6f4ef' : mode === 'midnight' ? '#161a24' : '#161618';
      // Remove the media-scoped tags so the single active tag wins everywhere.
      document.querySelectorAll('meta[name="theme-color"][media]').forEach(m => m.remove());
      let tag = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'theme-color');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', color);
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
