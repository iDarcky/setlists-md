import { Toaster } from "./components/ui/Toaster";
import { toast } from "./components/ui/use-toast";
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { parseSongMd, songToMd, generateId } from './parser';
import { loadSongs, saveSongs, loadSetlists, saveSetlists, loadSettings, saveSettings, loadTombstones, saveTombstones, getStorageEstimate, clearAll } from './storage';
import { DEMO_SONGS_MD } from './data/demos';
import { createSyncEngine } from './sync/engine';
import { getSyncState, setActiveProvider } from './sync/tokens';
import OnboardingFlow from './onboarding/OnboardingFlow';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import Settings from './components/Settings';
import Account from './components/Account';
import Setlists from './components/Setlists';
import BottomNav from './components/BottomNav';
import DesktopLayout from './components/DesktopLayout';
import MobileTopBar from './components/MobileTopBar';
import MobileDrawer from './components/MobileDrawer';
import NotificationTray from './components/NotificationTray';
import FeedbackButton from './components/FeedbackButton';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './auth/useAuth';
import { useTeam } from './auth/useTeam';
import { exportSetlistZip, importSetlistZip, slugify } from './setlist-io';
import { exportSetlistPdf } from './pdf/exportSetlistPdf';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useTeamRealtime } from './hooks/useTeamRealtime';

const QUOTA_WARN_THRESHOLD = 0.8;

async function maybeWarnQuota(warnedRef) {
  if (warnedRef.current) return;
  const est = await getStorageEstimate();
  if (!est || est.ratio < QUOTA_WARN_THRESHOLD) return;
  warnedRef.current = true;
  const pct = Math.round(est.ratio * 100);
  toast({
    title: 'Storage almost full',
    description: `This device has used ${pct}% of its browser storage. Consider exporting and archiving older songs.`,
    variant: 'error',
  });
}

function notifyConflicts(conflicts) {
  const titles = conflicts
    .map(c => c.title || (c.kind === 'song' ? 'Untitled song' : 'Untitled setlist'))
    .slice(0, 3)
    .join(', ');
  const extra = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : '';
  toast({
    title: 'Cloud overwrote local changes',
    description: `Your edits to ${titles}${extra} were replaced with the cloud version.`,
    variant: 'error',
  });
}

// Lazy-loaded: heavy secondary views not needed on initial render
const ChartView = lazy(() => import('./components/ChartView'));
const Editor = lazy(() => import('./components/Editor'));
const SetlistBuilder = lazy(() => import('./components/SetlistBuilder'));
const SetlistPlayer = lazy(() => import('./components/SetlistPlayer'));
const SetlistOverview = lazy(() => import('./components/SetlistOverview'));
const PerformanceView = lazy(() => import('./components/PerformanceView'));
const PracticeView = lazy(() => import('./components/PracticeView'));
const LydianShowcase = lazy(() => import('./components/LydianShowcase'));
const NewSongModal = lazy(() => import('./components/NewSongModal'));
const HelpPage = lazy(() => import('./components/HelpPage'));
const AuthScreen = lazy(() => import('./components/auth/AuthScreen'));
const AuthCallback = lazy(() => import('./components/auth/AuthCallback'));
const RecoveryScreen = lazy(() => import('./components/auth/RecoveryScreen'));
const PricingScreen = lazy(() => import('./components/PricingScreen'));
const TeamScreen = lazy(() => import('./components/TeamScreen'));
const Schedule = lazy(() => import('./components/Schedule'));
const WakeLockExplainer = lazy(() => import('./components/WakeLockExplainer'));
const AccountWall = lazy(() => import('./components/AccountWall'));
const FounderNote = lazy(() => import('./components/FounderNote'));
const IOSInstallHint = lazy(() => import('./components/IOSInstallHint'));

// Subset of local settings that gets mirrored to the user's cloud profile
// (profiles.preferences). Device-local flags like onboardingComplete,
// helpPageSeen, and the notification inbox are intentionally excluded.
const PORTABLE_PREF_KEYS = [
  'theme',
  'defaultColumns',
  'defaultFontSize',
  'pedalNext',
  'pedalPrev',
  'showInlineNotes',
  'inlineNoteStyle',
  'displayRole',
  'duplicateSections',
  'chartLayout',
  'userName',
];

function extractPortablePrefs(s) {
  const out = {};
  if (!s) return out;
  for (const k of PORTABLE_PREF_KEYS) {
    if (s[k] !== undefined) out[k] = s[k];
  }
  return out;
}

function prefsEqual(a, b) {
  for (const k of PORTABLE_PREF_KEYS) {
    if ((a?.[k] ?? null) !== (b?.[k] ?? null)) return false;
  }
  return true;
}

