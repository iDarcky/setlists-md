/**
 * The chart fonts, served from our own origin (QA 11 Nov, row 161).
 *
 * They used to be a `<link>` to fonts.googleapis.com injected the first time a
 * font was picked. Two problems with that: the service worker never cached
 * them, so offline (or on a church Wi-Fi that drops Google) the chart fell back
 * to the stack's next font; and the fallbacks are shared — Inter and IBM Plex
 * Sans both fall to system-ui, the three serifs to Georgia-alikes — so picking
 * the font NEXT to the one you had often changed nothing on screen, while a
 * jump to another family did. That is exactly what the owner saw.
 *
 * Now each font is a bundled `@fontsource` package, imported on demand. Vite
 * splits each into its own CSS + woff2 files and the PWA precaches them, so a
 * picked font works offline from then on. The `@font-face` rules carry
 * `unicode-range`, so only the subsets a song uses (latin, latin-ext for
 * ă ș ț) are downloaded.
 */
const LOADERS = {
  inter: () => Promise.all([
    import('@fontsource/inter/400.css'), import('@fontsource/inter/500.css'),
    import('@fontsource/inter/600.css'), import('@fontsource/inter/700.css'),
  ]),
  'ibm-plex-sans': () => Promise.all([
    import('@fontsource/ibm-plex-sans/400.css'), import('@fontsource/ibm-plex-sans/500.css'),
    import('@fontsource/ibm-plex-sans/600.css'), import('@fontsource/ibm-plex-sans/700.css'),
  ]),
  lora: () => Promise.all([
    import('@fontsource/lora/400.css'), import('@fontsource/lora/500.css'),
    import('@fontsource/lora/600.css'), import('@fontsource/lora/700.css'),
    import('@fontsource/lora/400-italic.css'),
  ]),
  'eb-garamond': () => Promise.all([
    import('@fontsource/eb-garamond/400.css'), import('@fontsource/eb-garamond/500.css'),
    import('@fontsource/eb-garamond/600.css'), import('@fontsource/eb-garamond/700.css'),
    import('@fontsource/eb-garamond/400-italic.css'),
  ]),
  'crimson-pro': () => Promise.all([
    import('@fontsource/crimson-pro/400.css'), import('@fontsource/crimson-pro/500.css'),
    import('@fontsource/crimson-pro/600.css'), import('@fontsource/crimson-pro/700.css'),
    import('@fontsource/crimson-pro/400-italic.css'),
  ]),
  // JetBrains Mono is already imported app-wide in `main.jsx`.
  'jetbrains-mono': () => Promise.resolve(),
  'ibm-plex-mono': () => Promise.all([
    import('@fontsource/ibm-plex-mono/400.css'), import('@fontsource/ibm-plex-mono/500.css'),
    import('@fontsource/ibm-plex-mono/600.css'), import('@fontsource/ibm-plex-mono/700.css'),
  ]),
  'fira-code': () => Promise.all([
    import('@fontsource/fira-code/400.css'), import('@fontsource/fira-code/500.css'),
    import('@fontsource/fira-code/600.css'), import('@fontsource/fira-code/700.css'),
  ]),
  'roboto-mono': () => Promise.all([
    import('@fontsource/roboto-mono/400.css'), import('@fontsource/roboto-mono/500.css'),
    import('@fontsource/roboto-mono/600.css'), import('@fontsource/roboto-mono/700.css'),
  ]),
};

const started = new Map();

/** Load a chart font's faces once. Unknown ids (system, Geist) are no-ops. */
export function ensureChartFont(fontId) {
  const load = LOADERS[fontId];
  if (!load) return Promise.resolve();
  if (!started.has(fontId)) {
    // A failed import (offline before it was ever cached) is forgotten, so the
    // next pick tries again instead of being stuck on the fallback.
    started.set(fontId, load().catch(() => { started.delete(fontId); }));
  }
  return started.get(fontId);
}

export const SELF_HOSTED_CHART_FONTS = Object.keys(LOADERS);
