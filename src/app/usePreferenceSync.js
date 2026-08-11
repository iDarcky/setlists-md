import { useEffect, useRef } from 'react';

// Subset of local settings that gets mirrored to the user's cloud profile
// (profiles.preferences). Device-local flags like onboardingComplete,
// helpPageSeen, and the notification inbox are intentionally excluded.
//
// Adding a new portable preference? Add its key here or it won't follow the
// user across devices.
export const PORTABLE_PREF_KEYS = [
  'theme',
  'defaultColumns',
  'defaultFontSize',
  'chordFontSize',
  'nashville',
  'notation',
  // Element 19. `{ [songId]: fret }` — YOUR capo per song, never the band's.
  // It follows the account (owner, 2026-08-10: *"yes, it should follow the
  // account"*) because a guitarist who set capo 2 on their phone wants capo 2
  // on the iPad at rehearsal, and it is the one thing here that is per-song
  // rather than per-app.
  'songCapos',
  // 5/6 — where an inline note goes: the right margin, or under its line.
  'readerNotePlacement',
  'showChords',
  'showDiagrams',
  'pedalNext',
  'pedalPrev',
  'showInlineNotes',
  'inlineNoteStyle',
  'duplicateSections',
  'chartTheme',
  'chartBg',
  'chartText',
  'chartChordColor',
  'chartLyricColor',
  'chartChordFont',
  'chartLyricFont',
  'sectionColors',
  'sectionLabels',
  'customSectionTypes',
  'customChartThemes',
  'accentColor',
  'lyricLineHeight',
  'sectionSpacing',
  'firstDayOfWeek',
  'clockFormat',
  'userName',
  'lastChangelogVersion',
  'performanceRail',
  'navStyle',
  'displayMode',
  'ribbonStyle',
  'structurePosition',
  'keepAwake',
  'lockOrientation',
  'accidentals',
  'dashboardWidgetOrder',
  'dashboardHidden',
  'landingView',
  'language',
  'confirmBeforeDelete',
  'defaultSpaceId',
  'tabSubdivision',
  'tabSize',
  'tabStringColor',
  'tabNumberColor',
  'tabBg',
  'rosterOverscheduleWarning',
  'rosterStreakLimit',
  'tableColumns',
  'serviceReminders',
  'rehearsalReminders',
  'songsLibraryPlus',
  'setlistsLibraryPlus',
  'hmMenu',
  'accountPanel',
  'pasteIntoChart',
  'readerHeading',
  'readerSectionStyle',
  'readerSticky',
  'readerNotes',
  'readerInlineNotes',
  'readerFooter',
  'readerNav',
  'readerTopBar',
  'readerFlow',
  'readerProgress',
  // The ☰ → "The music" row writes both: the role preset itself, and the tab
  // filter it implies. Without these two the picker looked like it worked and
  // then forgot itself on the next device.
  'displayRole',
  'tabInstrument',
];

export function extractPortablePrefs(s) {
  const out = {};
  if (!s) return out;
  for (const k of PORTABLE_PREF_KEYS) {
    if (s[k] !== undefined) out[k] = s[k];
  }
  return out;
}

export function prefsEqual(a, b) {
  for (const k of PORTABLE_PREF_KEYS) {
    const av = a?.[k] ?? null;
    const bv = b?.[k] ?? null;
    if (av === bv) continue;
    // Several portable keys hold objects/arrays (sectionColors, tableColumns,
    // readerConfig…). Reference equality never holds for those, so without a
    // value comparison this short-circuit could never fire for them and every
    // load pushed a redundant write.
    if (av && bv && typeof av === 'object' && typeof bv === 'object') {
      if (JSON.stringify(av) === JSON.stringify(bv)) continue;
    }
    return false;
  }
  return true;
}

/**
 * Account-level preference sync.
 *
 * Hydrates the portable subset of settings from the cloud once per signed-in
 * user (cloud wins), then pushes local changes back, debounced.
 *
 * The once-per-user-id guard is load-bearing: re-running hydration on every
 * profile change would clobber a local edit the user made a moment ago with
 * the older cloud value.
 */
export function usePreferenceSync({ loaded, settings, setSettings, user, profile, updateProfile }) {
  const hydratedForUserRef = useRef(null);
  const pushTimerRef = useRef(null);

  // Hydrate once per user id. Cloud is source of truth for the portable
  // subset; device-local fields stay untouched.
  useEffect(() => {
    if (!loaded || !settings || !user?.id || !profile) return;
    if (hydratedForUserRef.current === user.id) return;
    hydratedForUserRef.current = user.id;
    const cloud = profile.preferences;
    if (cloud && typeof cloud === 'object' && Object.keys(cloud).length > 0) {
      setSettings(prev => ({ ...prev, ...cloud }));
    }
  }, [loaded, user?.id, profile, settings, setSettings]);

  // Forget the hydration marker on sign-out so a later sign-in re-hydrates.
  useEffect(() => {
    if (!user?.id) hydratedForUserRef.current = null;
  }, [user?.id]);

  // A single stable dep covering all portable keys, so the push fires whenever
  // *any* of them changes rather than only the handful once listed by name.
  const portablePrefsSnapshot = settings ? JSON.stringify(extractPortablePrefs(settings)) : null;

  // Push portable changes to the cloud, debounced, and only after hydration —
  // otherwise local defaults would overwrite real server state on first load.
  useEffect(() => {
    if (!loaded || !settings || !user?.id) return;
    if (hydratedForUserRef.current !== user.id) return;
    const portable = extractPortablePrefs(settings);
    if (prefsEqual(portable, profile?.preferences || {})) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      updateProfile({ preferences: portable }).catch(err => {
        console.warn('[prefs] cloud sync failed:', err?.message || err);
      });
    }, 800);
    return () => clearTimeout(pushTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user?.id, portablePrefsSnapshot]);
}
