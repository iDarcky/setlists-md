import { sectionStyle, sectionLabel, compactLabel } from '@/music';
import { sectionWeight } from '@/lib/songFlow';

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
  const s = sectionStyle(type, settings?.sectionColors, settings?.customSectionTypes);
  return {
    code: compactLabel(type),                            // "C2"
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
  return style === 'code' ? identity.code : identity.name;
}

export const HEADING_STYLES = ['name', 'code'];
