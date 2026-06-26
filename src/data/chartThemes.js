// Chart theme presets and font library for the Pro/Sync "Advanced layout"
// feature. Themes ship as CSS-variable bundles applied at the document
// root when a chart is on screen; users on a paid plan can override any
// individual swatch through the Chart Style settings panel.

// IDs of themes available on every plan (including free). These are the
// defaults that track the user's app theme on first launch, so they should
// always be selectable without an upgrade gate.
export const FREE_CHART_THEME_IDS = new Set(['sunday-light', 'stage-black', 'midnight']);

export const CHART_THEMES = [
  {
    id: 'sunday-light',
    name: 'Sunday Light',
    description: 'Classic paper-bright chart for daylight stages.',
    free: true,
    bg: '#fbfaf6',
    text: '#1c1b1a',
    chord: '#b8860b',
    subtle: '#6b6660',
  },
  {
    id: 'stage-black',
    name: 'Stage Black',
    description: 'Pure black background, gold chords. Built for dim stages.',
    free: true,
    bg: '#050505',
    text: '#fafafa',
    chord: '#f5c043',
    subtle: '#8b8b8b',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Inky blue gradient, soft cream type.',
    free: true,
    bg: '#0d1320',
    text: '#f1ecdc',
    chord: '#7ec1ff',
    subtle: '#7a8aa8',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Warm parchment tone. Easy on tired eyes.',
    bg: '#f3ead4',
    text: '#3b2f1d',
    chord: '#a04a1f',
    subtle: '#7d6a4a',
  },
  {
    id: 'vellum',
    name: 'Vellum',
    description: 'Soft off-white with deep ink chords.',
    bg: '#f5f2e9',
    text: '#1f1c16',
    chord: '#2a4f8f',
    subtle: '#5a554a',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Slate grey background, high-contrast accents.',
    bg: '#1a1a1c',
    text: '#e8e6e3',
    chord: '#e07a4f',
    subtle: '#7a7773',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool quiet blue-grey, gentle chord highlight.',
    bg: '#252a33',
    text: '#dfe3ea',
    chord: '#9ad4c0',
    subtle: '#7e8896',
  },
  {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Plum-tinged dark with rose chord accents.',
    bg: '#1d1226',
    text: '#f3e8df',
    chord: '#f0a3b8',
    subtle: '#7d6480',
  },
];

export const CHART_THEME_MAP = Object.fromEntries(CHART_THEMES.map(t => [t.id, t]));
export const DEFAULT_CHART_THEME_ID = 'sunday-light';

// Curated font library. `system` and the Geist family come from the app
// shell so they load instantly; the rest are Google Fonts and are
// fetched on demand the first time the user picks one. `category` is
// purely for organising the picker.

export const CHART_FONTS = [
  // System / shell — no network fetch
  { id: 'system-ui',       name: 'System Sans',     stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', category: 'system' },
  { id: 'geist-sans',      name: 'Geist Sans',      stack: 'var(--font-sans), sans-serif',                              category: 'system' },
  { id: 'geist-mono',      name: 'Geist Mono',      stack: 'var(--font-mono), monospace',                               category: 'system' },

  // Google Fonts — sans
  { id: 'inter',           name: 'Inter',           stack: '"Inter", system-ui, sans-serif',         category: 'sans',   googleFont: 'Inter:wght@400;500;600;700' },
  { id: 'ibm-plex-sans',   name: 'IBM Plex Sans',   stack: '"IBM Plex Sans", system-ui, sans-serif', category: 'sans',   googleFont: 'IBM+Plex+Sans:wght@400;500;600;700' },

  // Google Fonts — serif (lyric-friendly)
  { id: 'lora',            name: 'Lora',            stack: '"Lora", Georgia, serif',                 category: 'serif',  googleFont: 'Lora:ital,wght@0,400..700;1,400..700' },
  { id: 'eb-garamond',     name: 'EB Garamond',     stack: '"EB Garamond", Garamond, serif',         category: 'serif',  googleFont: 'EB+Garamond:ital,wght@0,400..700;1,400..700' },
  { id: 'crimson-pro',     name: 'Crimson Pro',     stack: '"Crimson Pro", "Crimson Text", serif',   category: 'serif',  googleFont: 'Crimson+Pro:ital,wght@0,400..700;1,400..700' },

  // Google Fonts — mono (chord-friendly)
  { id: 'jetbrains-mono',  name: 'JetBrains Mono',  stack: '"JetBrains Mono", ui-monospace, monospace', category: 'mono', googleFont: 'JetBrains+Mono:wght@400;500;600;700' },
  { id: 'ibm-plex-mono',   name: 'IBM Plex Mono',   stack: '"IBM Plex Mono", ui-monospace, monospace',  category: 'mono', googleFont: 'IBM+Plex+Mono:wght@400;500;600;700' },
  { id: 'fira-code',       name: 'Fira Code',       stack: '"Fira Code", ui-monospace, monospace',      category: 'mono', googleFont: 'Fira+Code:wght@400;500;600;700' },
  { id: 'roboto-mono',     name: 'Roboto Mono',     stack: '"Roboto Mono", ui-monospace, monospace',    category: 'mono', googleFont: 'Roboto+Mono:wght@400;500;600;700' },
];

export const CHART_FONT_MAP = Object.fromEntries(CHART_FONTS.map(f => [f.id, f]));

export const DEFAULT_CHORD_FONT_ID = 'geist-mono';
export const DEFAULT_LYRIC_FONT_ID = 'geist-sans';

// Fixed colour palette for the Aa menu's per-element (lyric / chord) colour
// override. A `value` of `null` means "follow the active theme" (clears the
// override). Kept small + curated so the picker stays a palette, not a colour
// wheel; the same set is offered for both lyrics and chords.
export const CHART_COLOR_PALETTE = [
  { id: 'theme',  name: 'Theme default', value: null },
  { id: 'gold',   name: 'Gold',          value: '#e0b341' },
  { id: 'amber',  name: 'Amber',         value: '#e07a4f' },
  { id: 'rose',   name: 'Rose',          value: '#f0a3b8' },
  { id: 'blue',   name: 'Blue',          value: '#7ec1ff' },
  { id: 'violet', name: 'Violet',        value: '#bb9af7' },
  { id: 'green',  name: 'Green',         value: '#46c79a' },
  { id: 'ink',    name: 'Ink',           value: '#1c1b1a' },
  { id: 'paper',  name: 'Paper',         value: '#fafafa' },
];

// Resolve a font id (or undefined) to a CSS font stack.
export function chartFontStack(id, fallback) {
  if (id && CHART_FONT_MAP[id]) return CHART_FONT_MAP[id].stack;
  if (fallback && CHART_FONT_MAP[fallback]) return CHART_FONT_MAP[fallback].stack;
  return CHART_FONT_MAP[DEFAULT_LYRIC_FONT_ID].stack;
}

// Resolve a theme id (or undefined) to a theme object. Accepts an optional
// list of user-saved custom themes so they participate in the same lookup.
export function chartTheme(id, customThemes = null) {
  if (id && Array.isArray(customThemes)) {
    const found = customThemes.find(t => t.id === id);
    if (found) return found;
  }
  return CHART_THEME_MAP[id] || CHART_THEME_MAP[DEFAULT_CHART_THEME_ID];
}