export default function App() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { team } = useTeam();
  // PWA update prompt — toast appears when a new SW is downloaded.
  usePWAUpdate();
  // Native + iOS install affordance.
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [activeLibrary, setActiveLibrary] = useState('personal');
  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [tombstones, setTombstones] = useState({ songs: [], setlists: [] });
  const [view, setView] = useState(() => {
    // OAuth / magic-link callbacks land on /auth/callback. Detect that up
    // front so the first render doesn't flash the Welcome screen. Password
    // recovery links land on `/` with `type=recovery` in the fragment — show
    // the RecoveryScreen so the user can set a new password before doing
    // anything else.
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/auth/callback') return 'auth-callback';
      if (/(type=recovery|#access_token=.*type=recovery)/.test(window.location.hash + window.location.search)) return 'recovery';
    }
    return 'loading';
  });
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSetlist, setCurrentSetlist] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState({ state: 'idle', lastSync: null, provider: null });
  const [previewSongId, setPreviewSongId] = useState(null);
  const [previewSetlistId, setPreviewSetlistId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [authStartMode, setAuthStartMode] = useState('signin');
  const [newSongModal, setNewSongModal] = useState(null);
  const [importQueue, setImportQueue] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpenKey, setDrawerOpenKey] = useState(0);
  const openDrawer = () => {
    setDrawerOpenKey(k => k + 1);
    setDrawerOpen(true);
  };
  const [notifTrayOpen, setNotifTrayOpen] = useState(false);
  // Account-wall modal state — surfaced after the user saves their first
  // local item (song or setlist) without being signed in.
  const [accountWallTrigger, setAccountWallTrigger] = useState(null);
  // Founder note — queued by onTransposed, shown when the user lands on
  // the dashboard so it never interrupts the chart they're playing with.
  const [founderNoteQueued, setFounderNoteQueued] = useState(false);
  const [showFounderNote, setShowFounderNote] = useState(false);
  // Settings sub-panel ('hub' | 'appearance' | 'chart' | 'sync' | 'data' | 'about')
  // Lifted to App so it participates in the back-button history stack.
  const [settingsPanel, setSettingsPanel] = useState('hub');
  // Wake-lock explainer is now state-driven (was render-condition-driven) so
  // it can participate in the history stack.
  const [showWakeLockExplainer, setShowWakeLockExplainer] = useState(false);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncEngineRef = useRef(null);
  const historyRef = useRef([]);
  const quotaWarnedRef = useRef(false);
  const prefsHydratedForUserRef = useRef(null);
  const prefsPushTimerRef = useRef(null);
  const isSwitchingLibraryRef = useRef(false);

  // Fallback to personal if team is deleted/left
  useEffect(() => {
    if (activeLibrary !== 'personal' && team && activeLibrary !== team.id) {
      setActiveLibrary('personal');
    } else if (activeLibrary !== 'personal' && !team) {
      setActiveLibrary('personal');
    }
  }, [team, activeLibrary]);

  // Initialize sync engine for the active library
  useEffect(() => {
    if (syncEngineRef.current) {
      syncEngineRef.current.cancelDebounce();
    }
    syncEngineRef.current = createSyncEngine((status) => {
      setSyncState(prev => ({ ...prev, ...status }));
    }, activeLibrary);
  }, [activeLibrary]);

  const triggerSync = useCallback(async () => {
    if (isSwitchingLibraryRef.current) return;
    const state = await getSyncState(activeLibrary);
    const providerId = activeLibrary !== 'personal' ? `supabase-team:${activeLibrary}` : state?.activeProvider;
    if (!providerId) return;
    const result = await syncEngineRef.current.fullSync(songs, setlists, tombstones);
    if (result.changed) {
      setSongs(prev => {
        const next = [...prev];
        for (const id of result.pulledSongIds || []) {
          const pulled = result.songs.find(s => s.id === id);
          if (pulled) {
            const idx = next.findIndex(s => s.id === id);
            if (idx >= 0) next[idx] = pulled;
            else next.push(pulled);
          }
        }
        return next;
      });
      setSetlists(prev => {
        const next = [...prev];
        for (const id of result.pulledSetlistIds || []) {
          const pulled = result.setlists.find(s => s.id === id);
          if (pulled) {
            const idx = next.findIndex(s => s.id === id);
            if (idx >= 0) next[idx] = pulled;
            else next.push(pulled);
          }
        }
        return next;
      });
    }
    if (result.tombstonesChanged) {
      setTombstones(result.tombstones);
    }
    if (result.conflicts?.length > 0) {
      notifyConflicts(result.conflicts);
    }
  }, [songs, setlists, tombstones, activeLibrary]);

  // Subscribe to realtime changes for team libraries
  useTeamRealtime(
    activeLibrary !== 'personal' ? activeLibrary : null,
    triggerSync
  );

  // Load data on mount or when active library changes
  useEffect(() => {
    isSwitchingLibraryRef.current = true;
    let ignore = false;
    
    // Clear stale data immediately to avoid "ghost" content during load
    setSongs([]);
    setSetlists([]);
    setPreviewSongId(null);
    setPreviewSetlistId(null);

    (async () => {
      const savedSongs = await loadSongs(activeLibrary);
      if (ignore) return;
      if (savedSongs.length > 0) {
        setSongs(savedSongs);
      } else if (activeLibrary === 'personal') {
        // First time in personal library — load demo songs
        const demos = DEMO_SONGS_MD.map(md => ({
          ...parseSongMd(md),
          id: generateId(),
        }));
        if (ignore) return;
        setSongs(demos);
        await saveSongs(demos, 'personal');
      } else {
        setSongs([]);
      }

      const savedSetlists = await loadSetlists(activeLibrary);
      if (ignore) return;
      setSetlists(savedSetlists || []);

      const savedTombstones = await loadTombstones(activeLibrary);
      if (ignore) return;
      setTombstones(savedTombstones);

      // Settings remain global, so only load on initial mount
      if (!loaded) {
        const savedSettings = await loadSettings();
        setSettings(savedSettings);

        // Determine initial view based on onboarding state
        const isAuthFlow = view === 'recovery' || view === 'auth-callback';
        if (isAuthFlow) {
          // Keep the current auth view
        } else if (!savedSettings.onboardingComplete && savedSongs.length === 0) {
          setView('onboarding');
        } else if (!savedSettings.onboardingComplete) {
          // Existing user who predates onboarding — skip it, go to home
          savedSettings.onboardingComplete = true;
          setSettings(savedSettings);
          await saveSettings(savedSettings);
          setView('home');
        } else {
          setView('home');
        }

        setLoaded(true);
      }

      // Initialize sync state from storage and trigger initial pull
      const storedSync = await getSyncState(activeLibrary);
      const isTeamLibrary = activeLibrary !== 'personal';
      const providerId = isTeamLibrary ? `supabase-team:${activeLibrary}` : storedSync?.activeProvider;
      
      if (isTeamLibrary && storedSync?.activeProvider !== providerId) {
        // Force the provider state for team libraries
        await setActiveProvider(providerId, { connected: true }, activeLibrary);
      }

      if (providerId) {
        setSyncState({ state: 'idle', lastSync: storedSync?.lastSyncTime, provider: providerId });
        // Pull from cloud on startup — but we need to pass the just-loaded data directly
        // since React state (songs/setlists) hasn't settled yet
        const engine = syncEngineRef.current;
        if (engine) {
          const currentSongs = savedSongs.length > 0 ? savedSongs : [];
          const currentSetlists = savedSetlists || [];
          engine.fullSync(currentSongs, currentSetlists, savedTombstones).then(result => {
            if (result.changed) {
              setSongs(prev => {
                const next = [...prev];
                for (const id of result.pulledSongIds || []) {
                  const pulled = result.songs.find(s => s.id === id);
                  if (pulled) {
                    const idx = next.findIndex(s => s.id === id);
                    if (idx >= 0) next[idx] = pulled;
                    else next.push(pulled);
                  }
                }
                return next;
              });
              setSetlists(prev => {
                const next = [...prev];
                for (const id of result.pulledSetlistIds || []) {
                  const pulled = result.setlists.find(s => s.id === id);
                  if (pulled) {
                    const idx = next.findIndex(s => s.id === id);
                    if (idx >= 0) next[idx] = pulled;
                    else next.push(pulled);
                  }
                }
                return next;
              });
            }
            if (result.tombstonesChanged) {
              setTombstones(result.tombstones);
            }
            if (result.conflicts?.length > 0) {
              notifyConflicts(result.conflicts);
            }
          }).catch(err => console.error('Startup sync failed:', err));
        }
      }
      
      if (!ignore) {
        isSwitchingLibraryRef.current = false;
      }
    })();
    return () => { ignore = true; };
  }, [activeLibrary]);

  // Auto-save when data changes + debounced sync push
  useEffect(() => {
    if (loaded && !isSwitchingLibraryRef.current) {
      saveSongs(songs, activeLibrary);
      syncEngineRef.current?.debouncedPush(songs, setlists, tombstones, setTombstones);
      maybeWarnQuota(quotaWarnedRef);
    }
  }, [songs, loaded, activeLibrary]);
  useEffect(() => {
    if (loaded && !isSwitchingLibraryRef.current) {
      saveSetlists(setlists, activeLibrary);
      syncEngineRef.current?.debouncedPush(songs, setlists, tombstones, setTombstones);
      maybeWarnQuota(quotaWarnedRef);
    }
  }, [setlists, loaded, activeLibrary]);
  useEffect(() => { 
    if (loaded && !isSwitchingLibraryRef.current) saveTombstones(tombstones, activeLibrary); 
  }, [tombstones, loaded, activeLibrary]);
  useEffect(() => { if (loaded && settings) saveSettings(settings); }, [settings, loaded]);

  // Clean up Supabase auth tokens from the URL after magic-link / password
  // reset redirects. detectSessionInUrl consumes the fragment, but the string
  // itself lingers in the address bar until we replaceState.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasAuthHash = window.location.hash && /(access_token|refresh_token|error_description|type=recovery)/.test(window.location.hash);
    const hasAuthQuery = /[?&](code|error_description)=/.test(window.location.search);
    if (!hasAuthHash && !hasAuthQuery) return;
    // Defer so detectSessionInUrl (async) has a chance to consume tokens first.
    const t = setTimeout(() => {
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // Hydrate local settings from the user's cloud preferences on sign-in —
  // once per user id. Cloud is treated as source of truth for the portable
  // subset; device-local fields stay untouched.
  useEffect(() => {
    if (!loaded || !settings || !user?.id || !profile) return;
    if (prefsHydratedForUserRef.current === user.id) return;
    prefsHydratedForUserRef.current = user.id;
    const cloud = profile.preferences;
    if (cloud && typeof cloud === 'object' && Object.keys(cloud).length > 0) {
      setSettings(prev => ({ ...prev, ...cloud }));
    }
  }, [loaded, user?.id, profile, settings]);

  // Forget hydration marker on sign-out so a later sign-in re-hydrates.
  useEffect(() => {
    if (!user?.id) prefsHydratedForUserRef.current = null;
  }, [user?.id]);

  // Push portable preference changes to the cloud (debounced, only after
  // hydration so we don't clobber server state with local defaults).
  useEffect(() => {
    if (!loaded || !settings || !user?.id) return;
    if (prefsHydratedForUserRef.current !== user.id) return;
    const portable = extractPortablePrefs(settings);
    if (prefsEqual(portable, profile?.preferences || {})) return;
    clearTimeout(prefsPushTimerRef.current);
    prefsPushTimerRef.current = setTimeout(() => {
      updateProfile({ preferences: portable }).catch(err => {
        console.warn('[prefs] cloud sync failed:', err?.message || err);
      });
    }, 800);
    return () => clearTimeout(prefsPushTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loaded,
    user?.id,
    settings?.theme,
    settings?.defaultColumns,
    settings?.defaultFontSize,
    settings?.pedalNext,
    settings?.pedalPrev,
    settings?.showInlineNotes,
    settings?.inlineNoteStyle,
    settings?.displayRole,
    settings?.duplicateSections,
    settings?.chartLayout,
    settings?.userName,
  ]);

  // Sync on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && loaded) {
        triggerSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loaded, triggerSync]);

  // Apply theme to document — 'default' follows system preference.
  // Also keeps the active <meta name="theme-color"> in sync so Android's system
  // bars (status bar + navigation pill) tint to match the current theme.
  useEffect(() => {
    if (!settings) return;
    const theme = settings.theme;

    const setThemeColor = (mode) => {
      const color = mode === 'light' ? '#ffffff' : '#14161e';
      // Remove the media-scoped tags so the single active tag wins everywhere.
      document.querySelectorAll('meta[name="theme-color"][media]').forEach(m => m.remove());
      let tag = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'theme-color');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', color);
    };

    if (theme === 'default') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => {
        const mode = mq.matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', mode);
        setThemeColor(mode);
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    document.documentElement.setAttribute('data-theme', theme);
    setThemeColor(theme);
  }, [settings?.theme]);

  // Snapshot of every state field that participates in back/forward.
  // Centralised so navigate / goToMainView / goSettingsPanel / openModal all
  // push the same shape — keeps goBack able to restore any prior screen.
  const snapshot = () => ({
    view,
    song: currentSong,
    setlist: currentSetlist,
    settingsPanel,
    accountWall: accountWallTrigger,
    founderNote: showFounderNote,
    iosHint: showIOSHint,
    wakeLockExplainer: showWakeLockExplainer,
    isFullscreen,
  });

  const pushHistory = (snap) => {
    historyRef.current.push(snap);
    window.history.pushState(null, '');
  };

  // Navigation with history stack. Not memoised — captures current state
  // through snapshot() on each call, which is what we want for back/forward.
  const navigate = (nextView, { song, setlist, replace } = {}) => {
    if (!replace) pushHistory(snapshot());
    if (song !== undefined) setCurrentSong(song);
    if (setlist !== undefined) setCurrentSetlist(setlist);
    setView(nextView);
    // Entering Settings fresh always lands on the hub.
    if (nextView === 'settings') setSettingsPanel('hub');
  };

  const goBack = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) {
      setView(prev.view);
      setCurrentSong(prev.song);
      setCurrentSetlist(prev.setlist);
      if (prev.settingsPanel !== undefined) setSettingsPanel(prev.settingsPanel);
      setAccountWallTrigger(prev.accountWall ?? null);
      setShowFounderNote(!!prev.founderNote);
      setShowIOSHint(!!prev.iosHint);
      setShowWakeLockExplainer(!!prev.wakeLockExplainer);
      if (typeof prev.isFullscreen === 'boolean') setIsFullscreen(prev.isFullscreen);
    } else {
      setView('home');
      setCurrentSong(null);
      setCurrentSetlist(null);
      setSettingsPanel('hub');
      setAccountWallTrigger(null);
      setShowFounderNote(false);
      setShowIOSHint(false);
      setShowWakeLockExplainer(false);
      setIsFullscreen(false);
    }
  }, []);

  // Browser back button support — single popstate handler for the whole app.
  // Anything that's allowed to be backed-out-of must have pushed onto
  // historyRef during its open call (see openModal / pushHistory above).
  useEffect(() => {
    const handler = (e) => {
      if (historyRef.current.length > 0) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [goBack]);

  // Auto-fire: founder note when the user lands on the dashboard with a
  // queued note. openFounderNote pushes history so back closes it.
  useEffect(() => {
    if (founderNoteQueued && view === 'home' && !showFounderNote && !settings?.seenFounderNote) {
      openFounderNote();
    }
  }, [founderNoteQueued, view, showFounderNote, settings?.seenFounderNote]);

  // Auto-fire: iOS Add-to-Home-Screen explainer once after onboarding on
  // iOS Safari. iOS never fires beforeinstallprompt so we always need a
  // custom UI affordance.
  useEffect(() => {
    if (
      isIOS && !isStandalone &&
      view === 'home' &&
      settings?.onboardingComplete &&
      !settings?.seenIOSInstallHint &&
      !showIOSHint
    ) {
      openIOSHint();
    }
  }, [isIOS, isStandalone, view, settings?.onboardingComplete, settings?.seenIOSInstallHint, showIOSHint]);

  // Auto-fire: wake-lock explainer the first time the user enters a stage
  // view. The hook itself acquires silently — this just tells them why.
  useEffect(() => {
    if (
      (view === 'setlist-performance' || view === 'setlist-play') &&
      !settings?.seenWakeLockExplainer &&
      !showWakeLockExplainer
    ) {
      openWakeLockExplainer();
    }
  }, [view, settings?.seenWakeLockExplainer, showWakeLockExplainer]);

  // Switch a top-level page (Home / Library / Setlists / Settings / Account /
  // Help / Design). Now pushes history so hardware Back navigates within the
  // app instead of exiting the PWA.
  const goToMainView = (viewName) => {
    if (view === viewName) return;
    pushHistory(snapshot());
    const apply = () => {
      setView(viewName);
      setCurrentSong(null);
      setCurrentSetlist(null);
      setIsFullscreen(false);
      if (viewName === 'settings') setSettingsPanel('hub');
    };
    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

  // Drill into a Settings sub-panel ('appearance', 'chart', etc.) — pushes
  // history so the in-app and hardware back both return to the hub.
  const goSettingsPanel = (nextPanel) => {
    if (nextPanel === settingsPanel) return;
    pushHistory(snapshot());
    setSettingsPanel(nextPanel);
  };

  // Modal openers — each one pushes history first so hardware Back closes
  // the modal instead of bypassing it. Modal close handlers call
  // window.history.back() which triggers popstate → goBack → modal hides.
  const openAccountWall = (trigger) => {
    pushHistory(snapshot());
    setAccountWallTrigger(trigger);
  };
  const openFounderNote = () => {
    if (showFounderNote) return;
    pushHistory(snapshot());
    setShowFounderNote(true);
  };
  const openIOSHint = () => {
    if (showIOSHint) return;
    pushHistory(snapshot());
    setShowIOSHint(true);
  };
  const openWakeLockExplainer = () => {
    if (showWakeLockExplainer) return;
    pushHistory(snapshot());
    setShowWakeLockExplainer(true);
  };
  // All modal close paths route through window.history.back() — this keeps
  // the browser history aligned whether the user tapped X, the primary CTA,
  // or the hardware Back button.
  const dismissTopModal = () => {
    if (typeof window !== 'undefined') window.history.back();
  };

  const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

  // Notification system
  const hasUnreadNotifications = settings?.notifications?.some(n => !n.read) ?? false;

  const handleMarkNotificationRead = useCallback((notifId) => {
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.id === notifId ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const handleNotificationAction = (action) => {
    if (action?.type === 'navigate') {
      navigate(action.view);
    }
  };

  // Navigation shortcuts
  const goLibrary = () => goToMainView('library');
  const goSetlists = () => goToMainView('setlists');
  const goChart = (song) => {
    if (!settings?.firstSongOpened) {
      setSettings(prev => ({ ...prev, firstSongOpened: true }));
    }
    navigate('chart', { song });
  };
  const goEditor = (song = null) => navigate('editor', { song });
  const goSetlistBuild = (sl = null) => navigate('setlist-build', { setlist: sl });
  const goSetlistView = (sl) => navigate('setlist-view', { setlist: sl });
  const goSetlistPlay = (sl) => navigate('setlist-play', { setlist: sl });
  const goSetlistPerformance = (sl) => {
    if (!settings?.firstStageMode) {
      setSettings(prev => ({ ...prev, firstStageMode: true }));
    }
    navigate('setlist-performance', { setlist: sl });
  };
  const goSetlistPractice = (sl) => navigate('setlist-practice', { setlist: sl });
  const goTeam = () => goToMainView('team');
  const goSchedule = () => navigate('schedule');

  // Song CRUD
  const handleSaveSong = (song) => {
    const stamped = { ...song, updatedAt: Date.now() };
    let isNew = false;
    setSongs(prev => {
      const idx = prev.findIndex(s => s.id === song.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = stamped; return n; }
      isNew = true;
      return [...prev, stamped];
    });
    if (isNew && !settings?.firstSongAdded) {
      setSettings(prev => ({ ...prev, firstSongAdded: true }));
    }

    // If the user entered the editor via "chart → Edit" (existing song),
    // pop that stale chart snapshot so back from the just-saved chart
    // lands on the list. New-song flows have the list directly under
    // the editor; popping there would erase it and break back navigation.
    const top = historyRef.current[historyRef.current.length - 1];
    if (top?.view === 'chart' && top?.song?.id === song.id) {
      historyRef.current.pop();
    }

    // Multi-file import queue: advance to the next song in the editor
    // instead of jumping to chart view, so the user reviews/edits each.
    if (importQueue && importQueue.remaining.length > 1) {
      const next = importQueue.remaining.slice(1);
      setImportQueue({ ...importQueue, remaining: next });
      navigate('editor', { song: next[0], replace: true });
      return;
    }
    if (importQueue) {
      setImportQueue(null);
      toast({ title: 'Import complete' });
      // Reaching library at the end of a multi-import is functionally a
      // top-level destination; reset history so back from here behaves
      // like back from any tab.
      goToMainView('library');
      return;
    }

    navigate('chart', { song, replace: true });
    if (isNew && !user && !settings?.seenSaveAccountWall) {
      openAccountWall({ kind: 'song', title: song.title || 'Untitled song' });
    }
  };

  const handleSkipQueueSong = () => {
    if (!importQueue) { goBack(); return; }
    if (importQueue.remaining.length > 1) {
      const next = importQueue.remaining.slice(1);
      setImportQueue({ ...importQueue, remaining: next });
      navigate('editor', { song: next[0], replace: true });
      return;
    }
    setImportQueue(null);
    goToMainView('library');
  };

  const handleMoveSongToLibrary = async (songId, targetLibraryId) => {
    try {
      const song = songs.find(s => s.id === songId);
      if (!song) return;

      // Remove from current library
      const nextSongs = songs.filter(s => s.id !== songId);
      setSongs(nextSongs);
      await saveSongs(nextSongs, activeLibrary);
      // Generate a tombstone so other devices drop it from the old library
      const nextTs = {
        ...tombstones,
        songs: [...tombstones.songs, { id: song.id, deletedAt: Date.now() }],
      };
      setTombstones(nextTs);
      await saveTombstones(nextTs, activeLibrary);
      syncEngineRef.current?.debouncedPush(nextSongs, setlists, nextTs, setTombstones);

      // Add to target library
      const targetSongs = await loadSongs(targetLibraryId);
      // Clean up its old ID if it exists in the new library to avoid duplicates
      const filteredTargetSongs = targetSongs.filter(s => s.id !== song.id);
      filteredTargetSongs.push(song);
      await saveSongs(filteredTargetSongs, targetLibraryId);

      // Trigger a background sync on the target library so the cloud gets the file
      if (syncEngineRef.current) {
        // We can instantiate a temporary engine just to push to the target library
        const tempEngine = createSyncEngine(() => {}, targetLibraryId);
        // We need the tombstones of the target library to pass to push
        const targetTombstones = await loadTombstones(targetLibraryId);
        const targetSetlists = await loadSetlists(targetLibraryId);
        tempEngine.debouncedPush(filteredTargetSongs, targetSetlists, targetTombstones, () => {});
      }

      toast({
        title: 'Song moved',
        description: `Successfully moved to ${targetLibraryId === 'personal' ? 'Personal' : 'Team'} library.`,
      });
      setView('library');
    } catch (err) {
      console.error(err);
      toast({ title: 'Move failed', variant: 'error' });
    }
  };

  const handleDeleteSong = (id) => {
    const nextSongs = songs.filter((s) => s.id !== id);
    setSongs(nextSongs);
    setTombstones(prev => ({
      ...prev,
      songs: [...prev.songs.filter(t => t.id !== id), { id, deletedAt: Date.now() }],
    }));
    // If the entry below the editor is a chart of the deleted song, pop it
    // so we don't try to view a tombstoned song after goBack. Otherwise the
    // editor was opened directly from a list and goBack alone is correct.
    const top = historyRef.current[historyRef.current.length - 1];
    if (top?.view === 'chart' && top?.song?.id === id) {
      historyRef.current.pop();
    }
    goBack();
  };

  const handleSmartImport = (mdText) => {
    try {
      const song = { ...parseSongMd(mdText), id: generateId(), updatedAt: Date.now() };
      setSongs(prev => [...prev, song]);
      setNewSongModal(null);
      navigate('editor', { song });
    } catch {
      toast({ title: 'Import failed', description: 'Could not parse converted chord sheet.', variant: 'error' });
    }
  };

  const handleImportParsedSongs = (parsedSongs) => {
    if (!parsedSongs || parsedSongs.length === 0) return;
    setNewSongModal(null);
    if (parsedSongs.length === 1) {
      navigate('editor', { song: parsedSongs[0] });
      return;
    }
    // Queue the songs as drafts — each one only persists when the user
    // hits Save in the editor; Skip drops it without writing to the library.
    setImportQueue({ remaining: parsedSongs, total: parsedSongs.length });
    navigate('editor', { song: parsedSongs[0] });
  };

  const handleImportSetlistFile = async (file) => {
    setNewSongModal(null);
    await handleImportSetlist(file);
  };

  const openNewSongModal = (initialTab = 'import') => {
    setNewSongModal({ initialTab });
  };

  // Setlist CRUD
  const handleSaveSetlist = (sl) => {
    let isNew = false;
    setSetlists(prev => {
      const idx = prev.findIndex(s => s.id === sl.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = sl; return n; }
      isNew = true;
      return [...prev, sl];
    });
    if (!settings?.firstSetlistBuilt) {
      setSettings(prev => ({ ...prev, firstSetlistBuilt: true }));
    }
    goBack();
    if (isNew && !user && !settings?.seenSaveAccountWall) {
      openAccountWall({ kind: 'setlist', title: sl.name || 'Untitled setlist' });
    }
  };

  const handleUpdateSong = useCallback((updatedSong) => {
    setSongs(prev => {
      const i = prev.findIndex(s => s.id === updatedSong.id);
      if (i < 0) return prev;
      const next = [...prev];
      next[i] = { ...updatedSong, updatedAt: Date.now() };
      return next;
    });
  }, []);

  const handleUpdateSetlist = useCallback((updatedSetlist) => {
    setSetlists(prev => {
      const i = prev.findIndex(s => s.id === updatedSetlist.id);
      if (i < 0) return prev;
      const next = [...prev];
      next[i] = updatedSetlist;
      return next;
    });
  }, []);

  const handleDeleteSetlist = (id) => {
    setSetlists(prev => prev.filter(s => s.id !== id));
    setTombstones(prev => ({
      ...prev,
      setlists: [...prev.setlists.filter(t => t.id !== id), { id, deletedAt: Date.now() }],
    }));
    // If the entry below is the overview of the deleted setlist, pop it so
    // we don't land on an orphaned overview after goBack. Otherwise (e.g.
    // delete invoked from the overview itself with the list directly below)
    // a single goBack is correct.
    const top = historyRef.current[historyRef.current.length - 1];
    if (top?.view === 'setlist-view' && top?.setlist?.id === id) {
      historyRef.current.pop();
    }
    goBack();
  };

  const handleClearAll = async () => {
    await clearAll();
    setSongs([]);
    setSetlists([]);
    setTombstones({ songs: [], setlists: [] });
    historyRef.current = [];
    setView('home');
  };

  // Setlist export/import
  const handleExportSetlist = async (sl) => {
    const blob = await exportSetlistZip(sl, songs);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slugify(sl.name || 'setlist') + '.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSetlistPdf = (sl) => {
    exportSetlistPdf(sl, songs);
  };

  const handleImportSetlist = async (file) => {
    try {
      const { setlist, newSongs } = await importSetlistZip(file, songs);
      if (newSongs.length > 0) {
        setSongs(prev => [...prev, ...newSongs]);
      }
      setSetlists(prev => [...prev, setlist]);
      const description = newSongs.length > 0
        ? `Added ${newSongs.length} new song${newSongs.length > 1 ? 's' : ''} to your library.`
        : 'All songs were already in your library.';
      toast({ title: `Imported "${setlist.name}"`, description });
    } catch {
      toast({ title: 'Import failed', description: 'Could not read setlist zip.', variant: 'error' });
    }
  };

  if (view === 'auth-callback') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[var(--ds-background-100)]" />}>
          <AuthCallback onDone={() => goToMainView('home')} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (view === 'recovery') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[var(--ds-background-100)]" />}>
          <RecoveryScreen
            onBack={() => goToMainView('home')}
            onDone={() => goToMainView('home')}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--ds-background-200)] flex items-center justify-center">
        <div className="text-copy-14 text-[var(--text-2)]">
          Loading Setlists MD...
        </div>
      </div>
    );
  }

  const lazyFallback = (
    <div className="min-h-screen bg-[var(--ds-background-200)] flex items-center justify-center">
      <div className="text-copy-14 text-[var(--text-2)]">Loading…</div>
    </div>
  );

  const isSignedIn = !!user;
  const displayName = profile?.display_name || settings?.userName || 'Guest';
  const displayEmail = user?.email || 'guest@setlists.md';
  const plan = profile?.plan
    ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)
    : 'Free';
  const handleSignOut = async () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm('Sign out? Your songs and setlists stay on this device.');
      if (!ok) return;
    }
    try {
      await signOut();
      toast({ title: 'Signed out' });
      goToMainView('home');
    } catch (err) {
      toast({ title: 'Sign-out failed', description: err.message, variant: 'error' });
    }
  };

  return (
    <ErrorBoundary>
    <Suspense fallback={lazyFallback}>
      <Toaster />
      {view === 'signin' && (
        <AuthScreen onBack={goBack} onSignedIn={() => goToMainView('home')} defaultMode={authStartMode} />
      )}
      {view === 'upgrade' && (
        <PricingScreen
          onBack={goBack}
          settings={settings}
          onSignIn={() => {
            setAuthStartMode('signup');
            navigate('signin');
          }}
        />
      )}
      {view === 'onboarding' && (
        <div style={{ height: '100dvh', overflowY: 'auto', overflowX: 'hidden' }}>
        <OnboardingFlow
          onComplete={(quiz) => {
            // Inject demos if not already present (covers the first-run path).
            setSongs(prev => {
              if (prev.length > 0) return prev;
              const demos = DEMO_SONGS_MD.map(md => ({
                ...parseSongMd(md),
                id: generateId(),
              }));
              saveSongs(demos);
              return demos;
            });
            setSettings(prev => ({
              ...prev,
              ...quiz,
              onboardingComplete: true,
            }));
            setView('home');
          }}
          onSignIn={() => {
            setSettings(prev => ({ ...prev, onboardingComplete: true }));
            setAuthStartMode('signin');
            setView('signin');
          }}
        />
        </div>
      )}
      {view === 'recovery' && (
        <RecoveryScreen
          onBack={() => setView('signin')}
          onDone={() => setView('home')}
        />
      )}
      {!['onboarding', 'signin', 'upgrade', 'recovery'].includes(view) && (
        <DesktopLayout 
          activeView={view === 'setlist-view' ? 'setlists' : view === 'design' ? 'settings' : view === 'schedule' ? 'home' : view}
          onNavigate={goToMainView} 
          isFullscreen={view === 'setlist-performance' || view === 'setlist-play' || view === 'setlist-practice' || (isFullscreen && (view === 'library' || view === 'setlists'))}
          hideBanner={view === 'setlist-performance' || view === 'setlist-play' || view === 'setlist-practice'}
          hasUnreadNotifications={hasUnreadNotifications} 
          notifications={settings?.notifications || []} 
          onMarkRead={handleMarkNotificationRead} 
          onNotificationAction={handleNotificationAction} 
          drawerOpen={drawerOpen} 
          displayName={displayName} 
          plan={plan} 
          activeLibrary={activeLibrary} 
          setActiveLibrary={setActiveLibrary} 
          team={team} 
          onChangeWorkspace={goTeam}
          syncState={syncState}
          isOnline={isOnline}
          hideBottomSpacer={!['home', 'library', 'setlists', 'settings', 'account', 'setlist-view'].includes(view)}
        >
          {['home', 'library', 'setlists'].includes(view) && (
            <MobileTopBar
              key={view}
              view={view}
              songs={songs}
              setlists={setlists}
              onOpenDrawer={openDrawer}
              onSelectSong={goChart}
              onSelectSetlist={goSetlistView}
              onNewSong={() => openNewSongModal('import')}
              onNewSetlist={() => goSetlistBuild()}
              activeLibrary={activeLibrary}
              team={team}
              onChangeWorkspace={openDrawer}
            />
          )}
          {view === 'home' && (
            <Dashboard
              songs={songs}
              setlists={setlists}
              settings={settings}
              onSelectSong={goChart}
              onNewSong={() => openNewSongModal('import')}
              onNewSetlist={() => goSetlistBuild()}
              onViewSetlist={goSetlistView}
              onPlaySetlist={goSetlistPerformance}
              onGoLibrary={goLibrary}
              onGoSetlists={goSetlists}
              onOpenSchedule={goSchedule}
              hasCloud={!!syncState?.provider}
              checklistActions={{
                openFirstSong: () => {
                  const song = songs.find(s => s.title === 'Amazing Grace') || songs[0];
                  if (song) goChart(song);
                },
                newSong: () => openNewSongModal('import'),
                newSetlist: () => goSetlistBuild(),
                signIn: () => { setAuthStartMode('signin'); navigate('signin'); },
              }}
              onDismissChecklist={() => setSettings(prev => ({ ...prev, checklistDismissed: true }))}
            />
          )}
          {view === 'library' && (
            <Library
              songs={songs}
              loaded={loaded}
              onSelectSong={goChart}
              onNewSong={() => openNewSongModal('import')}
              previewSongId={previewSongId}
              onSelectPreview={setPreviewSongId}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onEditSong={(s) => goEditor(s)}
              chartDefaults={{
                defaultColumns: settings?.defaultColumns,
                defaultFontSize: settings?.defaultFontSize,
                showInlineNotes: settings?.showInlineNotes !== false,
                inlineNoteStyle: settings?.inlineNoteStyle || 'dashes',
                displayRole: settings?.displayRole || 'leader',
                duplicateSections: settings?.duplicateSections || 'full',
                chartLayout: settings?.chartLayout || 'columns',
              }}
            />
          )}
          {view === 'setlists' && (
            <Setlists
              songs={songs}
              setlists={setlists}
              loaded={loaded}
              onViewSetlist={goSetlistView}
              onPlaySetlist={goSetlistPerformance}
              onPracticeSetlist={(sl) => goSetlistPractice(sl)}
              onNewSetlist={() => goSetlistBuild()}
              onImportSetlist={handleImportSetlist}
              previewSetlistId={previewSetlistId}
              onSelectPreview={setPreviewSetlistId}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onEditSetlist={(sl) => goSetlistBuild(sl)}
              onExportSetlistZip={(sl) => handleExportSetlist(sl)}
              onExportSetlistPdfOverview={(sl) => exportSetlistPdf(sl, songs, { mode: 'overview' })}
              onExportSetlistPdfFull={(sl) => exportSetlistPdf(sl, songs, { mode: 'full' })}
              onDeleteSetlist={(id) => {
                setSetlists(prev => prev.filter(s => s.id !== id));
                setTombstones(prev => ({
                  ...prev,
                  setlists: [...prev.setlists.filter(t => t.id !== id), { id, deletedAt: Date.now() }],
                }));
                setPreviewSetlistId(null);
              }}
            />
          )}
          {view === 'chart' && currentSong && (
            <ErrorBoundary>
            <ChartView
              song={currentSong}
              onBack={goBack}
              onEdit={() => goEditor(currentSong)}
              defaultColumns={settings?.defaultColumns}
              defaultFontSize={settings?.defaultFontSize}
              showInlineNotes={settings?.showInlineNotes !== false}
              inlineNoteStyle={settings?.inlineNoteStyle || 'dashes'}
              displayRole={settings?.displayRole || 'leader'}
              duplicateSections={settings?.duplicateSections || 'full'}
              chartLayout={settings?.chartLayout || 'columns'}
              onTransposed={() => {
                if (!settings?.firstTransposed) {
                  setSettings(prev => ({ ...prev, firstTransposed: true }));
                }
                // Queue the founder note — surfaced the next time we land
                // on the dashboard so it never interrupts the chart itself.
                if (!settings?.seenFounderNote) {
                  setFounderNoteQueued(true);
                }
              }}
            />
            </ErrorBoundary>
          )}
          {view === 'editor' && (
            <Editor
              key={currentSong?.id || 'new'}
              song={currentSong}
              onSave={handleSaveSong}
              onBack={importQueue ? handleSkipQueueSong : goBack}
              onDelete={currentSong ? handleDeleteSong : null}
              importProgress={importQueue ? {
                current: importQueue.total - importQueue.remaining.length + 1,
                total: importQueue.total,
                onSkip: handleSkipQueueSong,
              } : null}
              onMove={currentSong && team ? (target) => handleMoveSongToLibrary(currentSong.id, target) : null}
              activeLibrary={activeLibrary}
              team={team}
            />
          )}
          {view === 'setlist-view' && currentSetlist && (
            <SetlistOverview
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
              onEdit={() => goSetlistBuild(currentSetlist)}
              onExportZip={() => handleExportSetlist(currentSetlist)}
              onExportPdfOverview={() => exportSetlistPdf(currentSetlist, songs, { mode: 'overview' })}
              onExportPdfFull={() => exportSetlistPdf(currentSetlist, songs, { mode: 'full' })}
              onPlay={() => goSetlistPerformance(currentSetlist)}
              onPractice={() => goSetlistPractice(currentSetlist)}
              onDelete={() => handleDeleteSetlist(currentSetlist.id)}
            />
          )}
          {view === 'setlist-build' && (
            <SetlistBuilder
              songs={songs}
              setlist={currentSetlist}
              onSave={handleSaveSetlist}
              onBack={goBack}
              onDelete={currentSetlist ? handleDeleteSetlist : null}
              isTeamContext={activeLibrary !== 'personal'}
            />
          )}
          {view === 'setlist-play' && currentSetlist && (
            <SetlistPlayer
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
              defaultColumns={settings?.defaultColumns}
              defaultFontSize={settings?.defaultFontSize}
              showInlineNotes={settings?.showInlineNotes !== false}
              inlineNoteStyle={settings?.inlineNoteStyle || 'dashes'}
              displayRole={settings?.displayRole || 'leader'}
              duplicateSections={settings?.duplicateSections || 'full'}
            />
          )}
          {view === 'setlist-performance' && currentSetlist && (
            <PerformanceView
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
            />
          )}
          {view === 'setlist-practice' && currentSetlist && (
            <PracticeView
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
              onUpdateSong={handleUpdateSong}
              onUpdateSetlist={handleUpdateSetlist}
            />
          )}
          {view === "design" && (
            <LydianShowcase onBack={goBack} />
          )}
          {view === "help" && (
            <HelpPage
              onBack={goBack}
              onMarkSeen={() => {
                if (!settings?.notifications) return;
                const updated = settings.notifications.map(n => ({ ...n, read: true }));
                setSettings(prev => ({ ...prev, notifications: updated, helpPageSeen: true }));
              }}
            />
          )}
          {view === "settings" && settings && (
            <Settings
              settings={settings}
              onUpdate={setSettings}
              onBack={goBack}
              panel={settingsPanel}
              onChangePanel={goSettingsPanel}
              onClearAll={handleClearAll}
              onDownloadSongs={() => {
                songs.forEach(s => {
                  const md = songToMd(s);
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = slugify(s.title) + '.md';
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
              songCount={songs.length}
              setlistCount={setlists.length}
              syncState={syncState}
              onSyncStateChange={setSyncState}
              onSyncNow={triggerSync}
              onRequestSignIn={() => { setAuthStartMode('signin'); navigate('signin'); }}
              isSignedIn={isSignedIn}
              displayName={displayName}
              activeLibrary={activeLibrary}
              team={team}
            />
          )}
          {view === "account" && settings && (
            <Account
              settings={settings}
              onUpdate={setSettings}
              isSignedIn={isSignedIn}
              displayName={displayName}
              displayEmail={displayEmail}
              plan={plan}
              songCount={songs.length}
              setlistCount={setlists.length}
              onUpgrade={() => navigate('upgrade')}
              onSignIn={() => { setAuthStartMode('signin'); navigate('signin'); }}
              onCreateAccount={() => { setAuthStartMode('signup'); navigate('signin'); }}
              onSignOut={handleSignOut}
            />
          )}
          {view === 'team' && (
            <TeamScreen
              onBack={goBack}
              onUpgrade={() => navigate('pricing')}
              onSwitchLibrary={setActiveLibrary}
            />
          )}
          {view === 'schedule' && (
            <Schedule
              setlists={setlists}
              onBack={goBack}
              onOpenSetlist={goSetlistView}
            />
          )}
          {['home', 'library', 'setlists', 'settings', 'account', 'team', 'setlist-view'].includes(view) && (
            <BottomNav
              activeView={view === 'setlist-view' ? 'setlists' : view}
              onNavigate={goToMainView}
            />
          )}
        </DesktopLayout>
      )}
      {!['onboarding', 'signin', 'upgrade', 'recovery'].includes(view) && ['home', 'library', 'setlists'].includes(view) && !drawerOpen && (
        <EdgeSwipeHotspot onOpen={openDrawer} />
      )}
      {!['onboarding', 'signin', 'upgrade', 'recovery'].includes(view) && (
        <MobileDrawer
          open={drawerOpen}
          openKey={drawerOpenKey}
          onClose={() => setDrawerOpen(false)}
          userName={displayName}
          email={displayEmail}
          plan={plan}
          isSignedIn={isSignedIn}
          songCount={songs.length}
          setlistCount={setlists.length}
          hasUnreadNotifications={hasUnreadNotifications}
          onOpenSettings={() => { setDrawerOpen(false); goToMainView('settings'); }}
          onOpenNotifications={() => { setDrawerOpen(false); setNotifTrayOpen(true); }}
          onOpenHelp={() => { setDrawerOpen(false); navigate('help'); }}
          onSignOut={async () => { setDrawerOpen(false); await handleSignOut(); }}
          onUpgrade={() => { setDrawerOpen(false); navigate('upgrade'); }}
          onSignIn={() => { setDrawerOpen(false); setAuthStartMode('signin'); navigate('signin'); }}
          onCreateAccount={() => { setDrawerOpen(false); setAuthStartMode('signup'); navigate('signin'); }}
          onOpenTeam={() => { setDrawerOpen(false); goTeam(); }}
          team={team}
          activeLibrary={activeLibrary}
          setActiveLibrary={setActiveLibrary}
          canInstall={canInstall}
          isIOS={isIOS}
          isStandalone={isStandalone}
          onInstall={async () => {
            setDrawerOpen(false);
            if (isIOS) {
              openIOSHint();
            } else if (canInstall) {
              await promptInstall();
            }
          }}
        />
      )}
      {!['onboarding', 'signin', 'upgrade', 'recovery'].includes(view) && (
        <NotificationTray
          open={notifTrayOpen}
          onClose={() => setNotifTrayOpen(false)}
          notifications={settings?.notifications || []}
          onMarkRead={handleMarkNotificationRead}
          onAction={(action) => {
            setNotifTrayOpen(false);
            handleNotificationAction?.(action);
          }}
        />
      )}
      {newSongModal && (
        <Suspense fallback={null}>
          <NewSongModal
            initialTab={newSongModal.initialTab}
            onClose={() => setNewSongModal(null)}
            onStartBlank={() => { setNewSongModal(null); goEditor(); }}
            onImportSongs={handleImportParsedSongs}
            onImportSetlistFile={handleImportSetlistFile}
            onSmartImport={handleSmartImport}
          />
        </Suspense>
      )}
      {!['onboarding', 'signin', 'upgrade', 'recovery'].includes(view) && <FeedbackButton />}

      {/* One-time pre-permission explainer for stage mode — render is
          state-driven now so the modal participates in the back stack. */}
      {showWakeLockExplainer && (
        <WakeLockExplainer
          onContinue={() => {
            setSettings(prev => ({ ...prev, seenWakeLockExplainer: true }));
            dismissTopModal();
          }}
        />
      )}

      {/* Account wall — fired by handleSaveSong / handleSaveSetlist on
          first NEW save when the user is not signed in. All three actions
          go through dismissTopModal so the back stack stays clean. */}
      {accountWallTrigger && (
        <AccountWall
          kind={accountWallTrigger.kind}
          savedItemTitle={accountWallTrigger.title}
          onSaveLocal={() => {
            setSettings(prev => ({ ...prev, seenSaveAccountWall: true }));
            dismissTopModal();
          }}
          onSignIn={() => {
            setSettings(prev => ({ ...prev, seenSaveAccountWall: true }));
            dismissTopModal();
            navigate('upgrade');
          }}
          onSkip={() => {
            setSettings(prev => ({ ...prev, seenSaveAccountWall: true }));
            dismissTopModal();
          }}
        />
      )}

      {/* Founder note — surfaced on the dashboard once after the user has
          transposed their first chart (the engagement signal). */}
      {showFounderNote && (
        <FounderNote
          onClose={() => {
            setSettings(prev => ({ ...prev, seenFounderNote: true }));
            setFounderNoteQueued(false);
            dismissTopModal();
          }}
        />
      )}

      {/* iOS Add-to-Home-Screen explainer — shown once on iOS Safari. */}
      {showIOSHint && (
        <IOSInstallHint
          onClose={() => {
            setSettings(prev => ({ ...prev, seenIOSInstallHint: true }));
            dismissTopModal();
          }}
        />
      )}
    </Suspense>
    </ErrorBoundary>
  );
}

// Fixed strip on the left edge of mobile viewport — captures a swipe-right
// gesture to open the drawer. Rendered only on main tabs while drawer is closed.
function EdgeSwipeHotspot({ onOpen }) {
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
    firedRef.current = false;
  };
  const onTouchMove = (e) => {
    if (firedRef.current || !startRef.current) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startRef.current.x;
    const dy = Math.abs(t.clientY - startRef.current.y);
    if (dx > 40 && dy < 30) {
      firedRef.current = true;
      onOpen();
    }
  };
  const reset = () => { startRef.current = null; };

  return (
    <div
      aria-hidden="true"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={reset}
      onTouchCancel={reset}
      className="fixed top-0 left-0 z-[150] sm:hidden"
      style={{
        width: '24px',
        height: '100dvh',
        // Keep the strip transparent but touch-reachable
        background: 'transparent',
        touchAction: 'pan-y',
      }}
    />
  );
}

