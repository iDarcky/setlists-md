import { HomeIcon, SetlistIcon, MusicIcon } from './navIcons';

// The app's three places — the nav pill's items. Setlists came back on
// 2026-11-15 (owner: with only Home + Songs, people couldn't find how to make
// a setlist or see old ones). Schedule stays off the bar: it opens from Home's
// "Your two weeks" card and counts as part of Home, so the Home tab stays lit
// while you're in it.
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'setlists', label: 'Setlists', Icon: SetlistIcon },
  { id: 'songs', label: 'Songs', Icon: MusicIcon },
];

/** Which pill item a view belongs to, or null (Settings, You, …). */
export function navItemFor(view) {
  if (['home', 'schedule', 'scheduling'].includes(view)) return 'home';
  if (['setlists', 'setlist-view', 'setlist-build'].includes(view)) return 'setlists';
  if (['library', 'song-hub'].includes(view)) return 'songs';
  return null;
}
