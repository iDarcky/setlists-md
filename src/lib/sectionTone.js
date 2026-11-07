import { sectionStyle, compactLabel } from '@/music';

// The song page's section colours (owner, 2026-11-04: "bring back the colors,
// but more suitable for the new design"). Muted hues from ds.css `--tone-*`,
// one per family of section; an invented type keeps the colour its owner gave
// it. Text in the colour, fill at 16% of it — the same recipe for every chip.

const FAMILY = [
  [/^(intro|outro|ending)/, 'intro'],
  [/^pre/, 'prechorus'],
  [/^(chorus|refrain)/, 'chorus'],
  [/^verse/, 'verse'],
  [/^bridge/, 'bridge'],
  [/^(instrumental|interlude|solo)/, 'instrumental'],
  [/^(tag|vamp)/, 'tag'],
];

/** { code, fg, bg } for a section type ("Verse 2" → V2 in sage). */
export function sectionTone(type, customTypes = null) {
  const name = String(type || '');
  const letters = name.toLowerCase().replace(/[^a-z]/g, '');
  const code = compactLabel(name, customTypes);
  const custom = Array.isArray(customTypes)
    && customTypes.find(t => t?.name && t.name.toLowerCase() === name.replace(/\s*\d+$/, '').trim().toLowerCase());
  const family = !custom && FAMILY.find(([re]) => re.test(letters))?.[1];
  const fg = family ? `var(--tone-${family})` : custom ? sectionStyle(name, null, customTypes).b : 'var(--muted-foreground)';
  return { code, fg, bg: `color-mix(in srgb, ${fg} 16%, transparent)` };
}
