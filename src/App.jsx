import { Toaster } from "./components/ui/Toaster";
import { toast } from "./components/ui/use-toast";
import { useConfirm } from "./components/ui/useConfirmHook";
import OfflineBanner from "./components/ui/OfflineBanner";
import WorkspacePickerDialog from "./components/ui/WorkspacePickerDialog";
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { parseSongMd, songToMd, generateId } from './parser';
import { loadSongs, saveSongs, loadSetlists, saveSetlists, loadSettings, saveSettings, loadTombstones, saveTombstones, getStorageEstimate, clearAll } from './storage';
import { shareTokenFromUrl } from './share/setlistShare';
import { withArrangement, songFromFlat } from './arrangements';
import { computeKeyHistories, applyKeyHistories, incrementForSetlistDiff } from './keyHistory';
import { DEMO_SONGS_MD } from './data/demos';
import { createSyncEngine } from './sync/engine';
import { createTeamSyncEngine } from './sync/team-engine';
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
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './auth/useAuth';
import { useTeam } from './auth/useTeam';
import { exportSetlistZip, importSetlistZip, slugify } from './setlist-io';
import { exportSetlistPdf } from './pdf/exportSetlistPdf';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useTeamRealtime } from './hooks/useTeamRealtime';
import { useChartTheme } from './hooks/useChartTheme';
import { useTeamSchedules } from './hooks/useTeamSchedules';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { BILLING_ENABLED, SUPPORT_CONTACT } from './billing/checkout';

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
const SharedSetlistViewer = lazy(() => import('./components/SharedSetlistViewer'));
const PerformanceView = lazy(() => import('./components/PerformanceView'));
const PracticeView = lazy(() => import('./components/PracticeView'));
const LegalPage = lazy(() => import('./components/LegalPage'));
const GoogleDriveCallback = lazy(() => import('./components/auth/GoogleDriveCallback'));
const PracticeFinale = lazy(() => import('./components/PracticeFinale'));
const LiveFinale = lazy(() => import('./components/LiveFinale'));
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
  'chordFontSize',
  'nashville',
  'showChords',
  'showDiagrams',
  'pedalNext',
  'pedalPrev',
  'showInlineNotes',
  'inlineNoteStyle',
  'displayRole',
  'duplicateSections',
  'chartLayout',
  'chartTheme',
  'chartBg',
  'chartText',
  'chartChordColor',
  'chartChordFont',
  'chartLyricFont',
  'sectionColors',
  'sectionLabels',
  'customSectionTypes',
  'customChartThemes',
  'accentColor',
  'stageMode',
  'lyricLineHeight',
  'sectionSpacing',
  'firstDayOfWeek',
  'clockFormat',
  'userName',
  'lastChangelogVersion',
  'performanceRail',
  'navStyle',
  'displayMode',
  'autoHideHeader',
  'defaultSpaceId',
  'tabSubdivision',
  'tabSize',
  'tabStringColor',
  'tabNumberColor',
  'tabBg',
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

// Team libraries sync directly against the Supabase tables
// (server-authoritative team engine); the file-manifest engine remains for
// the personal library's Drive/Dropbox/OneDrive providers.
function createEngineForLibrary(libraryId, onStatusChange, opts = {}) {
  return libraryId !== 'personal'
    ? createTeamSyncEngine(onStatusChange, libraryId, opts)
    : createSyncEngine(onStatusChange, libraryId, opts);
}

