import { sectionStyle, sectionLabel, compactLabel } from '@/music';
import { sectionWeight } from '@/lib/songFlow';
import { CHART_THEME_MAP, DEFAULT_CHART_THEME_ID } from '@/data/chartThemes';

/**
 * Section colours, resolved theme-first.
 *
 * A chart theme may ship its own `sections` palette so it reads as a complete
 * look rather than a background swap — the built-in SECTION_COLORS were picked
 * with no particular ground in mind, so a vivid pink chorus on warm paper never
 * belonged to the same design. A theme that omits `sections` keeps them.
 *
 * The user's own overrides always win over the theme's.
 */
export function resolveSectionColors(settings) {
  const theme = CHART_THEME_MAP[settings?.chartTheme || DEFAULT_CHART_THEME_ID];
  const custom = settings?.customChartThemes?.find?.(t => t.id === settings?.chartTheme);
  const themeSections = custom?.sections || theme?.sections;
  if (!themeSections) return settings?.sectionColors;
  return { ...themeSections, ...(settings?.sectionColors || {}) };
}

/**
 * One section, one identity — used by BOTH the structure ribbon and the
 * in-chart section heading.
 *
 * This exists because the reader's whole "where am I" mechanic depends on the
 * ribbon and the heading reading as the *same object*. If the ribbon highlights
 * a red C2, the chorus on the page has to be unmistakably that same red C2.
 * Previously each rendered its own treatment from the same colour source and
 * they drifted; anything that needs a section's appearance now comes here.
 *
 * @returns {{code:string,name:string,color:string,fill:string,border:string,heavy:boolean}}
 */
export function sectionIdentity(type, settings) {
  const s = sectionStyle(type, resolveSectionColors(settings), settings?.customSectionTypes);
  return {
    code: compactLabel(type, settings?.customSectionTypes), // "C2"
    name: sectionLabel(type, settings?.sectionLabels),   // "Chorus 2"
    color: s.b,      // the section colour — text, bars, active fills
    fill: s.bg,      // low-alpha tint for block backgrounds
    border: s.br,
    // A chorus or bridge carries the weight of a song; a verse is connective.
    // Giving them identical treatment is what made the page read as one block.
    heavy: sectionWeight(type) === 'hi',
  };
}

/**
 * What the in-chart heading spells out. The ribbon is always codes (it has no
 * room for more); the heading is the user's choice, because "CHORUS" reads
 * plainly while "C2" ties tightest to the ribbon.
 */
export function headingText(identity, style = 'name') {
  if (style === 'code') return identity.code;
  // 'caps' is the original chart's heading — the full name in caps with a
  // trailing colon. Same text as 'name'; the styling is what differs.
  if (style === 'caps') return `${identity.name}:`;
  return identity.name;
}

export const HEADING_STYLES = ['name', 'code', 'caps'];
