import { HomeIcon, MusicIcon } from './navIcons';

// The app's two places — the nav pill's items. Schedule left the bar on
// 2026-11-15 (owner picked "A: own page from Home"): it opens from Home's
// "Your two weeks" card and counts as part of Home, so the Home tab stays lit
// while you're in it.
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'songs', label: 'Songs', Icon: MusicIcon },
];

/** Which pill item a view belongs to, or null (Settings, You, …). */
export function navItemFor(view) {
  if (['home', 'schedule', 'scheduling', 'setlists', 'setlist-view', 'setlist-build'].includes(view)) return 'home';
  if (['library', 'song-hub'].includes(view)) return 'songs';
  return null;
}