export default function App() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { team, teams, setActiveTeam, isAdmin, isEditor, hasTeamPlan, atWorkspaceLimit, loading: teamLoading } = useTeam();
  const { schedules, updateSchedule } = useTeamSchedules(team?.id);
  const canEdit = !team || isAdmin || isEditor;
  const isTeamAdmin = isAdmin;
  const confirm = useConfirm();
  // Workspace move/copy picker: null, or { action: 'move'|'copy', songId }.
  const [moveCopyDialog, setMoveCopyDialog] = useState(null);
  // PWA update prompt — toast appears when a new SW is downloaded.
  usePWAUpdate();
  // Native + iOS install affordance.
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [activeLibrary, setActiveLibrary] = useState('personal');
  // One-shot flag: open the Team screen directly in its create-workspace form.
  const [teamCreateIntent, setTeamCreateIntent] = useState(false);
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
      if (window.location.pathname === '/auth/google-drive') return 'google-drive-callback';
      if (window.location.pathname === '/privacy') return 'legal-privacy';
      if (window.location.pathname === '/terms') return 'legal-terms';
      if (window.location.pathname === '/copyright') return 'legal-copyright';
      if (/(type=recovery|#access_token=.*type=recovery)/.test(window.location.hash + window.location.search)) return 'recovery';
      if (shareTokenFromUrl()) return 'share-view';
    }
    return 'loading';
  });
  const [shareToken] = useState(() => shareTokenFromUrl());
  const [currentSong, setCurrentSong] = useState(null);
  // Arrangement to open in the editor (the one the user was viewing). Reset
  // whenever we enter the editor unless an explicit id is passed.
  const [editArrangementId, setEditArrangementId] = useState(null);
  const [currentSetlist, setCurrentSetlist] = useState(null);
  const [settings, setSettings] = useState(null);
  useChartTheme(settings);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState({ state: 'idle', lastSync: null, provider: null });
  const [previewSongId, setPreviewSongId] = useState(null);
  const [previewSetlistId, setPreviewSetlistId] = useState(null);
  // Schedule list/calendar view — lifted here so the BottomNav morphing FAB can
  // toggle it (alongside the desktop header switch). Defaults to list on phones.
  const [scheduleView, setScheduleView] = useState(() =>
    (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) ? 'list' : 'calendar'
  );
  // True while the setlist builder has unsaved edits — drives the discard
  // guard on header nav + browser back (the builder reports it via callback).
  const setlistDirtyRef = useRef(false);
  const markSetlistDirty = useCallback((dirty) => { setlistDirtyRef.current = dirty; }, []);
  const editorDirtyRef = useRef(false);
  const markEditorDirty = useCallback((dirty) => { editorDirtyRef.current = dirty; }, []);
  // Which item to open in setlist practice (tapping a song in the overview).
  const [practiceStartIndex, setPracticeStartIndex] = useState(0);
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
  // Session metrics handed off from Practice / Live views to their finale
  // screens. `sessionSource` records which Live view started the session
  // ('play' | 'performance') so "Run it again" returns to the right one.
  const [sessionStats, setSessionStats] = useState(null);
  const [sessionSource, setSessionSource] = useState(null);

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
  // Tracks which user we've already applied the "home Space" default for, so we
  // do it once per sign-in and never override a later manual switch.
  const defaultSpaceAppliedForRef = useRef(null);

  // Keep TeamProvider's active team aligned with the chosen library, and fall
  // back to personal if the selected team is no longer one the user belongs to
  // (left/deleted). activeLibrary only becomes a team id via an explicit
  // switch — after teams have loaded — so this never resets prematurely.
  useEffect(() => {
    if (activeLibrary === 'personal') return;
    const ids = teams.map(t => t.id);
    if (ids.includes(activeLibrary)) {
      setActiveTeam(activeLibrary);
    } else {
      setActiveLibrary('personal');
    }
  }, [teams, activeLibrary, setActiveTeam]);

  // "Home Space": members who live in a band/church can pick a default Space to
  // open into instead of Personal. Apply it once per sign-in, after settings +
  // teams have settled, and only while still on the initial Personal view so we
  // never yank someone out of a Space they deliberately switched to.
  useEffect(() => {
    if (!loaded || !user?.id || teamLoading) return;
    if (defaultSpaceAppliedForRef.current === user.id) return;
    const target = settings?.defaultSpaceId;
    if (!target) return; // nothing set yet (or cloud prefs not hydrated) — wait
    defaultSpaceAppliedForRef.current = user.id;
    if (target !== 'personal' && activeLibrary === 'personal' && teams.some(t => t.id === target)) {
      setActiveLibrary(target);
    }
  }, [loaded, user?.id, teamLoading, teams, activeLibrary, settings?.defaultSpaceId]);

  // Initialize sync engine for the active library
  const isTeamReadOnly = activeLibrary !== 'personal' && !isAdmin && !isEditor;
  useEffect(() => {
    if (syncEngineRef.current) {
      syncEngineRef.current.cancelDebounce();
    }

    syncEngineRef.current = createEngineForLibrary(activeLibrary, (status) => {
      setSyncState(prev => ({ ...prev, ...status }));
    }, { readOnly: isTeamReadOnly });
  }, [activeLibrary, isTeamReadOnly]);

  const triggerSync = useCallback(async () => {
    if (isSwitchingLibraryRef.current) return;
    const state = await getSyncState(activeLibrary);
    const providerId = activeLibrary !== 'personal' ? `supabase-team:${activeLibrary}` : state?.activeProvider;
    if (!providerId) return;
    const result = await syncEngineRef.current.fullSync(songs, setlists, tombstones);
    if (result.replaced) {
      // Team engine is server-authoritative — adopt its arrays wholesale so
      // remote deletions disappear here too.
      setSongs(result.songs);
      setSetlists(result.setlists);
    } else if (result.changed) {
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
    if (result.errors?.length > 0) {
      const first = result.errors[0];
      const more = result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : '';
      const where = first.title ? ` "${first.title}"` : '';
      toast({
        title: 'Some items failed to sync',
        description: `${first.kind}${where}: ${first.message}${more}`,
        variant: 'error',
      });
    } else if (result.uploaded && (result.uploaded.songs > 0 || result.uploaded.setlists > 0)) {
      const parts = [];
      if (result.uploaded.songs) parts.push(`${result.uploaded.songs} song${result.uploaded.songs === 1 ? '' : 's'}`);
      if (result.uploaded.setlists) parts.push(`${result.uploaded.setlists} setlist${result.uploaded.setlists === 1 ? '' : 's'}`);
      toast({ title: 'Synced', description: `Uploaded ${parts.join(', ')}.` });
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
        const demos = DEMO_SONGS_MD.map(md => songFromFlat({
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

      // Recompute keyHistory once on load by scanning past-dated setlists.
      // This is cheap and self-healing — if the device missed an
      // increment-on-save (e.g. it was offline) the history catches up.
      setSongs(prev => {
        if (!prev || prev.length === 0) return prev;
        const histories = computeKeyHistories(prev, savedSetlists || []);
        return applyKeyHistories(prev, histories);
      });

      const savedTombstones = await loadTombstones(activeLibrary);
      if (ignore) return;
      setTombstones(savedTombstones);

      // Settings remain global, so only load on initial mount
      if (!loaded) {
        const savedSettings = await loadSettings();
        // First-run default for the chart theme tracks the app theme so
        // light-mode users start on Sunday Light, dark-mode users start
        // on Stage Black, midnight users start on Midnight, and so on.
        if (savedSettings && !savedSettings.chartTheme) {
          const appTheme = savedSettings.theme || 'default';
          const defaultByTheme = {
            light: 'sunday-light',
            dark: 'stage-black',
            midnight: 'midnight',
            default: 'stage-black',
          };
          savedSettings.chartTheme = defaultByTheme[appTheme] || 'stage-black';
        }
        setSettings(savedSettings);

        // Determine initial view based on onboarding state
        const isAuthFlow = view === 'recovery' || view === 'auth-callback' || view === 'google-drive-callback';
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
            if (ignore) return;
            if (result.replaced) {
              setSongs(result.songs);
              setSetlists(result.setlists);
            } else if (result.changed) {
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
      } else {
        setSyncState({ state: 'idle', lastSync: null, provider: null });
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

  // Surface the result of a Stripe Checkout / billing-portal redirect, then
  // strip the `?billing=` param. The workspace's subscription_status is written
  // by the stripe-webhook function; TeamProvider re-fetches on this fresh load,
  // so the new status is already reflected.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (!billing) return;
    if (billing === 'success') {
      toast({ title: 'Subscription active', description: 'Your Space is all set.' });
    } else if (billing === 'cancel') {
      toast({ title: 'Checkout canceled', description: 'No changes were made.' });
    }
    window.history.replaceState({}, document.title, window.location.pathname);
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

  // Snapshot of all portable prefs — used as a single stable dep so the push
  // effect fires whenever *any* of the 30 keys changes, not just the 15 that
  // were previously listed in the deps array.
  const portablePrefsSnapshot = settings ? JSON.stringify(extractPortablePrefs(settings)) : null;

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
  }, [loaded, user?.id, portablePrefsSnapshot]);

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
      const color = mode === 'light' ? '#f6f4ef' : mode === 'midnight' ? '#14161e' : '#0a0807';
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
    sessionStats,
    sessionSource,
  });

  const pushHistory = (snap) => {
    historyRef.current.push(snap);
    window.history.pushState(null, '');
  };

  // True (and toasts) when the active team library is read-only for this user.
  const guardTeamReadOnly = () => {
    if (!isTeamReadOnly) return false;
    toast({
      title: 'Read-only library',
      description: 'Only team admins and editors can change songs here. Ask a team admin for the editor role.',
    });
    return true;
  };

  // Navigation with history stack. Not memoised — captures current state
  // through snapshot() on each call, which is what we want for back/forward.
  const navigate = (nextView, { song, setlist, replace, arrangementId } = {}) => {
    // Central gate for read-only team members (audit D-1): every editor entry
    // point funnels through here, so members can't reach the editor and lose
    // work to the server-authoritative sync (RLS already blocks their writes).
    if (nextView === 'editor' && guardTeamReadOnly()) return;
    if (!replace) pushHistory(snapshot());
    if (song !== undefined) setCurrentSong(song);
    if (setlist !== undefined) setCurrentSetlist(setlist);
    if (nextView === 'editor') setEditArrangementId(arrangementId ?? null);
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
      setSessionStats(prev.sessionStats ?? null);
      setSessionSource(prev.sessionSource ?? null);
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
      setSessionStats(null);
      setSessionSource(null);
    }
  }, []);

  // Browser back button support — single popstate handler for the whole app.
  // Anything that's allowed to be backed-out-of must have pushed onto
  // historyRef during its open call (see openModal / pushHistory above).
  // Prompt before leaving the setlist builder with unsaved edits. Returns
  // true if it's safe to navigate (not dirty, or the user chose to discard).
  const confirmDiscardSetlist = async () => {
    if (view === 'setlist-build' && setlistDirtyRef.current) {
      return await confirm({
        title: 'Discard changes?',
        description: 'You have unsaved changes to this setlist. They will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      });
    }
    if (view === 'editor' && editorDirtyRef.current) {
      return await confirm({
        title: 'Discard unsaved changes?',
        description: 'You have unsaved edits to this song. Leaving now will lose them.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      });
    }
    return true;
  };

  useEffect(() => {
    const handler = () => {
      if (historyRef.current.length === 0) return;
      // Browser/hardware back out of a dirty builder: the back already moved
      // one entry, so re-push to stay put while we ask. On discard we set the
      // flag false and fire back() again, which falls through to goBack().
      if (view === 'setlist-build' && setlistDirtyRef.current) {
        window.history.pushState(null, '');
        confirm({
          title: 'Discard changes?',
          description: 'You have unsaved changes to this setlist. They will be lost.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          variant: 'danger',
        }).then((ok) => {
          if (!ok) return;
          setlistDirtyRef.current = false;
          window.history.back();
        });
        return;
      }
      if (view === 'editor' && editorDirtyRef.current) {
        window.history.pushState(null, '');
        confirm({
          title: 'Discard unsaved changes?',
          description: 'You have unsaved edits to this song. Leaving now will lose them.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          variant: 'danger',
        }).then((ok) => {
          if (!ok) return;
          editorDirtyRef.current = false;
          window.history.back();
        });
        return;
      }
      goBack();
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [goBack, view, confirm]);

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
  const goToMainView = async (viewName, { settingsPanel: targetPanel } = {}) => {
    const samePanel = !targetPanel || targetPanel === settingsPanel;
    if (view === viewName && samePanel) return;
    if (!(await confirmDiscardSetlist())) return;
    pushHistory(snapshot());
    const apply = () => {
      setView(viewName);
      setCurrentSong(null);
      setCurrentSetlist(null);
      setIsFullscreen(false);
      if (viewName === 'settings') {
        setSettingsPanel(targetPanel || 'hub');
      }
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

  // Fully close Settings — pop history until we land on a non-settings view,
  // so the desktop modal × button always exits regardless of how many
  // sub-panels the user drilled through.
  const closeSettings = useCallback(() => {
    while (historyRef.current.length > 0) {
      const prev = historyRef.current.pop();
      if (prev && prev.view !== 'settings') {
        setView(prev.view);
        setCurrentSong(prev.song);
        setCurrentSetlist(prev.setlist);
        if (prev.settingsPanel !== undefined) setSettingsPanel(prev.settingsPanel);
        setAccountWallTrigger(prev.accountWall ?? null);
        setShowFounderNote(!!prev.founderNote);
        setShowIOSHint(!!prev.iosHint);
        setShowWakeLockExplainer(!!prev.wakeLockExplainer);
        if (typeof prev.isFullscreen === 'boolean') setIsFullscreen(prev.isFullscreen);
        setSessionStats(prev.sessionStats ?? null);
        setSessionSource(prev.sessionSource ?? null);
        return;
      }
    }
    // Nothing else in history — fall back to home.
    setView('home');
    setSettingsPanel('hub');
  }, []);

  // Modal openers — each one pushes history first so hardware Back closes
  // the modal instead of bypassing it. Modal close handlers call
  // window.history.back() which triggers popstate → goBack → modal hides.
  const openAccountWall = (trigger, snap) => {
    // `snap` lets callers pass the destination snapshot explicitly. snapshot()
    // reads the *current render's* view/song/setlist, which are still stale
    // when this fires in the same batch as a navigate() — without the override
    // the back stack would pop to the pre-navigation screen (e.g. an empty
    // builder) instead of the just-saved item.
    pushHistory(snap || snapshot());
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
  const handleMarkNotificationRead = useCallback((notifId) => {
    setSettings(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n =>
        n.id === notifId ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const handleNotificationAction = () => {
    // Actions are usually strings like "view_setlist_123" or similar
    // Actually the action might not have been implemented in previous iterations.
    // If we have an actionable notification, we can handle it here if it's not handled internally by the tray
  };

  // --- Compute Virtual Notifications ---
  // Pending schedules for the current user are merged into the local notifications array
  const pendingSchedules = schedules?.filter(s => s.user_id === user?.id && s.availability === 'pending') || [];
  const virtualNotifications = pendingSchedules.map(s => {
    // Attempt to find the setlist name
    const setlist = setlists.find(sl => sl.id === s.setlist_id) || { name: 'a setlist' };
    return {
      id: `schedule-${s.id}`,
      type: 'schedule_request',
      title: 'You have been scheduled!',
      message: `You are scheduled for "${setlist.name}"${s.role ? ` as ${s.role}` : ''}.`,
      read: false,
      scheduleId: s.id,
      setlistId: s.setlist_id,
    };
  });

  const mergedNotifications = [
    ...virtualNotifications,
    ...(settings?.notifications || [])
  ];

  const hasUnreadNotifications = mergedNotifications.some(n => !n.read);

  // Switch between Personal and a team/church workspace. Always lands on the
  // Dashboard so the user gets a consistent "home" for the workspace they
  // just entered (roadmap: swapping workspaces always goes to dashboard).
  const switchWorkspace = (libId) => {
    if (libId !== activeLibrary) setActiveLibrary(libId);
    goToMainView('home');
  };

  const goLibrary = () => goToMainView('library');
  const goSetlists = () => goToMainView('setlists');

  // Safety net: if a member ends up on an editing surface in a read-only team
  // library (e.g. they switched into the workspace while the editor was open),
  // bounce them back to the matching list. The entry points are gated, the save
  // handlers refuse to write, and this keeps them from staring at a dead editor.
  useEffect(() => {
    if (!isTeamReadOnly) return;
    if (view === 'editor') goToMainView('library');
    else if (view === 'setlist-build') goToMainView('setlists');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamReadOnly, view]);

  const goChart = (song) => {
    if (!settings?.firstSongOpened) {
      setSettings(prev => ({ ...prev, firstSongOpened: true }));
    }
    navigate('chart', { song });
  };
  const goEditor = (song = null, arrangementId = null) => {
    if (isTeamReadOnly) return;
    navigate('editor', { song, arrangementId });
  };
  const goSetlistBuild = (sl = null) => {
    if (isTeamReadOnly) return;
    navigate('setlist-build', { setlist: sl });
  };
  const goSetlistView = (sl) => {
    // Opening the full overview supersedes any side-peek preview — clear it so
    // returning to the list doesn't re-open the pane for this setlist.
    setPreviewSetlistId(null);
    navigate('setlist-view', { setlist: sl });
  };
  const goSetlistPerformance = (sl) => {
    if (!settings?.firstStageMode) {
      setSettings(prev => ({ ...prev, firstStageMode: true }));
    }
    navigate('setlist-performance', { setlist: sl });
  };
  const goSetlistPractice = (sl, startIndex = 0) => {
    setPracticeStartIndex(Number.isInteger(startIndex) ? startIndex : 0);
    navigate('setlist-practice', { setlist: sl });
  };
  const goPracticeFinale = (sl, stats) => {
    setSessionStats(stats || null);
    setSessionSource('practice');
    navigate('practice-finale', { setlist: sl });
  };
  const goLiveFinale = (sl, stats, source) => {
    setSessionStats(stats || null);
    setSessionSource(source || 'play');
    navigate('live-finale', { setlist: sl });
  };
  // From a finale "Run it again" — re-enter the originating session view
  // with replace, so the back stack stays at the entry point that opened
  // the original session rather than nesting another finale below it.
  const handleRunSessionAgain = () => {
    if (!currentSetlist) return;
    const dest = sessionSource === 'performance'
      ? 'setlist-performance'
      : sessionSource === 'play'
        ? 'setlist-play'
        : 'setlist-practice';
    setSessionStats(null);
    setSessionSource(null);
    navigate(dest, { setlist: currentSetlist, replace: true });
  };
  // From a finale "Back to setlist" / "View setlist" — replace the finale
  // with the setlist overview so back from there returns to the original
  // entry point rather than the finale.
  const handleFinaleViewOverview = () => {
    if (!currentSetlist) return;
    setSessionStats(null);
    setSessionSource(null);
    navigate('setlist-view', { setlist: currentSetlist, replace: true });
  };
  const handleFinaleGoHome = () => {
    setSessionStats(null);
    setSessionSource(null);
    goToMainView('home');
  };
  const goTeam = () => goToMainView('team');
  // Open the Team screen straight into its "create workspace" form. Used by the
  // workspace switcher's "+ New workspace" shortcut so a user can spin up
  // additional bands/churches without first landing on an existing team.
  const goNewWorkspace = () => { setTeamCreateIntent(true); goTeam(); };
  // Who may create additional Spaces. Eligible accounts (billing on, or
  // team/church tier) can create up to the owned-workspace cap; once they hit
  // it we surface a "limit reached / contact support" affordance instead.
  const eligibleToCreateWorkspace = BILLING_ENABLED || hasTeamPlan;
  const canCreateWorkspace = eligibleToCreateWorkspace && !atWorkspaceLimit;
  const newWorkspaceLocked = eligibleToCreateWorkspace && atWorkspaceLimit;
  const goSchedule = () => navigate('schedule');

  // Song CRUD
  // Accepts either a v2-shaped song (with arrangements[]) or a flat shape
  // emitted by the Editor (parseSongMd returns flat). When the input is flat
  // and matches an existing song id, we merge into the active/default
  // arrangement so the song's other arrangements are preserved.
  const handleSaveSong = (input, opts = {}) => {
    if (isTeamReadOnly) {
      toast({ title: 'Read-only library', description: 'You don\'t have permission to edit songs here.', variant: 'error' });
      return;
    }
    const isV2 = !!(input && Array.isArray(input.arrangements) && input.arrangements.length > 0);
    let v2 = input;
    let isNew = false;
    setSongs(prev => {
      const idx = prev.findIndex(s => s.id === input.id);
      if (idx < 0) {
        // Brand-new song. Wrap a flat input as a single-arrangement song.
        v2 = isV2 ? input : songFromFlat(input);
        isNew = true;
        return [...prev, { ...v2, updatedAt: Date.now() }];
      }
      const existing = prev[idx];
      if (isV2) {
        v2 = { ...input, updatedAt: Date.now() };
      } else {
        // Flat input → merge into the targeted arrangement of the existing song.
        const targetArrId = opts.arrangementId || existing.defaultArrangementId;
        v2 = withArrangement(existing, targetArrId, (a) => ({
          ...a,
          key: input.key ?? a.key,
          tempo: input.tempo ?? a.tempo,
          time: input.time ?? a.time,
          capo: input.capo ?? a.capo,
          notes: input.notes ?? a.notes,
          structure: Array.isArray(input.structure) ? input.structure : a.structure,
          sections: Array.isArray(input.sections) ? input.sections : a.sections,
        }));
        // Carry over song-level fields from the editor.
        const songLevel = {
          title: input.title,
          artist: input.artist,
          ccli: input.ccli,
          tags: input.tags,
          spotify: input.spotify,
          youtube: input.youtube,
        };
        for (const k of Object.keys(songLevel)) {
          if (songLevel[k] !== undefined) v2[k] = songLevel[k];
        }
        v2.updatedAt = Date.now();
      }
      const next = [...prev];
      next[idx] = v2;
      return next;
    });
    const stamped = v2;
    const song = stamped;
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
      openAccountWall(
        { kind: 'song', title: song.title || 'Untitled song' },
        { ...snapshot(), view: 'chart', song },
      );
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
        const tempEngine = createEngineForLibrary(targetLibraryId, () => {});
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

  const handleCopySongToLibrary = async (songId, targetLibraryId) => {
    try {
      const song = songs.find(s => s.id === songId);
      if (!song) return;

      // Create a copy with a new ID so both libraries have independent items
      const copy = { ...song, id: generateId(), updatedAt: Date.now() };

      // Add to target library
      const targetSongs = await loadSongs(targetLibraryId);
      targetSongs.push(copy);
      await saveSongs(targetSongs, targetLibraryId);

      // Trigger a background sync on the target library so the cloud gets the file
      if (syncEngineRef.current) {
        const tempEngine = createEngineForLibrary(targetLibraryId, () => {});
        const targetTombstones = await loadTombstones(targetLibraryId);
        const targetSetlists = await loadSetlists(targetLibraryId);
        tempEngine.debouncedPush(targetSongs, targetSetlists, targetTombstones, () => {});
      }

      toast({
        title: 'Song copied',
        description: `A copy was added to the ${targetLibraryId === 'personal' ? 'Personal' : 'Team'} library.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Copy failed', variant: 'error' });
    }
  };

  // Candidate destinations for moving/copying a song — every workspace except
  // the one currently active.
  const moveCopyWorkspaces = [
    { id: 'personal', name: 'Personal' },
    ...teams.map(t => ({ id: t.id, name: t.name })),
  ].filter(w => w.id !== activeLibrary);

  // Per-song Move/Copy props for the ChartView kebab (chart reader + library
  // preview pane). Opens a workspace picker so users choose where to send the
  // song — Copy is offered whenever another workspace exists; Move also
  // requires write access to the source (personal, or admin of the team).
  const buildChartMoveCopy = (songId) => {
    if (!songId || moveCopyWorkspaces.length === 0) return {};
    const canMove = activeLibrary === 'personal' || isTeamAdmin;
    const props = {
      onCopySong: () => setMoveCopyDialog({ action: 'copy', songId }),
    };
    if (canMove) props.onMoveSong = () => setMoveCopyDialog({ action: 'move', songId });
    return props;
  };

  const performMoveCopy = (target) => {
    if (!moveCopyDialog) return;
    const { action, songId } = moveCopyDialog;
    if (action === 'move') handleMoveSongToLibrary(songId, target);
    else handleCopySongToLibrary(songId, target);
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

  // ----- Bulk song actions (Library selection toolbar) -----
  const handleDeleteSongs = async (ids) => {
    if (!ids || ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} song${ids.length === 1 ? '' : 's'}?`,
      description: 'They are removed from this library across all your devices.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const idSet = new Set(ids);
    setSongs(prev => prev.filter(s => !idSet.has(s.id)));
    setTombstones(prev => ({
      ...prev,
      songs: [...prev.songs.filter(t => !idSet.has(t.id)), ...ids.map(id => ({ id, deletedAt: Date.now() }))],
    }));
    toast({ title: `Deleted ${ids.length} song${ids.length === 1 ? '' : 's'}` });
  };

  // Rename or clear a service across every setlist that uses it. Passing an
  // empty newName "deletes" the service (it disappears once unused). Mutates
  // via setSetlists like other setlist edits, so the auto-save effect persists.
  const handleRemapService = useCallback((oldName, newName) => {
    const next = (newName || '').trim();
    setSetlists(prev => prev.map(sl =>
      (sl.service || '') === oldName
        ? { ...sl, service: next, updatedAt: Date.now() }
        : sl
    ));
    toast(next
      ? { title: 'Service renamed', description: `“${oldName}” → “${next}”` }
      : { title: 'Service removed', description: `“${oldName}” cleared from its setlists` });
  }, []);

  const handleAddSongsToSetlist = (songIds, setlistId) => {
    const target = setlists.find(s => s.id === setlistId);
    if (!target) return;
    let added = 0;
    setSetlists(prev => prev.map(sl => {
      if (sl.id !== setlistId) return sl;
      const existing = new Set((sl.items || []).filter(i => i.songId).map(i => i.songId));
      const newItems = songIds
        .filter(id => !existing.has(id))
        .map(id => {
          const song = songs.find(s => s.id === id);
          if (!song) return null;
          const arr = (song.arrangements || []).find(a => a.id === song.defaultArrangementId) || song.arrangements?.[0];
          return {
            songId: id,
            songTitle: song.title,
            arrangementId: arr?.id,
            arrangementName: arr?.name,
            note: '',
            transpose: 0,
            capo: arr?.capo || 0,
          };
        })
        .filter(Boolean);
      added = newItems.length;
      return { ...sl, items: [...(sl.items || []), ...newItems] };
    }));
    toast({
      title: 'Added to setlist',
      description: `${added} song${added === 1 ? '' : 's'} → ${target.name || 'setlist'}`,
    });
  };

  const handleMoveSongs = async (ids, target) => {
    for (const id of ids) await handleMoveSongToLibrary(id, target);
  };
  const handleCopySongs = async (ids, target) => {
    for (const id of ids) await handleCopySongToLibrary(id, target);
  };

  const handleSmartImport = (mdText) => {
    if (guardTeamReadOnly()) return; // adds to songs before navigate()'s gate
    try {
      const parsed = parseSongMd(mdText);
      const song = songFromFlat({ ...parsed, id: generateId(), updatedAt: Date.now() });
      setSongs(prev => [...prev, song]);
      setNewSongModal(null);
      navigate('editor', { song });
    } catch {
      toast({ title: 'Import failed', description: 'Could not parse converted chord sheet.', variant: 'error' });
    }
  };

  const handleImportParsedSongs = (parsedSongs) => {
    if (!parsedSongs || parsedSongs.length === 0) return;
    if (guardTeamReadOnly()) return;
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
  const handleSaveSetlist = (incomingSl) => {
    if (isTeamReadOnly) {
      toast({ title: 'Read-only library', description: 'You don\'t have permission to edit setlists here.', variant: 'error' });
      return;
    }
    // Determine isNew / prevSetlist synchronously from the current render's
    // setlists value. We can't read it from inside the setSetlists updater
    // because React 18 defers updaters until the next render, so any closure
    // variables they mutate are still at their initial values when the rest
    // of this function runs (the bug: new-setlist saves were taking the
    // edit branch and goBack()ing to wherever the builder was opened from).
    const existingIdx = setlists.findIndex(s => s.id === incomingSl.id);
    const isNew = existingIdx < 0;
    const prevSetlist = existingIdx >= 0 ? setlists[existingIdx] : null;

    // Stamp workspace + authorship metadata. Workspace and createdBy are set
    // once (on first save) and preserved thereafter; updatedBy/At always
    // refresh. Names are denormalized so the overview can render without a
    // profile lookup (may go stale if a member renames — acceptable).
    const editorName = profile?.display_name || settings?.userName || 'You';
    const editorId = user?.id || null;
    const wsName = activeLibrary === 'personal'
      ? 'Personal'
      : (teams.find(t => t.id === activeLibrary)?.name || team?.name || 'Team');
    const sl = {
      ...incomingSl,
      workspaceId: prevSetlist?.workspaceId ?? activeLibrary,
      workspaceName: prevSetlist?.workspaceName ?? wsName,
      createdBy: prevSetlist?.createdBy ?? editorId,
      createdByName: prevSetlist?.createdByName ?? editorName,
      updatedBy: editorId,
      updatedByName: editorName,
      updatedAt: Date.now(),
    };

    setSetlists(prev => {
      const idx = prev.findIndex(s => s.id === sl.id);
      if (idx >= 0) {
        const n = [...prev];
        n[idx] = sl;
        return n;
      }
      return [...prev, sl];
    });
    // Update keyHistory in response to this save. incrementForSetlistDiff
    // handles all four cases (was-past × is-past) and is a no-op for
    // future/undated setlists.
    setSongs(prev => incrementForSetlistDiff(prev, prevSetlist, sl));
    if (!settings?.firstSetlistBuilt) {
      setSettings(prev => ({ ...prev, firstSetlistBuilt: true }));
    }
    // Keep the desktop split-view selection in sync so the new/updated
    // setlist is preselected if the user navigates back to the list.
    setPreviewSetlistId(sl.id);
    if (isNew) {
      // Land on the new setlist's overview so the user can immediately see
      // (and play) what they built. `replace` keeps the history stack at
      // the entry point that opened the builder, so Back from the overview
      // returns there rather than re-opening the builder.
      navigate('setlist-view', { setlist: sl, replace: true });
    } else {
      // For edits, return to wherever the builder was opened from. goBack
      // restores currentSetlist from the pre-edit snapshot, so overwrite it
      // with the freshly saved object — otherwise SetlistOverview would
      // render stale data until the next render cycle.
      goBack();
      setCurrentSetlist(sl);
    }
    if (isNew && !user && !settings?.seenSaveAccountWall) {
      openAccountWall(
        { kind: 'setlist', title: sl.name || 'Untitled setlist' },
        { ...snapshot(), view: 'setlist-view', setlist: sl },
      );
    }
  };

  // Accepts either a v2 song shape OR a flat resolved view (which carries
  // _arrangementId). For resolved views we patch the named arrangement only,
  // preserving the song's other arrangements.
  const handleUpdateSong = useCallback((updatedSong) => {
    if (!updatedSong || !updatedSong.id) return;
    setSongs(prev => {
      const i = prev.findIndex(s => s.id === updatedSong.id);
      if (i < 0) return prev;
      const existing = prev[i];
      const isResolvedView = !!updatedSong._arrangementId && Array.isArray(existing.arrangements);
      let next;
      if (isResolvedView) {
        next = withArrangement(existing, updatedSong._arrangementId, (a) => ({
          ...a,
          key: updatedSong.key ?? a.key,
          tempo: updatedSong.tempo ?? a.tempo,
          time: updatedSong.time ?? a.time,
          capo: updatedSong.capo ?? a.capo,
          notes: updatedSong.notes ?? a.notes,
          structure: Array.isArray(updatedSong.structure) ? updatedSong.structure : a.structure,
          sections: Array.isArray(updatedSong.sections) ? updatedSong.sections : a.sections,
        }));
        // Allow song-level fields (title, artist, ccli, tags, links) to be
        // updated through the same path.
        const songLevel = { title: updatedSong.title, artist: updatedSong.artist, ccli: updatedSong.ccli, tags: updatedSong.tags, spotify: updatedSong.spotify, youtube: updatedSong.youtube };
        for (const k of Object.keys(songLevel)) {
          if (songLevel[k] !== undefined) next[k] = songLevel[k];
        }
      } else if (Array.isArray(updatedSong.arrangements)) {
        next = updatedSong;
      } else {
        // Legacy flat → wrap as new song with one arrangement, preserving id/keyHistory.
        next = { ...songFromFlat(updatedSong), id: updatedSong.id, keyHistory: existing.keyHistory };
      }
      const arr = [...prev];
      arr[i] = { ...next, updatedAt: Date.now() };
      return arr;
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

  const handleDeleteSetlists = async (ids) => {
    if (!ids || ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} setlist${ids.length === 1 ? '' : 's'}?`,
      description: 'They are removed from this Space across all your devices.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const idSet = new Set(ids);
    setSetlists(prev => prev.filter(s => !idSet.has(s.id)));
    setTombstones(prev => ({
      ...prev,
      setlists: [...prev.setlists.filter(t => !idSet.has(t.id)), ...ids.map(id => ({ id, deletedAt: Date.now() }))],
    }));
    setPreviewSetlistId(null);
    toast({ title: `Deleted ${ids.length} setlist${ids.length === 1 ? '' : 's'}` });
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
    try {
      const blob = await exportSetlistZip(sl, songs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slugify(sl.name || 'setlist') + '.zip';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Setlist exported', description: `${sl.name || 'Untitled'}.zip` });
    } catch (err) {
      toast({ title: 'Export failed', description: err?.message || 'Could not build the .zip file.', variant: 'error' });
    }
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

  if (view === 'share-view') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[var(--ds-background-100)]" />}>
          <SharedSetlistViewer
            token={shareToken}
            onExit={() => {
              window.history.replaceState({}, document.title, '/');
              goToMainView('home');
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (view === 'auth-callback') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[var(--ds-background-100)]" />}>
          <AuthCallback onDone={() => goToMainView('home')} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (view === 'google-drive-callback') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen bg-[var(--ds-background-100)]" />}>
          <GoogleDriveCallback
            onDone={() => {
              toast({ title: 'Google Drive connected', description: 'Your songs and setlists will sync to your Drive.' });
              goToMainView('home');
              // Trigger a sync immediately so it pulls the cloud state into the app
              triggerSync();
            }}
            onCancel={() => {
              window.history.replaceState({}, '', '/');
              goToMainView('home');
            }}
          />
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
      <div className="min-h-screen bg-[var(--ds-background-200)] flex flex-col items-center justify-center gap-6">
        <img src="/setlists-md-mark.svg" alt="setlists.md" width="80" height="80" className="rounded-2xl" />
        <div className="text-copy-14 text-[var(--text-2)]">
          Loading setlists.md…
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
  const currentWorkspaceName = activeLibrary === 'personal'
    ? 'Personal'
    : (teams.find(t => t.id === activeLibrary)?.name || team?.name || 'Team');
  // Service suggestions for the builder dropdown — distinct service names
  // already used across this workspace's setlists (foundation for per-service
  // stats; a canonical team_services table can replace this source later).
  const knownServices = [...new Set(setlists.map(s => s.service).filter(Boolean))].sort();
  // Display label for the personal plan. The internal `team` tier is branded
  // "Band" in the UI; everything else title-cases its tier key.
  const PLAN_DISPLAY = { free: 'Free', sync: 'Sync', team: 'Band', church: 'Church' };
  let plan = 'Free';
  if (profile?.subscription_tier) {
    const tier = profile.subscription_tier.toLowerCase();
    plan = PLAN_DISPLAY[tier] || (tier.charAt(0).toUpperCase() + tier.slice(1));
  } else if (profile?.is_pro) {
    plan = 'Pro';
  }
  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      description: 'Your songs and setlists stay on this device. You can sign back in any time to resume cloud sync.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    try {
      await signOut();
      toast({ title: 'Signed out' });
      goToMainView('home');
    } catch (err) {
      toast({ title: 'Sign-out failed', description: err.message, variant: 'error' });
    }
  };

  return (
    <WorkspaceProvider activeLibrary={activeLibrary}>
    <ErrorBoundary>
    <Suspense fallback={lazyFallback}>
      <Toaster />
      <OfflineBanner />
      {view === 'signin' && (
        <AuthScreen
          onBack={goBack}
          onSignedIn={() => goToMainView('home')}
          defaultMode={authStartMode}
          onShowLegal={(doc) => navigate(`legal-${doc}`)}
        />
      )}
      {view === 'onboarding' && (
        <div style={{ height: '100dvh', overflowY: 'auto', overflowX: 'hidden' }}>
        <OnboardingFlow
          onComplete={(quiz) => {
            // Inject demos if not already present (covers the first-run path).
            setSongs(prev => {
              if (prev.length > 0) return prev;
              const demos = DEMO_SONGS_MD.map(md => songFromFlat({
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
      {!['onboarding', 'signin', 'recovery'].includes(view) && (
        <DesktopLayout
          activeView={view === 'setlist-view' ? 'setlists' : view === 'design' ? 'settings' : view === 'schedule' ? 'home' : view}
          onNavigate={goToMainView} 
          isFullscreen={view === 'setlist-performance' || view === 'setlist-play' || view === 'setlist-practice' || (isFullscreen && (view === 'library' || view === 'setlists'))}
          hideBanner={view === 'setlist-performance' || view === 'setlist-play' || view === 'setlist-practice'}
          hasUnreadNotifications={hasUnreadNotifications} 
          notifications={mergedNotifications} 
          onMarkRead={handleMarkNotificationRead} 
          onNotificationAction={handleNotificationAction} 
          drawerOpen={drawerOpen} 
          displayName={displayName}
          plan={plan}
          avatarUrl={profile?.avatar_url}
          activeLibrary={activeLibrary}
          setActiveLibrary={switchWorkspace}
          team={team}
          teams={teams}
          onChangeWorkspace={goTeam}
          onNewWorkspace={canCreateWorkspace ? goNewWorkspace : undefined}
          newWorkspaceLocked={newWorkspaceLocked}
          supportContact={SUPPORT_CONTACT}
          syncState={syncState}
          onSyncNow={triggerSync}
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
              activeLibrary={activeLibrary}
              workspaces={[
                { id: 'personal', name: 'Personal Space', avatarUrl: profile?.avatar_url || null },
                ...teams.map(t => ({ id: t.id, name: t.name, avatarUrl: t.logo_url || null, status: t.subscription_status })),
              ]}
              setActiveLibrary={switchWorkspace}
              onNewWorkspace={canCreateWorkspace ? goNewWorkspace : undefined}
              newWorkspaceLocked={newWorkspaceLocked}
              supportContact={SUPPORT_CONTACT}
            />
          )}
          {view === 'home' && (
            <Dashboard
              songs={songs}
              setlists={setlists}
              settings={settings}
              onSelectSong={goChart}
              onNewSong={isTeamReadOnly ? null : () => openNewSongModal()}
              onNewSetlist={isTeamReadOnly ? null : () => goSetlistBuild()}
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
                newSong: () => openNewSongModal(),
                newSetlist: () => goSetlistBuild(),
                signIn: () => { setAuthStartMode('signin'); navigate('signin'); },
              }}
              onDismissChecklist={() => setSettings(prev => ({ ...prev, checklistDismissed: true }))}
              canEdit={canEdit}
              onSignIn={!user ? () => { setAuthStartMode('signin'); navigate('signin'); } : undefined}
            />
          )}
          {view === 'library' && (
            <Library
              songs={songs}
              loaded={loaded}
              onSelectSong={goChart}
              onNewSong={isTeamReadOnly ? null : () => openNewSongModal()}
              previewSongId={previewSongId}
              onSelectPreview={setPreviewSongId}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onEditSong={isTeamReadOnly ? null : (s) => goEditor(s)}
              readOnly={isTeamReadOnly}
              setlists={setlists}
              activeLibrary={activeLibrary}
              workspaces={[{ id: 'personal', name: 'Personal' }, ...teams.map(t => ({ id: t.id, name: t.name }))]}
              onDeleteSongs={isTeamReadOnly ? null : handleDeleteSongs}
              onAddSongsToSetlist={isTeamReadOnly ? null : handleAddSongsToSetlist}
              onMoveSongs={!isTeamReadOnly && teams.length > 0 ? handleMoveSongs : null}
              onCopySongs={teams.length > 0 ? handleCopySongs : null}
              chartMoveCopy={buildChartMoveCopy}
              chartDefaults={{
                defaultColumns: settings?.defaultColumns,
                defaultFontSize: settings?.defaultFontSize,
                showInlineNotes: settings?.showInlineNotes !== false,
                inlineNoteStyle: settings?.inlineNoteStyle || 'dashes',
                displayRole: settings?.displayRole || 'leader',
                duplicateSections: settings?.duplicateSections || 'full',
                chartLayout: settings?.chartLayout || 'columns',

                settings,

                onUpdateSettings: (key, value) => setSettings(prev => ({ ...prev, [key]: value })),
              }}
              canEdit={canEdit}
            />
          )}
          {view === 'setlists' && (
            <Setlists
              songs={songs}
              setlists={setlists}
              loaded={loaded}
              onViewSetlist={goSetlistView}
              onPlaySetlist={goSetlistPerformance}
              onPracticeSetlist={(sl, startIndex) => goSetlistPractice(sl, startIndex)}
              onNewSetlist={isTeamReadOnly ? null : () => goSetlistBuild()}
              onImportSetlist={isTeamReadOnly ? null : handleImportSetlist}
              previewSetlistId={previewSetlistId}
              onSelectPreview={setPreviewSetlistId}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onEditSetlist={isTeamReadOnly ? null : (sl) => goSetlistBuild(sl)}
              readOnly={isTeamReadOnly}
              clockFormat={settings?.clockFormat || '12h'}
              onExportSetlistZip={(sl) => handleExportSetlist(sl)}
              onExportSetlistPdfOverview={(sl) => exportSetlistPdf(sl, songs, { mode: 'overview' })}
              onExportSetlistPdfFull={(sl) => exportSetlistPdf(sl, songs, { mode: 'full' })}
              onDeleteSetlist={isTeamReadOnly ? null : (id) => {
                setSetlists(prev => prev.filter(s => s.id !== id));
                setTombstones(prev => ({
                  ...prev,
                  setlists: [...prev.setlists.filter(t => t.id !== id), { id, deletedAt: Date.now() }],
                }));
                setPreviewSetlistId(null);
              }}
              onDeleteSetlists={isTeamReadOnly ? null : handleDeleteSetlists}
              canEdit={canEdit}
            />
          )}
          {view === 'chart' && currentSong && (
            <ErrorBoundary>
            <ChartView
              song={currentSong}
              onBack={goBack}
              onEdit={isTeamReadOnly ? null : (arrId) => goEditor(currentSong, arrId)}
              {...buildChartMoveCopy(currentSong.id)}
              onSongChange={(updated) => {
                setSongs(prev => prev.map(s => s.id === updated.id ? { ...updated, updatedAt: Date.now() } : s));
              }}
              settings={settings}
              onUpdateSettings={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
              onOpenAdvancedStyle={() => goToMainView('settings', { settingsPanel: 'chart-style' })}
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
              initialArrangementId={editArrangementId}
              onSave={isTeamReadOnly ? null : handleSaveSong}
              onBack={importQueue ? handleSkipQueueSong : goBack}
              onDirtyChange={markEditorDirty}
              onDelete={currentSong && !isTeamReadOnly ? handleDeleteSong : null}
              customSectionTypes={settings?.customSectionTypes}
              importProgress={importQueue ? {
                current: importQueue.total - importQueue.remaining.length + 1,
                total: importQueue.total,
                onSkip: handleSkipQueueSong,
              } : null}
              readOnly={isTeamReadOnly}
              onOpenNewSong={isTeamReadOnly ? null : openNewSongModal}
              chartDefaults={{
                defaultColumns: settings?.defaultColumns,
                defaultFontSize: settings?.defaultFontSize,
                showInlineNotes: settings?.showInlineNotes !== false,
                inlineNoteStyle: settings?.inlineNoteStyle || 'dashes',
                displayRole: settings?.displayRole || 'leader',
                duplicateSections: settings?.duplicateSections || 'full',
                chartLayout: settings?.chartLayout || 'columns',

                settings,

                onUpdateSettings: (key, value) => setSettings(prev => ({ ...prev, [key]: value })),
              }}
            />
          )}
          {view === 'setlist-view' && currentSetlist && (
            <SetlistOverview
              key={currentSetlist.id}
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
              onEdit={isTeamReadOnly ? null : () => goSetlistBuild(currentSetlist)}
              onExportZip={() => handleExportSetlist(currentSetlist)}
              onExportPdfOverview={() => exportSetlistPdf(currentSetlist, songs, { mode: 'overview' })}
              onExportPdfFull={() => exportSetlistPdf(currentSetlist, songs, { mode: 'full' })}
              clockFormat={settings?.clockFormat || '12h'}
              onPlay={() => goSetlistPerformance(currentSetlist)}
              onPractice={(startIndex) => goSetlistPractice(currentSetlist, startIndex)}
              onDelete={isTeamReadOnly ? null : () => handleDeleteSetlist(currentSetlist.id)}
              canEdit={canEdit}
            />
          )}
          {view === 'setlist-build' && (
            <SetlistBuilder
              songs={songs}
              setlist={currentSetlist}
              onSave={handleSaveSetlist}
              onBack={goBack}
              onDelete={currentSetlist && !isTeamReadOnly ? handleDeleteSetlist : null}
              isTeamContext={activeLibrary !== 'personal'}
              workspaceName={currentWorkspaceName}
              knownServices={knownServices}
              onDirtyChange={markSetlistDirty}
              onUpdateSong={handleUpdateSong}
              firstDayOfWeek={settings?.firstDayOfWeek || 'sunday'}
              clockFormat={settings?.clockFormat || '12h'}
            />
          )}
          {view === 'setlist-play' && currentSetlist && (
            <SetlistPlayer
              setlist={currentSetlist}
              songs={songs}
              onBack={goBack}
              onFinish={(stats) => goLiveFinale(currentSetlist, stats, 'play')}
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
              onFinish={(stats) => goLiveFinale(currentSetlist, stats, 'performance')}
              defaultColumns={settings?.defaultColumns}
              defaultFontSize={settings?.defaultFontSize}
              railEnabled={settings?.performanceRail !== false}
              navStyle={settings?.navStyle || 'pill'}
              settings={settings}
              onUpdateSettings={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
              teamId={activeLibrary !== 'personal' ? activeLibrary : null}
              userId={user?.id}
            />
          )}
          {view === 'setlist-practice' && currentSetlist && (
            <PracticeView
              setlist={currentSetlist}
              songs={songs}
              startIndex={practiceStartIndex}
              onBack={goBack}
              onFinish={(stats) => goPracticeFinale(currentSetlist, stats)}
              onUpdateSong={handleUpdateSong}
              onUpdateSetlist={handleUpdateSetlist}
              defaultColumns={settings?.defaultColumns}
              defaultFontSize={settings?.defaultFontSize}
              railEnabled={settings?.performanceRail !== false}
              navStyle={settings?.navStyle || 'pill'}
              settings={settings}
              onUpdateSettings={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
              onOpenAdvancedStyle={() => goToMainView('settings', { settingsPanel: 'chart-style' })}
              teamId={activeLibrary !== 'personal' ? activeLibrary : null}
              userId={user?.id}
              canEditShared={canEdit}
            />
          )}
          {view === 'practice-finale' && currentSetlist && (
            <PracticeFinale
              setlist={currentSetlist}
              songs={songs}
              sessionStats={sessionStats}
              onRunAgain={handleRunSessionAgain}
              onUpdateSetlist={handleUpdateSetlist}
              onGoOverview={handleFinaleViewOverview}
              onGoHome={handleFinaleGoHome}
            />
          )}
          {view === 'live-finale' && currentSetlist && (
            <LiveFinale
              setlist={currentSetlist}
              sessionStats={sessionStats}
              onRunAgain={handleRunSessionAgain}
              onUpdateSetlist={handleUpdateSetlist}
              onGoOverview={handleFinaleViewOverview}
              onGoHome={handleFinaleGoHome}
            />
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
          {(view === 'legal-privacy' || view === 'legal-terms' || view === 'legal-copyright') && (
            <LegalPage
              doc={view === 'legal-privacy' ? 'privacy' : view === 'legal-terms' ? 'terms' : 'copyright'}
              onBack={() => {
                if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
                goToMainView('home');
              }}
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
              onClose={closeSettings}
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
                toast({
                  title: 'Library exported',
                  description: `${songs.length} song${songs.length === 1 ? '' : 's'} downloaded as .md files.`,
                });
              }}
              songCount={songs.length}
              setlistCount={setlists.length}
              syncState={syncState}
              onSyncStateChange={setSyncState}
              onSyncNow={triggerSync}
              onRequestSignIn={() => { setAuthStartMode('signin'); navigate('signin'); }}
              onUpgrade={() => navigate('upgrade')}
              onShowLegal={(doc) => navigate(`legal-${doc}`)}
              plan={plan}
              isSignedIn={isSignedIn}
              displayName={displayName}
              displayEmail={displayEmail}
              onSignOut={handleSignOut}
              onSignIn={() => { setAuthStartMode('signin'); navigate('signin'); }}
              onCreateAccount={() => { setAuthStartMode('signup'); navigate('signin'); }}
              activeLibrary={activeLibrary}
              team={team}
              setlists={setlists}
              onRemapService={handleRemapService}
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
              onUpgrade={() => navigate('upgrade')}
              onSignIn={() => { setAuthStartMode('signin'); navigate('signin'); }}
              onCreateAccount={() => { setAuthStartMode('signup'); navigate('signin'); }}
              onSignOut={handleSignOut}
            />
          )}
          {view === 'team' && (
            <TeamScreen
              onBack={goBack}
              onUpgrade={() => navigate('upgrade')}
              onSwitchLibrary={switchWorkspace}
              initialCreate={teamCreateIntent}
              onCreateHandled={() => setTeamCreateIntent(false)}
              defaultSpaceId={settings?.defaultSpaceId || 'personal'}
              onSetDefaultSpace={(id) => setSettings(prev => ({ ...prev, defaultSpaceId: id }))}
            />
          )}
          {view === 'schedule' && (
            <Schedule
              setlists={setlists}
              onBack={goBack}
              onOpenSetlist={goSetlistView}
              viewMode={scheduleView}
              onSetView={setScheduleView}
              clockFormat={settings?.clockFormat || '12h'}
              firstDayOfWeek={settings?.firstDayOfWeek || 'sunday'}
            />
          )}
        </DesktopLayout>
      )}
      {/* Mobile glass nav lives at the App root (not inside <main>) so the
          drawer's transform/will-change doesn't capture its fixed positioning
          or break the glass backdrop-filter. */}
      {['home', 'library', 'setlists', 'settings', 'account', 'team', 'setlist-view', 'upgrade', 'schedule'].includes(view) && !drawerOpen && (
        <BottomNav
          activeView={view}
          onNavigate={goToMainView}
          activeLibrary={activeLibrary}
          onNewSong={isTeamReadOnly ? null : () => openNewSongModal()}
          onNewSetlist={isTeamReadOnly ? null : () => goSetlistBuild()}
          scheduleView={scheduleView}
          onToggleScheduleView={() => setScheduleView(v => (v === 'list' ? 'calendar' : 'list'))}
          onPlay={
            view === 'setlist-view' && currentSetlist
              ? () => goSetlistPerformance(currentSetlist)
              : view === 'setlists' && previewSetlistId
                ? () => {
                    const sl = setlists.find(s => s.id === previewSetlistId);
                    if (sl) goSetlistPerformance(sl);
                  }
                : null
          }
        />
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
          hasUnreadNotifications={hasUnreadNotifications}
          onOpenSettings={() => { setDrawerOpen(false); goToMainView('settings'); }}
          onOpenPlan={() => { setDrawerOpen(false); goToMainView('settings', { settingsPanel: 'plan' }); }}
          onOpenNotifications={() => { setDrawerOpen(false); setNotifTrayOpen(true); }}
          onOpenHelp={() => { setDrawerOpen(false); navigate('help'); }}
          onOpenWhatsNew={() => {
            setDrawerOpen(false);
            goToMainView('settings', { settingsPanel: 'whatsnew' });
          }}
          hasNewChangelog={settings?.lastChangelogVersion !== __APP_VERSION__}
          onSignOut={async () => { setDrawerOpen(false); await handleSignOut(); }}
          onUpgrade={() => { setDrawerOpen(false); navigate('upgrade'); }}
          onSignIn={() => { setDrawerOpen(false); setAuthStartMode('signin'); navigate('signin'); }}
          onCreateAccount={() => { setDrawerOpen(false); setAuthStartMode('signup'); navigate('signin'); }}
          onOpenTeam={() => { setDrawerOpen(false); goTeam(); }}
          teams={teams}
          activeLibrary={activeLibrary}
          setActiveLibrary={switchWorkspace}
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
          notifications={mergedNotifications}
          onUpdateSchedule={updateSchedule}
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

      {/* Workspace destination picker for move/copy from the song kebab. */}
      {moveCopyDialog && (
        <WorkspacePickerDialog
          open
          title={moveCopyDialog.action === 'move' ? 'Move song to…' : 'Copy song to…'}
          description={(() => {
            const t = songs.find(s => s.id === moveCopyDialog.songId)?.title || 'this song';
            return moveCopyDialog.action === 'move'
              ? `"${t}" will be moved out of the current workspace.`
              : `A copy of "${t}" will be added. The original stays put.`;
          })()}
          confirmLabel={moveCopyDialog.action === 'move' ? 'Move' : 'Copy'}
          workspaces={moveCopyWorkspaces}
          onSelect={performMoveCopy}
          onClose={() => setMoveCopyDialog(null)}
        />
      )}

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
    </WorkspaceProvider>
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

