import { useEffect } from 'react';
import {
  CHART_FONT_MAP,
  chartTheme,
  chartFontStack,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
} from '../data/chartThemes';

// Google Fonts links are reused across mounts via this set, so picking
// the same font twice doesn't double-inject a <link>.
const loadedFonts = new Set();

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
    const bg = settings?.chartBg || theme.bg;
    const text = settings?.chartText || theme.text;
    const chord = settings?.chartChordColor || theme.chord;
    const subtle = theme.subtle;

    const chordFontId = settings?.chartChordFont || DEFAULT_CHORD_FONT_ID;
    const lyricFontId = settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID;
    ensureGoogleFont(chordFontId);
    ensureGoogleFont(lyricFontId);

    const root = document.documentElement;
    root.style.setProperty('--chart-bg', bg);
    root.style.setProperty('--chart-text', text);
    root.style.setProperty('--chart-subtle', subtle);
    root.style.setProperty('--chord', chord);
    root.style.setProperty('--chart-font-chord', chartFontStack(chordFontId, DEFAULT_CHORD_FONT_ID));
    root.style.setProperty('--chart-font-lyric', chartFontStack(lyricFontId, DEFAULT_LYRIC_FONT_ID));
  }, [
    settings?.chartTheme,
    settings?.chartBg,
    settings?.chartText,
    settings?.chartChordColor,
    settings?.chartChordFont,
    settings?.chartLyricFont,
    settings?.customChartThemes,
  ]);
}
