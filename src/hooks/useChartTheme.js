import { useEffect } from 'react';
import {
  CHART_FONT_MAP,
  chartTheme,
  chartFontStack,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
} from '@/data/chartThemes';

// Google Fonts links are reused across mounts via this set, so picking
// the same font twice doesn't double-inject a <link>.
const loadedFonts = new Set();

// Rough perceived-lightness of a #rrggbb (or #rgb) colour, 0–1. Used to pick a
// light-on-dark vs dark-on-light hairline for the themed chart header.
function isLightColor(hex) {
  if (typeof hex !== 'string') return false;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceptual luminance (sRGB weights).
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

function ensureGoogleFont(fontId) {
  if (!fontId || loadedFonts.has(fontId)) return;
  const font = CHART_FONT_MAP[fontId];
  if (!font?.googleFont) return;
  loadedFonts.add(fontId);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFont}&display=swap`;
  link.dataset.chartFont = fontId;
  document.head.appendChild(link);
}

// Apply the user's selected theme + per-swatch overrides to the document
// root as CSS variables. ChartView and SectionBlock read these via
// `var(--chart-bg)` etc. We also override `--chord` so the gold accent
// inherits the user's chord-color pick everywhere.
export function useChartTheme(settings) {
  useEffect(() => {
    const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
    const theme = chartTheme(themeId, settings?.customChartThemes);
    // Built-in themes are read-only — their colours come straight from
    // the preset. Custom themes carry their bg/text/chord on the record
    // itself, which the user edits via Chart Style → Customise.
    const bg = theme.bg;
    // Per-element colour overrides from the display menus (fixed palette). When
    // set they win over the theme's; cleared (falsy) → follow the theme.
    //
    // ⚠ `chartLyricColor` writes `--chart-lyric`, NOT `--chart-text`. It used to
    // write `--chart-text`, which is the chart's INK — the top bar's title, the
    // section headings, and (through `chartSurface`) `--text-1`,
    // `--ds-gray-1000` and every control in the reader's chrome. So picking a
    // lyric colour repainted the entire reader UI (owner, 2026-08-04: "lyrics
    // color selections is changing the reader ui, not only the songs lyrics, it
    // should be separate"). `--chart-text` is the theme's, always; only the
    // lyrics themselves follow the picker.
    const text = theme.text;
    const lyric = settings?.chartLyricColor || theme.text;
    const chord = settings?.chartChordColor || theme.chord;
    const subtle = theme.subtle;

    const chordFontId = settings?.chartChordFont || DEFAULT_CHORD_FONT_ID;
    const lyricFontId = settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID;
    ensureGoogleFont(chordFontId);
    ensureGoogleFont(lyricFontId);

    const root = document.documentElement;
    root.style.setProperty('--chart-bg', bg);
    root.style.setProperty('--chart-text', text);
    root.style.setProperty('--chart-lyric', lyric);
    root.style.setProperty('--chart-subtle', subtle);
    root.style.setProperty('--chord', chord);
    // Make the sticky stage header match the chart theme rather than the app
    // theme, so a light chart under a dark app (or vice-versa) doesn't leave a
    // mismatched bar pinned on top. The bg is opaque (theme presets are solid),
    // and the hairline flips with the background's lightness.
    root.style.setProperty('--chart-header-bg', bg);
    root.style.setProperty('--chart-header-border', isLightColor(bg) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)');
    // Every rule *inside* the chart — section frames, column rules, the note
    // margin — needs to track the chart theme too, for the same reason. A
    // slightly stronger hairline than the header's, since these sit on the
    // chart body rather than under a bar.
    root.style.setProperty('--chart-rule', isLightColor(bg) ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.14)');
    root.style.setProperty('--chart-font-chord', chartFontStack(chordFontId, DEFAULT_CHORD_FONT_ID));
    root.style.setProperty('--chart-font-lyric', chartFontStack(lyricFontId, DEFAULT_LYRIC_FONT_ID));

    // Accent (brand) colour — overrides --color-brand globally so Pro
    // users can re-skin buttons, focus rings, and active highlights.
    if (settings?.accentColor) {
      root.style.setProperty('--color-brand', settings.accentColor);
    } else {
      root.style.removeProperty('--color-brand');
    }
  }, [
    settings?.chartTheme,
    settings?.chartChordFont,
    settings?.chartLyricFont,
    settings?.chartChordColor,
    settings?.chartLyricColor,
    settings?.customChartThemes,
    settings?.accentColor,
  ]);
}
