import { HomeIcon, CalendarIcon, MusicIcon } from './navIcons';

// The app's three places — the nav pill's items.
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'schedule', label: 'Schedule', Icon: CalendarIcon },
  { id: 'songs', label: 'Songs', Icon: MusicIcon },
];

/** Which pill item a view belongs to, or null (Settings, You, …). */
export function navItemFor(view) {
  if (view === 'home') return 'home';
  if (['schedule', 'scheduling', 'setlists', 'setlist-view', 'setlist-build'].includes(view)) return 'schedule';
  if (['library', 'song-hub'].includes(view)) return 'songs';
  return null;
}
