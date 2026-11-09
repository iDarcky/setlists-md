// The reader's new look (2026-11-04), moved onto existing profiles ONCE.
//
// ⚠ Changing a default reaches nobody here: `loadSettings` merges defaults
// under the stored object and `saveSettings` writes the merged object back, so
// every profile already has the OLD defaults written down (CLAUDE.md, the
// unifiedReader note). So the move is explicit, and a flag says it happened.
//
// Only values that were AUTOMATIC defaults move: the three chart themes the
// first run used to pick by app theme, and the "Name" heading. A profile on
// any other theme or heading made that choice and keeps it. The flag is a
// portable pref, so a cloud copy written before the move cannot undo it on the
// next sign-in: it arrives without the flag and is moved again.

export const READER_LOOK_FLAG = 'readerLookV2';
const OLD_DEFAULT_THEMES = new Set(['sunday-light', 'stage-black', 'midnight']);

/** The settings with the new look applied, or the same object when already done. */
export function applyReaderLook(settings) {
  if (!settings || settings[READER_LOOK_FLAG]) return settings;
  const next = { ...settings, [READER_LOOK_FLAG]: true };
  if (!next.chartTheme || OLD_DEFAULT_THEMES.has(next.chartTheme)) next.chartTheme = 'warm';
  if (!next.readerHeading || next.readerHeading === 'name') next.readerHeading = 'chip';
  return next;
}
