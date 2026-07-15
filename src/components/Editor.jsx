import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import ChartView from './ChartView';
import AaMenu from './AaMenu';
import { parseSongMd, songToMd, generateId, splitMd, replaceFrontmatter, parseFrontmatterFields, serializeFrontmatterFields, EXTRA_META_KEYS } from '../parser';
import { keyOptions, transposeChord, transposeKey, keyPrefersSharps } from '../music';
import { isChordToken } from '../importer';
import { addArrangement, deleteArrangement, renameArrangement, setDefaultArrangement, withArrangement, getArrangement, songFromFlat } from '../arrangements';
import { importChartText } from '../lib/importChords';
import { loadVersions, pushVersion } from '../storage';
import WriteTab from './editor/WriteTab';
import ArrangeTabV2 from './editor/ArrangeTabV2';
import TabsTab from './editor/TabsTab';
import MetadataPanel from './editor/MetadataPanel';
import EditorEmptyState from './editor/EditorEmptyState';
import StructureControl from './editor/StructureControl';
import ArrangementMenu, { EditArrangementsDialog } from './editor/ArrangementMenu';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { OverflowMenu } from './ui/OverflowMenu';
import { SegmentedControl } from './ui/SegmentedControl';
import { Tabs } from './ui/Tabs';
import PromptDialog from './ui/PromptDialog';
import { Dialog } from './ui/Dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectSeparator } from './ui/Select';
import { toast } from './ui/use-toast';
import { useConfirm } from './ui/useConfirmHook';
import { headerFrostStyle } from '../lib/headerFrost';
import { useResizablePane } from '../lib/useResizablePane';
import { usePersistentView } from '../lib/usePersistentView';

// The two edit modes. Arrange (visual) is the primary canvas; Source is the
// raw-markdown power-user escape hatch — hence the compact </> label.
const MODE_OPTIONS = [
  { id: 'arrange', label: 'Arrange' },
  { id: 'write', label: 'Advanced' },
];

const TIME_OPTIONS = ['4/4', '3/4', '6/8', '7/8', '12/8', '2/4', '5/4'];
const CUSTOM_TIME = '__custom__';
const TIME_NONE = '__none__'; // Radix SelectItem can't use an empty value

// One shared sizing/skin for the Key / Tempo / Time controls so they read as a
// single, pixel-identical control group (height, border, fill, radius, font).
// Width is set per-control. The Select triggers are <button>s, which a global
// rule floors to 36px (44px on phones) — so the `<input>` tempo box matches via
// the same min-heights, otherwise it renders 4px shorter than the dropdowns.
const META_CTRL_CLS = 'box-border h-9 min-h-9 max-sm:min-h-11 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] px-2 text-label-12 font-mono text-[var(--ds-gray-1000)]';

// Song-Hub-style meta pill (label + mono value) used in the card identity row.
const META_PILL = 'inline-flex items-center gap-1.5 h-9 max-sm:h-11 px-2.5 rounded-[10px] border border-[var(--border-1)] bg-[var(--ds-background-100)]';
const META_PILL_LABEL = 'font-sans text-[11px] text-[var(--ds-gray-600)] select-none';
const META_PILL_VALUE = 'bg-transparent border-0 outline-none p-0 font-mono text-[12.5px] tabular-nums text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)]';

function TimeSignatureControl({ value, onChange, bare = false }) {
  const isCustom = value && !TIME_OPTIONS.includes(value);
  const [customOpen, setCustomOpen] = useState(isCustom);
  const [numerator, denominator] = (isCustom ? value.split('/') : ['', '']);

  const handleSelect = (v) => {
    if (v === CUSTOM_TIME) {
      setCustomOpen(true);
      // Don't clear an existing custom value; otherwise start blank.
      if (!isCustom) onChange('');
    } else if (v === TIME_NONE) {
      setCustomOpen(false);
      onChange('');
    } else {
      setCustomOpen(false);
      onChange(v);
    }
  };

  const setPart = (idx, part) => {
    const sanitized = part.replace(/\D/g, '').slice(0, 2);
    const next = idx === 0
      ? `${sanitized}/${denominator || ''}`
      : `${numerator || ''}/${sanitized}`;
    onChange(next === '/' ? '' : next);
  };

  // In `bare` mode the trigger/inputs are borderless so they can sit inside a
  // meta pill (the pill provides the border/fill).
  const customInputCls = bare
    ? 'w-7 px-0 text-center bg-transparent border-0 outline-none font-mono text-[12.5px] tabular-nums text-[var(--ds-gray-1000)]'
    : `${META_CTRL_CLS} w-9 px-1 text-center outline-none`;

  if (customOpen) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={numerator}
          onChange={e => setPart(0, e.target.value)}
          className={customInputCls}
          aria-label="Time signature beats"
          placeholder="4"
        />
        <span className="text-label-11 text-[var(--ds-gray-600)]">/</span>
        <input
          type="text"
          inputMode="numeric"
          value={denominator}
          onChange={e => setPart(1, e.target.value)}
          className={customInputCls}
          aria-label="Time signature unit"
          placeholder="4"
        />
        <button
          type="button"
          onClick={() => { setCustomOpen(false); onChange(''); }}
          aria-label="Clear custom time signature"
          className="text-label-11 text-[var(--ds-gray-600)] bg-transparent border-none cursor-pointer px-1"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <Select value={value || TIME_NONE} onValueChange={handleSelect}>
      <SelectTrigger
        aria-label="Time signature"
        className={bare
          ? '!h-auto !min-h-0 w-auto gap-0.5 !px-0 !border-0 !bg-transparent !ring-0 focus:!ring-0 font-mono text-[12.5px] tabular-nums text-[var(--ds-gray-1000)]'
          : `${META_CTRL_CLS} w-auto gap-1`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="font-mono">
        <SelectItem value={TIME_NONE}>—</SelectItem>
        {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        <SelectItem value={CUSTOM_TIME}>Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
}

// New songs start with title + key blank on purpose — both are required
// before the song can be saved, so we don't silently default the key to C.
const DEFAULT_MD = `---
title:
artist:
key:
---

## Verse 1

`;

export default function Editor({ song, onSave, onBack, onDirtyChange, importProgress, customSectionTypes, readOnly = false, chartDefaults = {}, initialArrangementId = null, onOpenNewSong }) {
  const confirm = useConfirm();

  // Labs: card-based editor header (step 1 — header card). When off, the
  // original sticky-bar header with the collapsible Song Details panel is used.
  const cardsHeader = !!chartDefaults?.settings?.songEditorCards;

  // Working copy of the song we're editing. For a new song, songFromFlat
  // produces a fresh v2 song with one "Main Arrangement". For existing v2
  // songs, we hold a reference and patch arrangements as the user edits.
  const [workingSong, setWorkingSong] = useState(() => {
    if (song && Array.isArray(song.arrangements)) return song;
    if (song) return songFromFlat(song);
    return songFromFlat({ id: generateId(), title: '', artist: '', key: 'C', tempo: null, time: '', sections: [] });
  });

  const [activeArrangementId, setActiveArrangementId] = useState(() => {
    // Open the arrangement the user was viewing when they hit Edit, not always
    // the default. Falls back to the default / first when none was passed.
    if (initialArrangementId && workingSong.arrangements?.some(a => a.id === initialArrangementId)) {
      return initialArrangementId;
    }
    return workingSong.defaultArrangementId || workingSong.arrangements?.[0]?.id;
  });

  const initialMd = useMemo(() => {
    const arr = getArrangement(workingSong, activeArrangementId);
    return song ? songToMd(workingSong, arr) : DEFAULT_MD;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [md, setMd] = useState(initialMd);
  const [savedMd, setSavedMd] = useState(initialMd);
  // ── Undo / redo — a session history of md snapshots, so the visual Arrange
  // canvas (and Source) can step back. Rapid edits within a short window coalesce
  // into one step; a fresh edit clears the redo stack. `timeTravel` marks changes
  // that come from undo/redo so the tracking effect doesn't re-record them.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const prevMdRef = useRef(initialMd);
  const timeTravelRef = useRef(false);
  const lastEditAtRef = useRef(0);
  const [histState, setHistState] = useState({ canUndo: false, canRedo: false });
  // Autosave/draft recovery. We stash the in-progress markdown under a per-song
  // key so a crash or accidental exit doesn't lose work. On mount we surface any
  // draft that differs from the saved content as a restore banner.
  const draftKey = `setlists-md:draft:${song?.id || 'new'}`;
  const [draftFound, setDraftFound] = useState(() => {
    try {
      const d = localStorage.getItem(draftKey);
      return d && d !== initialMd ? d : null;
    } catch { return null; }
  });
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* private mode */ }
  }, [draftKey]);
  // New songs (card layout) open on Arrange behind the New-song mode. Editing an
  // existing song opens on Arrange. Legacy has no Details tab → always Arrange.
  const [activeTab, setActiveTab] = useState('arrange');
  // New-song mode (card layout): a fresh blank song shows a big paste area /
  // import chooser first. Dismissed on "Start blank", or when pasted content is
  // applied. No draft to restore → skip it and go straight to editing.
  const [showNewSong, setShowNewSong] = useState(() => !song && cardsHeader && !draftFound);
  // The paste text in New-song mode — kept here so the preview pane can render a
  // live parse of it before the user commits ("Turn into chart").
  const [newSongDraft, setNewSongDraft] = useState('');
  // Card layout: the raw-markdown editor (WriteTab) opens in a centered dialog
  // instead of a tab — a power-user "Source" escape hatch with paste-import.
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  // Mobile-only: collapse the identity card's meta rows to free editing room.
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const openHistory = useCallback(async () => {
    setVersions(await loadVersions(song?.id));
    setHistoryOpen(true);
  }, [song?.id]);
  const [preview, setPreview] = useState(null);
  const [metaPanelOpen, setMetaPanelOpen] = useState(!song);
  const isWide = useMediaQuery('(min-width: 1024px)');
  // Side preview is ON by default on wide screens; available from every tab
  // via the toggle (wide) / peek (narrow), and resizable.
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const showSidePreview = isWide && previewEnabled;
  // On tablet portrait / phone the side preview is too tight, so narrow screens
  // get a full-height slide-over peek instead.
  const [previewPeekOpen, setPreviewPeekOpen] = useState(false);
  // Empty-state chooser for a brand-new, still-blank song.
  const { width: previewWidth, onPointerDown: onPreviewResize } = useResizablePane({
    storageKey: 'setlists-md:editor-preview-w',
    defaultWidth: 460,
    min: 340,
    max: 720,
  });
  // Editor-local preview display knobs. These intentionally do NOT touch the
  // global display settings — they only restyle this editor's preview pane so
  // you can sanity-check layout without changing how charts read elsewhere.
  const [previewOptsOpen, setPreviewOptsOpen] = useState(false);
  // Preview columns default to 1 and persist per-device (not synced) — the
  // editor preview is a layout sanity-check, independent of global chart
  // defaults, so it shouldn't inherit a 2-column reading preference.
  const [previewColsRaw, setPreviewColsRaw] = usePersistentView('setlists-md:editor-preview-cols', '1');
  const previewCols = previewColsRaw === '2' ? 2 : 1;
  const setPreviewCols = (n) => setPreviewColsRaw(String(n));
  const [previewLyricSize, setPreviewLyricSize] = useState(
    () => (typeof chartDefaults.settings?.defaultFontSize === 'number' ? chartDefaults.settings.defaultFontSize : 16),
  );
  const [previewChordSize, setPreviewChordSize] = useState(
    () => (typeof chartDefaults.settings?.chordFontSize === 'number' ? chartDefaults.settings.chordFontSize : 14),
  );
  const [previewLinkSizes, setPreviewLinkSizes] = useState(true);
  // Card layout: the preview gets the real "Aa" display popover, wired to the
  // GLOBAL display settings (a faithful preview — same as the chart's Aa).
  const [aaAnchor, setAaAnchor] = useState(null);
  const closeAa = useCallback(() => setAaAnchor(null), []);
  // Read the rect synchronously in the handler — React nulls `currentTarget`
  // once the handler returns, so reading it inside the state updater crashes.
  const toggleAa = (e) => { const r = e.currentTarget.getBoundingClientRect(); setAaAnchor(a => (a ? null : r)); };
  // A SECOND Aa scope — the editing CANVAS (Arrange cards). Per-device, separate
  // from the chart/preview settings: notation + text sizes only (see AaMenu
  // chartControls={false}). It restyles how you read the cards while editing,
  // never how charts render elsewhere.
  const [canvasAaAnchor, setCanvasAaAnchor] = useState(null);
  const closeCanvasAa = useCallback(() => setCanvasAaAnchor(null), []);
  const toggleCanvasAa = (e) => { const r = e.currentTarget.getBoundingClientRect(); setCanvasAaAnchor(a => (a ? null : r)); };
  const [canvasLyricRaw, setCanvasLyricRaw] = usePersistentView('setlists-md:editor-canvas-lyric', '16');
  const [canvasChordRaw, setCanvasChordRaw] = usePersistentView('setlists-md:editor-canvas-chord', '12');
  const [canvasNotationRaw, setCanvasNotationRaw] = usePersistentView('setlists-md:editor-canvas-notation', 'letters');
  const canvasLyricSize = parseInt(canvasLyricRaw, 10) || 16;
  const canvasChordSize = parseInt(canvasChordRaw, 10) || 12;
  const canvasNotation = canvasNotationRaw || 'letters';
  const [editArrangementsOpen, setEditArrangementsOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState(null);
  const textareaRef = useRef(null);
  const isDirty = md !== savedMd;

  // Surface dirty state to the app shell so global navigation (browser back,
  // top-nav, notifications) can prompt before discarding — mirrors the setlist
  // builder. Clear the flag on unmount so a stale "dirty" never blocks nav.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  // The Details tab only exists in the card-header layout; if the Labs flag is
  // off (or gets turned off) while it's active, fall back to Arrange. The card
  // layout has no Advanced tab either — raw editing lives in the Source dialog —
  // so 'write' also falls back to Arrange there.
  useEffect(() => {
    if (!cardsHeader && activeTab === 'details') setActiveTab('arrange');
    if (cardsHeader && activeTab === 'write') setActiveTab('arrange');
  }, [cardsHeader, activeTab]);

  // Parse md → preview with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setPreview(parseSongMd(md)); }
      catch { setPreview(null); }
    }, 300);
    return () => clearTimeout(timer);
  }, [md]);

  // Debounced draft autosave. Only writes while dirty; cleared explicitly on
  // save/discard so we never wipe a recoverable draft on the first render.
  useEffect(() => {
    if (md === savedMd) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(draftKey, md); } catch { /* private mode */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [md, savedMd, draftKey]);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    // Guardrail: a song must have a title and a key before it can be saved.
    // Read straight from the frontmatter so a blank key isn't masked by the
    // parser's 'C' default.
    const fm = parseFrontmatterFields(splitMd(md).frontmatter);
    const hasTitle = !!(fm.title || '').trim();
    const hasKey = !!(fm.key || '').trim();
    if (!hasTitle || !hasKey) {
      toast({
        title: 'Almost there',
        description: !hasTitle && !hasKey ? 'Add a title and key first.' : !hasTitle ? 'Add a title first.' : 'Add a key first.',
        variant: 'error',
      });
      return;
    }
    // Build the next v2 song by patching the active arrangement's content
    // from the freshly parsed preview, plus carrying over the song-level
    // fields the preview frontmatter exposes (title/artist/etc).
    const nextSong = withArrangement(workingSong, activeArrangementId, (a) => ({
      ...a,
      key: preview.key,
      tempo: preview.tempo,
      time: preview.time,
      capo: preview.capo,
      notes: preview.notes,
      structure: Array.isArray(preview.structure) ? preview.structure : a.structure,
      structureMode: preview.structureMode || 'auto',
      sections: Array.isArray(preview.sections) ? preview.sections : a.sections,
      tabLibrary: Array.isArray(preview.tabLibrary) ? preview.tabLibrary : a.tabLibrary,
    }));
    nextSong.title = preview.title || nextSong.title;
    nextSong.artist = preview.artist || nextSong.artist;
    if (preview.ccli !== undefined) nextSong.ccli = preview.ccli;
    if (preview.tags !== undefined) nextSong.tags = preview.tags;
    if (preview.spotify !== undefined) nextSong.spotify = preview.spotify;
    if (preview.youtube !== undefined) nextSong.youtube = preview.youtube;
    // Carry the extended descriptive metadata (song-level) onto the saved song.
    for (const k of EXTRA_META_KEYS) {
      if (preview[k] !== undefined) nextSong[k] = preview[k];
    }
    // onSave may prompt (e.g. duplicate-title guard) and return false if the
    // user backs out — don't claim "saved" or clear the draft in that case.
    const result = await onSave(nextSong);
    if (result === false) return;
    setWorkingSong(nextSong);
    setSavedMd(md);
    clearDraft();
    setDraftFound(null);
    if (nextSong.id) pushVersion(nextSong.id, md); // best-effort version history
    toast({
      title: 'Song saved',
      description: preview.title || 'Untitled',
    });
  }, [preview, onSave, md, workingSong, activeArrangementId, clearDraft]);

  // Switch the textarea content to a different arrangement. Saves the
  // current edits into workingSong first so the user doesn't lose them.
  const switchArrangement = useCallback((nextArrId) => {
    if (nextArrId === activeArrangementId) return;
    let next = workingSong;
    if (preview && isDirty) {
      next = withArrangement(workingSong, activeArrangementId, (a) => ({
        ...a,
        key: preview.key, tempo: preview.tempo, time: preview.time,
        capo: preview.capo, notes: preview.notes,
        structure: preview.structure, sections: preview.sections,
        tabLibrary: Array.isArray(preview.tabLibrary) ? preview.tabLibrary : a.tabLibrary,
      }));
      setWorkingSong(next);
    }
    const arr = getArrangement(next, nextArrId);
    const newMd = songToMd(next, arr);
    setActiveArrangementId(nextArrId);
    setMd(newMd);
    setSavedMd(newMd);
  }, [activeArrangementId, workingSong, preview, isDirty]);

  const handleAddArrangement = useCallback(() => {
    setPromptConfig({
      title: 'New arrangement',
      label: 'Name',
      placeholder: `Arrangement ${(workingSong.arrangements?.length || 0) + 1}`,
      initialValue: '',
      confirmLabel: 'Create',
      onSubmit: (name) => {
        // Seed from the main (default) arrangement so the new one starts as a
        // full copy of the song rather than an empty shell.
        const seedArr = getArrangement(workingSong, workingSong.defaultArrangementId);
        const { song: nextSong, arrangementId: newId } = addArrangement(workingSong, name, seedArr);
        setWorkingSong(nextSong);
        const arr = getArrangement(nextSong, newId);
        const newMd = songToMd(nextSong, arr);
        setActiveArrangementId(newId);
        setMd(newMd);
        setSavedMd(newMd);
        toast({ title: 'Arrangement added', description: name });
      },
    });
  }, [workingSong]);

  const handleRenameArrangement = useCallback(() => {
    const current = getArrangement(workingSong, activeArrangementId);
    setPromptConfig({
      title: 'Rename arrangement',
      label: 'Name',
      placeholder: 'Arrangement name',
      initialValue: current?.name || '',
      confirmLabel: 'Rename',
      onSubmit: (name) => {
        const next = renameArrangement(workingSong, activeArrangementId, name);
        setWorkingSong(next);
        // Reseed md so frontmatter shows the new name
        const arr = getArrangement(next, activeArrangementId);
        setMd(songToMd(next, arr));
        setSavedMd(songToMd(next, arr));
      },
    });
  }, [workingSong, activeArrangementId]);

  // Delete a specific arrangement by id (the dropdown's × delete; can be a
  // non-active arrangement). If we delete the one we're currently editing,
  // switch the editor to the new default arrangement.
  const handleDeleteArrangementById = useCallback((id) => {
    if ((workingSong.arrangements?.length || 0) <= 1) return;
    const next = deleteArrangement(workingSong, id);
    setWorkingSong(next);
    if (id === activeArrangementId) {
      const newActive = next.defaultArrangementId;
      const arr = getArrangement(next, newActive);
      setActiveArrangementId(newActive);
      setMd(songToMd(next, arr));
      setSavedMd(songToMd(next, arr));
    }
  }, [workingSong, activeArrangementId]);

  const handleRenameArrangementById = useCallback((id, name) => {
    if (!name || !name.trim()) return;
    setWorkingSong(prev => {
      const next = renameArrangement(prev, id, name.trim());
      // If we renamed the arrangement currently showing in the editor,
      // refresh `md` so the frontmatter reflects the new arrangementName.
      if (id === activeArrangementId) {
        const arr = getArrangement(next, id);
        const newMd = songToMd(next, arr);
        setMd(newMd);
        setSavedMd(newMd);
      }
      return next;
    });
  }, [activeArrangementId]);

  const handleSetDefaultArrangement = useCallback((id) => {
    setWorkingSong(prev => setDefaultArrangement(prev, id));
  }, []);

  const handleBack = useCallback(async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'You have unsaved edits. Leaving now will lose them.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      });
      if (!ok) return;
      clearDraft();
    }
    onBack?.();
  }, [isDirty, confirm, onBack, clearDraft]);

  // Warn before browser/tab close on unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Record md changes into the undo stack (skips undo/redo-driven changes).
  useEffect(() => {
    if (md === prevMdRef.current) return;
    if (timeTravelRef.current) { timeTravelRef.current = false; prevMdRef.current = md; return; }
    const now = Date.now();
    const coalesce = now - lastEditAtRef.current < 400 && undoStackRef.current.length > 0;
    if (!coalesce) {
      undoStackRef.current.push(prevMdRef.current);
      if (undoStackRef.current.length > 200) undoStackRef.current.shift();
    }
    lastEditAtRef.current = now;
    redoStackRef.current = [];
    prevMdRef.current = md;
    setHistState({ canUndo: undoStackRef.current.length > 0, canRedo: false });
  }, [md]);

  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) return;
    const prev = undoStackRef.current.pop();
    redoStackRef.current.push(prevMdRef.current);
    timeTravelRef.current = true;
    prevMdRef.current = prev;
    setMd(prev);
    setHistState({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 });
  }, []);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(prevMdRef.current);
    timeTravelRef.current = true;
    prevMdRef.current = next;
    setMd(next);
    setHistState({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 });
  }, []);

  // Update a single frontmatter field without touching the body
  const updateField = useCallback((key, value) => {
    const fields = parseFrontmatterFields(splitMd(md).frontmatter);
    fields[key] = value;
    setMd(replaceFrontmatter(md, serializeFrontmatterFields(fields)));
  }, [md]);

  // Current field values for the header. We use `??` (not `||`) so a
  // cleared tempo field doesn't snap back to 120 mid-edit, and an empty
  // time signature stays empty instead of forcing 4/4.
  // Read musical metadata straight from the md frontmatter (synchronous on
  // every keystroke) rather than the 300ms-debounced `preview`, so the
  // Key/Tempo/Time inputs never lag or drop fast-typed digits.
  const fmFields = useMemo(
    () => parseFrontmatterFields(splitMd(md).frontmatter),
    [md],
  );
  const currentKey = fmFields.key || '';
  const currentTempo = fmFields.tempo ?? '';
  const currentTime = fmFields.time ?? '';
  // Title is edited via a LOCAL draft, not read straight back from the parsed
  // frontmatter — the frontmatter round-trip trims values, so a just-typed
  // trailing space would vanish before the next character (making multi-word
  // titles impossible). We only re-adopt the parsed title when it differs from
  // the draft *after trimming* (a real external change: paste, undo, arrangement
  // switch), never for our own in-progress trailing space.
  const [titleDraft, setTitleDraft] = useState(fmFields.title || '');
  if ((fmFields.title || '') !== (titleDraft || '').trim()) {
    setTitleDraft(fmFields.title || '');
  }
  const setTitle = useCallback((v) => { setTitleDraft(v); updateField('title', v); }, [updateField]);
  // The Key selector is a *relabel* (it never moves the chords), which is a
  // surprising foot-gun on an existing song. So lock it while editing one and
  // steer the user to Transpose (which moves chords + relabels together). A
  // brand-new song still needs a free Key picker to satisfy the save guardrail.
  const keyLocked = !!song;

  // Key picker options follow the Accidentals setting (sharps → "F#",
  // otherwise flats → "Gb"); 'auto' stores flats (the byte-stable legacy
  // default). Each row labels both enharmonic spellings (e.g. "F#/Gb") so the
  // option is recognizable either way.
  const keyOpts = keyOptions(
    (chartDefaults.settings?.accidentals || 'auto') === 'sharps' ? 'sharps' : 'flats'
  );

  // New-song guardrails: title + key are mandatory before a save is allowed,
  // and we softly nudge for tempo/time (never blocking). These read the raw
  // frontmatter fields so a blank key isn't masked by the parser's 'C' default.
  const titleSet = !!(fmFields.title || '').trim();
  const keySet = !!currentKey.trim();
  const canSave = titleSet && keySet;
  const missingMetaHint = !titleSet && !keySet
    ? 'Add a title and key to save'
    : !titleSet
      ? 'Add a title to save'
      : !keySet
        ? 'Add a key to save'
        : null;
  const showTempoTimeNudge = canSave && (!currentTempo || !currentTime);

  // Non-blocking pre-save checks — surfaced as a quiet chip, never gates Save.
  const validationIssues = useMemo(() => {
    if (!preview) return [];
    const issues = [];
    const sections = preview.sections || [];
    for (const sec of sections) {
      const hasContent = (sec.lines || []).some(line => (
        typeof line === 'object'
          ? (line.type === 'tab' || line.type === 'tabref' || line.type === 'modulate')
          : (line || '').trim() !== ''
      ));
      if (!hasContent) issues.push(`"${sec.type}" has no lyrics or chords`);
    }
    if (preview.structureMode === 'custom') {
      const live = new Set(sections.map(s => s.type));
      for (const name of (preview.structure || [])) {
        if (!live.has(name)) issues.push(`Play order lists "${name}", which has no section`);
      }
    }
    return issues;
  }, [preview]);

  // Structure ribbon data (always-visible, edited via the frontmatter
  // `structure` field). availableSections is derived from the body's
  // `## Section` headers so the picker offers the song's real sections.
  const availableSections = useMemo(() => {
    const body = splitMd(md).body || '';
    const labels = [];
    const seen = new Set();
    for (const line of body.split('\n')) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) {
        const name = m[1].trim();
        if (name && !seen.has(name)) { seen.add(name); labels.push(name); }
      }
    }
    return labels;
  }, [md]);
  const structureValue = fmFields.structure;
  // Custom slide order (Proclaim-style) vs. auto (follows the arrangement
  // order). Auto is the default; the md carries `structureMode: custom` only
  // when the user has opted into a hand-tuned order.
  const isCustomStructure = fmFields.structuremode === 'custom';
  const setStructureMode = useCallback((custom) => {
    const fields = parseFrontmatterFields(splitMd(md).frontmatter);
    if (custom) {
      fields.structuremode = 'custom';
      // Seed from the current order (or document order) so the user starts
      // from what they already see, then tweaks.
      if (!fields.structure) fields.structure = availableSections.join(', ');
    } else {
      // Auto follows document order — reset the order to match the sections so
      // it re-reads as auto (Arrange edits keep it mirrored from here).
      fields.structuremode = '';
      fields.structure = availableSections.join(', ');
    }
    setMd(replaceFrontmatter(md, serializeFrontmatterFields(fields)));
  }, [md, availableSections]);

  // The Advanced (raw) editor shows only the song body — frontmatter is owned
  // entirely by Song Details, so IDs and metadata can't be broken by hand.
  const setBody = useCallback((newBody) => {
    const { frontmatter } = splitMd(md);
    setMd(frontmatter ? `---\n${frontmatter}\n---\n\n${newBody}` : newBody);
  }, [md]);

  // Convert pasted chord charts (Ultimate-Guitar / ChordPro) into the body.
  // Declared after setBody so it can depend on it without a TDZ.
  const handleImport = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      if (splitMd(md).body.trim()) {
        const ok = await confirm({
          title: 'Replace content?',
          description: 'The clipboard will be converted from a chord chart (Ultimate-Guitar or ChordPro) and replace the current song body.',
          confirmLabel: 'Convert & replace',
        });
        if (!ok) return;
      }
      const { body, meta } = importChartText(text);
      setBody(body);
      // Apply any metadata the source declared, without clobbering existing
      // non-empty fields.
      const fm = parseFrontmatterFields(splitMd(md).frontmatter);
      const patch = {};
      for (const k of ['title', 'artist', 'key', 'tempo', 'time', 'capo']) {
        if (meta[k] && !fm[k]) patch[k] = meta[k];
      }
      if (Object.keys(patch).length) {
        setMd((cur) => replaceFrontmatter(cur, serializeFrontmatterFields({ ...parseFrontmatterFields(splitMd(cur).frontmatter), ...patch })));
      }
      toast({ title: 'Imported', description: 'Converted the pasted chart into the editor.' });
    } catch {
      toast({
        title: 'Clipboard unavailable',
        description: 'Try pasting directly into the editor.',
        variant: 'error',
      });
    }
  }, [md, confirm, setBody]);

  // Apply pasted chord-sheet text directly (used by the New-song canvas). Same
  // conversion as handleImport but from a passed string, and it fills empty
  // frontmatter fields the source declared without clobbering the identity card.
  const applyPastedText = useCallback((text) => {
    if (!text || !text.trim()) return;
    const { body, meta } = importChartText(text);
    setBody(body);
    const fm = parseFrontmatterFields(splitMd(md).frontmatter);
    const patch = {};
    for (const k of ['title', 'artist', 'key', 'tempo', 'time', 'capo']) {
      if (meta[k] && !fm[k]) patch[k] = meta[k];
    }
    if (Object.keys(patch).length) {
      setMd((cur) => replaceFrontmatter(cur, serializeFrontmatterFields({ ...parseFrontmatterFields(splitMd(cur).frontmatter), ...patch })));
    }
    setShowNewSong(false);
    setNewSongDraft('');
    setActiveTab('arrange');
  }, [md, setBody]);

  // Changing the Key field is a *relabel only* — it records what key the song
  // is written in and never touches the chords the user typed. (A composer who
  // notices the song is actually in D, not C, can fix the label without their
  // chords being rewritten into the wrong key.) Moving the actual chords is the
  // separate, explicit `transposeAllChords` action below.
  const changeSongKey = useCallback((targetKey) => {
    updateField('key', targetKey);
  }, [updateField]);

  // Explicit, committed transpose: rewrite every stored chord token by `semis`
  // and shift the key label to match. This is the deliberate "move everything"
  // action, kept distinct from the Key label so it's never triggered by accident.
  const transposeAllChords = useCallback((semis) => {
    if (!semis) return;
    const { frontmatter, body } = splitMd(md);
    const fields = parseFrontmatterFields(frontmatter);
    // Spell the result with sharps/flats per the user's accidental preference;
    // 'auto' follows the new key's conventional spelling.
    const acc = chartDefaults.settings?.accidentals || 'auto';
    const targetKey = transposeKey(fields.key || 'C', semis);
    const preferSharps = acc === 'sharps' ? true : acc === 'flats' ? false : keyPrefersSharps(targetKey);
    const newBody = body.replace(/\[([^\]]+)\]/g, (m, ch) => (isChordToken(ch) ? `[${transposeChord(ch, semis, preferSharps)}]` : m));
    if (fields.key) fields.key = transposeKey(fields.key, semis, preferSharps);
    setMd(`---\n${serializeFrontmatterFields(fields)}\n---\n\n${newBody.replace(/^\n+/, '')}`);
  }, [md, chartDefaults]);

  // The one official structure control — rendered inside both the Arrange and
  // Advanced tabs (not the header) so editing the slide order has a single home.
  const structureRowEl = (
    <StructureControl
      value={structureValue}
      mode={isCustomStructure ? 'custom' : 'auto'}
      sections={availableSections}
      customSectionTypes={customSectionTypes}
      onChangeValue={(next) => updateField('structure', next)}
      onToggleMode={setStructureMode}
    />
  );

  // Render active tab content
  const renderTab = () => {
    switch (activeTab) {
      case 'write':
        return (
          <WriteTab
            md={splitMd(md).body.replace(/^\n+/, '')}
            onChange={setBody}
            textareaRef={textareaRef}
            customSectionTypes={customSectionTypes}
            time={currentTime || '4/4'}
            songKey={currentKey || 'C'}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onImport={handleImport}
            structureRow={structureRowEl}
          />
        );
      case 'tabs':
        return <TabsTab md={md} onChange={setMd} subdivision={chartDefaults.settings?.tabSubdivision || 1} />;
      case 'details':
        // Card-header layout only: Song Details get their own full-width tab
        // (the intuitive home for artist, capo, CCLI, tags, …) instead of the
        // legacy collapsible panel. (Transpose lives in the header meta row.)
        return (
          <div className="flex-1 min-h-0 overflow-y-auto w-full">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-4">
              <MetadataPanel md={md} onChange={setMd} isOpen keyHistory={workingSong.keyHistory} />
            </div>
          </div>
        );
      case 'arrange':
      default:
        // A fresh blank song shows an empty paste canvas in place of the
        // structure + section cards (the rest of the editor chrome stays).
        if (showNewSong) {
          return (
            <EditorEmptyState
              value={newSongDraft}
              onChange={setNewSongDraft}
              onApply={() => applyPastedText(newSongDraft)}
              onDismiss={() => setShowNewSong(false)}
              onImport={onOpenNewSong ? () => onOpenNewSong('import') : undefined}
              onBrowse={onOpenNewSong ? () => onOpenNewSong('browse') : undefined}
              metaReady={titleSet && keySet}
            />
          );
        }
        return <ArrangeTabV2 md={md} onChange={setMd} customSectionTypes={customSectionTypes} notation={canvasNotation} lyricSize={canvasLyricSize} chordSize={canvasChordSize} />;
    }
  };

  // Arrangement picker. In the legacy header it rides with the key/tempo/time on
  // one wrapping row; in the card header it sits beside the title.
  const arrangementMenuEl = (
    <ArrangementMenu
      arrangements={workingSong.arrangements}
      activeId={activeArrangementId}
      defaultId={workingSong.defaultArrangementId}
      onSwitch={switchArrangement}
      onAdd={handleAddArrangement}
      onRename={handleRenameArrangement}
      onDelete={handleDeleteArrangementById}
      onEdit={() => setEditArrangementsOpen(true)}
    />
  );
  // Just the musical metadata controls (Key / Transpose / Tempo / Time) — split
  // out from the arrangement picker so the card header can put the arrangement
  // beside the title and the key/tempo/time on their own row.
  // Key picker. The options come back as 12 majors then 12 minors, so we slice
  // at the boundary and drop a separator between the two groups.
  const keyControlEl = (
    <Select value={currentKey} onValueChange={changeSongKey} disabled={keyLocked}>
      <SelectTrigger
        aria-label="Key"
        title={keyLocked ? 'Key is locked while editing — use Transpose to move the chords and the key together.' : undefined}
        className={`${META_CTRL_CLS} w-auto gap-1 ${keySet ? '' : 'ring-1 ring-[var(--ds-amber-500,#d97706)]'} ${keyLocked ? 'opacity-100 !cursor-default' : ''}`}
      >
        {/* Show only the chosen key in the trigger (e.g. "Gb"), not the
            dual-spelling label, so the pill stays compact. */}
        <span className={keySet ? '' : 'text-[var(--ds-gray-500)]'}>{currentKey || 'Key?'}</span>
      </SelectTrigger>
      <SelectContent className="font-mono">
        {keyOpts.slice(0, 12).map(({ value, label }) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
        <SelectSeparator />
        {keyOpts.slice(12).map(({ value, label }) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  // Explicit transpose: moves the actual chords (and the key label) by a
  // semitone. Separate from the Key field so relabelling never rewrites the
  // user's chords. Extracted so the card layout can relocate it to Details.
  const transposeControlEl = (
    <div className="flex items-center h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] overflow-hidden">
      <IconButton variant="ghost" size="xs" aria-label="Transpose down a semitone" title="Transpose down" onClick={() => transposeAllChords(-1)}>−</IconButton>
      <span className="px-1 text-label-10 uppercase tracking-wide text-[var(--ds-gray-600)] select-none">Tr</span>
      <IconButton variant="ghost" size="xs" aria-label="Transpose up a semitone" title="Transpose up" onClick={() => transposeAllChords(1)}>+</IconButton>
    </div>
  );
  // Tempo + time signature. The tempo input IS the sized box: same h-8 + border
  // + rounded + bg as the Key/Time triggers, with box-border + leading-none so
  // its content line-height can't push it past 32px.
  const tempoTimeEl = (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={currentTempo}
        onChange={e => updateField('tempo', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        className={`${META_CTRL_CLS} w-14 appearance-none leading-none text-center outline-none`}
        placeholder="bpm"
        aria-label="Tempo"
      />
      <TimeSignatureControl
        value={currentTime}
        onChange={v => updateField('time', v)}
      />
    </>
  );
  // Legacy header: key + transpose + tempo + time on one wrapping row.
  const musicMetaControls = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {keyControlEl}
      {transposeControlEl}
      {tempoTimeEl}
    </div>
  );
  // Card identity-card meta controls (Song-Hub design), split into pieces so the
  // header can lay them out as rows. Heights are unified (h-9 desktop / 44px on
  // touch) so the Key chip lines up with the Tempo/Time/Transpose controls.
  // Gold key chip — the song key (doubles as the key dropdown). Distinct from
  // Transpose: this is the *written key*; Transpose *moves* the chords.
  const cardKeyChipEl = (
    <Select value={currentKey} onValueChange={changeSongKey} disabled={keyLocked}>
      <SelectTrigger
        aria-label="Key"
        title={keyLocked ? 'Key is locked while editing — use Transpose to move the chords and the key together.' : undefined}
        className={`h-9 min-h-9 max-sm:min-h-11 w-auto gap-1 px-2.5 rounded-[10px] !border-0 font-mono font-bold text-[13px] focus:!ring-0 ${keySet ? '' : 'ring-1 ring-[var(--ds-amber-500,#d97706)]'} ${keyLocked ? '!cursor-default' : ''}`}
        style={{ background: keySet ? 'var(--chord)' : 'var(--ds-gray-100)', color: keySet ? '#0a0a0a' : 'var(--ds-gray-500)' }}
      >
        <span className="text-[9px] font-sans font-bold uppercase tracking-[0.12em] opacity-60">Key</span>
        <span>{currentKey || '?'}</span>
      </SelectTrigger>
      <SelectContent className="font-mono">
        {keyOpts.slice(0, 12).map(({ value, label }) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
        <SelectSeparator />
        {keyOpts.slice(12).map(({ value, label }) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const cardTempoPillEl = (
    <label className={META_PILL} aria-label="Tempo">
      <span className={META_PILL_LABEL}>Tempo</span>
      <input
        type="text"
        inputMode="numeric"
        value={currentTempo}
        onChange={e => updateField('tempo', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        placeholder="—"
        className={`${META_PILL_VALUE} w-8 text-center`}
      />
    </label>
  );
  const cardTimePillEl = (
    <div className={META_PILL}>
      <span className={META_PILL_LABEL}>Time</span>
      <TimeSignatureControl value={currentTime} onChange={v => updateField('time', v)} bare />
    </div>
  );
  // Transpose = a relative ± action that rewrites every chord and shifts the key
  // label. No key readout here (that would just mirror the Key chip and read as
  // a duplicate); the ± tooltips name the target key instead.
  const cardTransposeEl = (
    <div className="inline-flex items-center h-9 max-sm:h-11 rounded-[10px] border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden">
      <span className="pl-2.5 pr-0.5 text-[11px] text-[var(--ds-gray-600)] select-none">Transpose</span>
      <IconButton variant="ghost" size="sm" aria-label="Transpose down a semitone" title={currentKey ? `Down a semitone (to ${transposeKey(currentKey, -1)})` : 'Transpose down'} onClick={() => transposeAllChords(-1)}>−</IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Transpose up a semitone" title={currentKey ? `Up a semitone (to ${transposeKey(currentKey, 1)})` : 'Transpose up'} onClick={() => transposeAllChords(1)}>+</IconButton>
    </div>
  );
  // Legacy header layout: arrangement picker + key/tempo/time on one wrapping row.
  const musicControls = (
    <div className="flex items-center gap-2 flex-wrap">
      {arrangementMenuEl}
      {musicMetaControls}
    </div>
  );

  // Compact, editor-only preview display controls. Housed in a small popover
  // behind a single icon so the preview strip stays as slim as before. All
  // state is local (previewCols / previewLyricSize / previewChordSize) and is
  // fed to the preview ChartView as prop overrides — never written to the
  // global display settings.
  const clampSize = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const stepLyric = (d) => setPreviewLyricSize(s => {
    const n = clampSize(s + d, 10, 30);
    if (previewLinkSizes) setPreviewChordSize(c => clampSize(c + (n - s), 8, 30));
    return n;
  });
  const stepChord = (d) => setPreviewChordSize(c => clampSize(c + d, 8, 30));
  const sizeStepper = (value, onDown, onUp, label) => (
    <div className="flex items-center gap-0.5">
      <IconButton variant="ghost" size="xs" onClick={onDown} aria-label={`Decrease ${label}`}>−</IconButton>
      <span className="w-6 text-center text-label-11 font-mono tabular-nums text-[var(--ds-gray-700)]">{value}</span>
      <IconButton variant="ghost" size="xs" onClick={onUp} aria-label={`Increase ${label}`}>+</IconButton>
    </div>
  );
  const previewControls = (
    <div className="relative">
      <IconButton
        variant="ghost"
        size="xs"
        aria-label="Preview display options"
        aria-expanded={previewOptsOpen}
        onClick={() => setPreviewOptsOpen(v => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </IconButton>
      {previewOptsOpen && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setPreviewOptsOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent border-none"
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-12 text-[var(--ds-gray-700)]">Columns</span>
              <SegmentedControl
                size="sm"
                value={previewCols}
                onChange={setPreviewCols}
                options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-12 text-[var(--ds-gray-700)]">Lyric size</span>
              {sizeStepper(previewLyricSize, () => stepLyric(-2), () => stepLyric(2), 'lyric size')}
            </div>
            {!previewLinkSizes && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-label-12 text-[var(--ds-gray-700)]">Chord size</span>
                {sizeStepper(previewChordSize, () => stepChord(-2), () => stepChord(2), 'chord size')}
              </div>
            )}
            <label className="flex items-center gap-2 text-label-12 text-[var(--ds-gray-700)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={previewLinkSizes}
                onChange={e => setPreviewLinkSizes(e.target.checked)}
                className="accent-[var(--color-brand)]"
              />
              Link chord size to lyric
            </label>
          </div>
        </>
      )}
    </div>
  );

  // Settings the preview ChartView reads from — the global display settings
  // overridden with the editor-local knobs so nothing here leaks out.
  const previewChartSettings = {
    ...(chartDefaults.settings || {}),
    defaultColumns: previewCols,
    defaultFontSize: previewLyricSize,
    chordFontSize: previewChordSize,
  };
  // Shared preview chart — reused by the desktop side pane and the narrow-screen
  // peek overlay. onUpdateSettings is intentionally dropped so the preview can
  // never write back to global display settings.
  const previewChartEl = preview ? (
    <ChartView
      song={preview}
      isPreview
      {...chartDefaults}
      settings={previewChartSettings}
      defaultColumns={previewCols}
      defaultFontSize={previewLyricSize}
      onUpdateSettings={undefined}
    />
  ) : null;

  // Live preview of the New-song paste box: parse the draft on the fly (merging
  // the identity card's title/key) so the preview pane fills in as you paste,
  // before you commit with "Turn into chart".
  const newSongPreview = useMemo(() => {
    if (!showNewSong || !newSongDraft.trim()) return null;
    try {
      const { body, meta } = importChartText(newSongDraft);
      const fm = { ...parseFrontmatterFields(splitMd(md).frontmatter) };
      for (const k of ['title', 'artist', 'key', 'tempo', 'time', 'capo']) {
        if (meta[k] && !fm[k]) fm[k] = meta[k];
      }
      return parseSongMd(`---\n${serializeFrontmatterFields(fm)}\n---\n\n${body}`);
    } catch { return null; }
  }, [showNewSong, newSongDraft, md]);
  const previewSong = (showNewSong && newSongPreview) ? newSongPreview : (showNewSong ? null : preview);

  // Card layout: a FAITHFUL preview — reads the real global display settings and
  // writes through them (the Aa popover below edits global, same as the chart).
  const cardPreviewChartEl = previewSong ? (
    <ChartView song={previewSong} isPreview {...chartDefaults} />
  ) : null;
  const gSettings = chartDefaults.settings || {};
  const gUpdate = chartDefaults.onUpdateSettings;
  const aaNotation = gSettings.notation || (gSettings.nashville ? 'nashville' : 'letters');
  // An "Aa" trigger styled like Song Hub's, opening the global display popover.
  const aaTriggerEl = (
    <button
      type="button"
      aria-label="Display options"
      aria-expanded={!!aaAnchor}
      onClick={toggleAa}
      className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)] text-[13px] font-bold text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] cursor-pointer"
    >
      Aa
    </button>
  );
  const cardAaMenuEl = (cardsHeader && aaAnchor) ? (
    <AaMenu
      anchorRect={aaAnchor}
      onClose={closeAa}
      settings={gSettings}
      onUpdateSettings={gUpdate}
      lyricSize={typeof gSettings.defaultFontSize === 'number' ? gSettings.defaultFontSize : 16}
      onLyricSize={(n) => gUpdate?.('defaultFontSize', Math.max(10, Math.min(30, n)))}
      chordSize={typeof gSettings.chordFontSize === 'number' ? gSettings.chordFontSize : 14}
      onChordSize={(n) => gUpdate?.('chordFontSize', Math.max(8, Math.min(30, n)))}
      columns={gSettings.defaultColumns ?? 'auto'}
      onColumns={(v) => gUpdate?.('defaultColumns', v)}
      notation={aaNotation}
      onNotation={(v) => { gUpdate?.('notation', v); gUpdate?.('nashville', v === 'nashville'); }}
      onReset={(which) => {
        if (which === 'lyrics') { gUpdate?.('defaultFontSize', undefined); gUpdate?.('chartLyricFont', undefined); gUpdate?.('chartLyricColor', undefined); }
        else if (which === 'chords') { gUpdate?.('chordFontSize', undefined); gUpdate?.('chartChordFont', undefined); gUpdate?.('chartChordColor', undefined); }
        else { gUpdate?.('chartTheme', undefined); gUpdate?.('notation', undefined); gUpdate?.('nashville', undefined); gUpdate?.('defaultColumns', undefined); }
      }}
    />
  ) : null;

  // The CANVAS "Aa" — lives in the editor tab header (next to undo/redo) and
  // controls how the Arrange cards read while editing (notation + text sizes),
  // independent of the chart/preview above.
  const canvasAaTriggerEl = (
    <button
      type="button"
      aria-label="Canvas display options"
      title="Display (editing canvas)"
      aria-expanded={!!canvasAaAnchor}
      onClick={toggleCanvasAa}
      className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)] text-[13px] font-bold text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] cursor-pointer"
    >
      Aa
    </button>
  );
  const canvasAaMenuEl = (cardsHeader && canvasAaAnchor) ? (
    <AaMenu
      anchorRect={canvasAaAnchor}
      onClose={closeCanvasAa}
      chartControls={false}
      settings={{}}
      lyricSize={canvasLyricSize}
      onLyricSize={(n) => setCanvasLyricRaw(String(Math.max(12, Math.min(28, n))))}
      chordSize={canvasChordSize}
      onChordSize={(n) => setCanvasChordRaw(String(Math.max(9, Math.min(24, n))))}
      notation={canvasNotation}
      onNotation={(v) => setCanvasNotationRaw(v)}
      onReset={() => { setCanvasLyricRaw('16'); setCanvasChordRaw('12'); setCanvasNotationRaw('letters'); }}
    />
  ) : null;

  // Show the empty-state chooser for a fresh blank song (no chords/lyrics yet).

  // Shared header action buttons (preview toggle / peek + delete).
  const headerActionsEl = (
    <div className="flex items-center gap-2 shrink-0">
      {importProgress && (
        <span
          className="hidden sm:inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-label-11 font-semibold border"
          style={{ color: 'var(--color-brand-text)', borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-soft)' }}
        >
          Importing {importProgress.current} of {importProgress.total}
          {importProgress.onSkip && (
            <button onClick={importProgress.onSkip} className="bg-transparent border-none p-0 text-[var(--color-brand-text)] underline cursor-pointer text-label-11 font-semibold">Skip</button>
          )}
        </span>
      )}
      {isWide && (
        <Button
          variant={previewEnabled ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setPreviewEnabled(v => !v)}
          aria-pressed={previewEnabled}
        >
          {previewEnabled ? 'Hide preview' : 'Show preview'}
        </Button>
      )}
      {!isWide && !cardsHeader && (
        <IconButton variant="ghost" size="sm" onClick={() => setPreviewPeekOpen(true)} aria-label="Preview">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </IconButton>
      )}
    </div>
  );

  // Edit-mode tabs. The Details tab is card-header only.
  const tabsRowEl = (
    <div className="px-1 sm:px-2">
      <Tabs
        tabs={cardsHeader
          ? [...MODE_OPTIONS, { id: 'tabs', label: 'Tabs' }, { id: 'details', label: 'Details' }]
          : [...MODE_OPTIONS, { id: 'tabs', label: 'Tabs' }]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );

  // ── Card-based header (Labs) ──────────────────────────────────────────────
  // Minimal identity card: inline-editable title beside the arrangement picker
  // (the arrangement changes everything, so it sits with the title), then the
  // key/tempo/time controls on their own row. No cover art, no artist line, no
  // Aa. Song Details live in their own tab; Save/Cancel stay in the bottom bar.
  const cardHeaderEl = (
    <div
      className="shrink-0 rounded-2xl border border-[var(--border-1)] px-3 sm:px-4 py-3 flex flex-col gap-3"
      style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))' }}
    >
      {/* Row 1: title | actions | (mobile collapse). Title gets the whole row
          now — the arrangement moved to row 2 — so it stops truncating. */}
      <div className="flex items-center gap-2">
        <input
          value={titleDraft}
          onChange={e => setTitle(e.target.value)}
          placeholder={song ? 'Song title' : 'Untitled song'}
          aria-label="Song title"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-heading-18 font-semibold text-[var(--text-1)] placeholder:text-[var(--ds-gray-500)] focus:bg-[var(--ds-gray-100)] rounded px-1 -mx-1"
        />
        {/* When collapsed on mobile, surface the key chip so it's still glanceable. */}
        {identityCollapsed && <div className="sm:hidden shrink-0">{cardKeyChipEl}</div>}
        {headerActionsEl}
        <button
          type="button"
          onClick={() => setIdentityCollapsed(v => !v)}
          aria-label={identityCollapsed ? 'Show song details' : 'Hide song details'}
          aria-expanded={!identityCollapsed}
          className="sm:hidden shrink-0 w-8 h-8 grid place-items-center rounded-md text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-100)] cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${identityCollapsed ? '-rotate-90' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {/* Meta rows (collapsible on mobile). Desktop: one wrapping row. Mobile:
          a forced break after Key → row 2 = Arrangement·Key (identity), row 3 =
          Transpose·Tempo·Time (the wide arrangement pill can't share a phone row
          with all three, so the performance controls group on the next line). */}
      {(isWide || !identityCollapsed) && (
        <div className="flex items-center gap-2 flex-wrap">
          {arrangementMenuEl}
          {cardKeyChipEl}
          <div className="basis-full h-0 sm:hidden" aria-hidden="true" />
          {cardTransposeEl}
          {cardTempoPillEl}
          {cardTimePillEl}
        </div>
      )}
    </div>
  );

  // ── Legacy header (default) ───────────────────────────────────────────────
  const legacyHeaderEl = (
    <header
      className="shrink-0 z-[60] sticky top-0 border-b border-[var(--ds-gray-200)] backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14">
        <button
          type="button"
          onClick={() => setMetaPanelOpen(v => !v)}
          aria-expanded={metaPanelOpen}
          aria-label="Song details"
          className="min-w-0 shrink flex items-center gap-1.5 text-left bg-transparent border-none cursor-pointer p-0"
        >
          <h1 className="text-heading-18 text-[var(--text-1)] m-0 leading-tight truncate">
            {fmFields.title || (song ? 'Edit Song' : 'New Song')}
          </h1>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-[var(--ds-gray-600)] transition-transform duration-200 ${metaPanelOpen ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {isWide && musicControls}

        <div className="flex-1 min-w-0" />

        {headerActionsEl}
      </div>

      {/* ─── Song Details (collapsible, drops directly below the title) ─── */}
      {metaPanelOpen && (
        <div className="shrink-0 max-h-[45vh] overflow-y-auto border-t border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] px-4 sm:px-6 py-2" style={headerFrostStyle}>
          {!isWide && (
            <div className="pb-3 mb-3 border-b border-[var(--ds-gray-200)]">
              {musicControls}
            </div>
          )}
          <MetadataPanel
            md={md}
            onChange={setMd}
            isOpen
            keyHistory={workingSong.keyHistory}
          />
        </div>
      )}

      {/* Structure now lives inside the Arrange + Advanced tabs (one official
          source), not in the header. */}

      {tabsRowEl}
    </header>
  );

  // ── Two-card workspace (Labs) ─────────────────────────────────────────────
  // The editing surface and the preview each become their own card, mirroring
  // Song Hub's reader card. The Arrange/Advanced/Tabs/Details tabs live as the
  // left card's pill header.
  // No Advanced tab in the card layout — raw markdown lives in the Source dialog.
  const cardTabList = [{ id: 'arrange', label: 'Arrange' }, { id: 'tabs', label: 'Tabs' }, { id: 'details', label: 'Details' }];
  const cardTabsHeaderEl = (
    <div className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-[var(--border-1)] overflow-x-auto">
      {cardTabList.map(t => {
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            aria-current={active ? 'page' : undefined}
            className={`h-8 sm:h-9 px-2.5 sm:px-4 rounded-lg text-[12px] sm:text-[13.5px] cursor-pointer transition-colors whitespace-nowrap ${active ? 'text-white font-semibold' : 'font-medium text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)]'}`}
            style={{ background: active ? 'var(--color-brand)' : undefined }}
          >
            {t.label}
          </button>
        );
      })}
      <div className="ml-auto shrink-0 flex items-center gap-0.5">
        {/* Undo / redo — session history across the whole editor (Arrange + Source). */}
        <IconButton variant="ghost" size="sm" aria-label="Undo" title="Undo" disabled={!histState.canUndo} onClick={handleUndo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
        </IconButton>
        <IconButton variant="ghost" size="sm" aria-label="Redo" title="Redo" disabled={!histState.canRedo} onClick={handleRedo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
        </IconButton>
        {/* Display (Aa) — the editing CANVAS's notation + text size. Sits by
            undo/redo so it's always reachable. The preview has its own Aa. */}
        {canvasAaTriggerEl}
        {/* Secondary actions folded into a ⋮ so the header stays calm. */}
        <OverflowMenu
          ariaLabel="Editor options"
          items={[
            { label: 'Edit source', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>), onClick: () => setSourceDialogOpen(true) },
            song && { label: 'Version history', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l3 2" /></svg>), onClick: openHistory },
          ].filter(Boolean)}
        />
      </div>
    </div>
  );

  const leftEditorCardEl = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)]">
      {cardTabsHeaderEl}
      <div className={`flex-1 min-h-0 flex flex-col w-full ${activeTab === 'write' ? 'overflow-auto pb-[18px]' : 'overflow-hidden'}`}>
        {renderTab()}
      </div>
    </div>
  );

  const cardWorkAreaEl = (
    <div className="flex-1 min-h-0 flex w-full overflow-hidden">
      {leftEditorCardEl}
      {/* Resize gutter — transparent strip; a slim grip fades in on hover. No line. */}
      {showSidePreview && preview && (
        <div
          onPointerDown={onPreviewResize}
          role="separator"
          aria-label="Resize preview"
          className="group shrink-0 w-3 self-stretch cursor-col-resize flex items-center justify-center touch-none"
        >
          <span className="w-1 h-10 rounded-full bg-[var(--ds-gray-400)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      {showSidePreview && preview && (
        <aside
          style={{ width: previewWidth }}
          className="shrink-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)]"
        >
          <div className="shrink-0 px-3 py-2 border-b border-[var(--border-1)] flex items-center justify-between gap-2">
            <span className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">Preview</span>
            {aaTriggerEl}
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {cardPreviewChartEl}
          </div>
        </aside>
      )}
    </div>
  );

  // Draft recovery as a slim top card (cards layout).
  const draftCardEl = draftFound ? (
    <div className="shrink-0 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-soft)] px-3 py-2 flex items-center gap-3">
      <span className="flex-1 min-w-0 text-label-12 text-[var(--color-brand-text)]">
        Unsaved draft found from a previous session.
      </span>
      <Button variant="brand" size="sm" onClick={() => { setMd(draftFound); setDraftFound(null); }}>Restore</Button>
      <Button variant="ghost" size="sm" onClick={() => { clearDraft(); setDraftFound(null); }}>Discard</Button>
    </div>
  ) : null;

  // Save/Cancel content — shared between the legacy sticky bar and the card.
  const saveCancelInner = (
    <div className="w-full flex items-center justify-end gap-3">
      {cardsHeader && !isWide && (
        <Button variant="secondary" size="md" className="mr-auto" onClick={() => setPreviewPeekOpen(true)}>
          Preview
        </Button>
      )}
      {!readOnly && missingMetaHint && (
        <span className="text-label-11 text-[var(--ds-amber-700,#b45309)] mr-auto flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {missingMetaHint}
        </span>
      )}
      {!readOnly && !missingMetaHint && validationIssues.length > 0 && (
        <div className="relative mr-auto">
          <button
            type="button"
            onClick={() => setIssuesOpen(v => !v)}
            aria-expanded={issuesOpen}
            title={validationIssues.join('\n')}
            className="inline-flex items-center gap-1.5 text-label-11 font-semibold text-[var(--ds-amber-700,#b45309)] bg-transparent border-none cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            {validationIssues.length} to review
          </button>
          {issuesOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} onClick={() => setIssuesOpen(false)} className="fixed inset-0 z-40 cursor-default bg-transparent border-none" />
              <div className="absolute bottom-full left-0 mb-2 z-50 w-72 max-h-52 overflow-y-auto rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-lg p-2.5">
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                  {validationIssues.map((it, i) => (
                    <li key={i} className="text-copy-12 text-[var(--ds-gray-1000)] flex items-start gap-1.5">
                      <span className="text-[var(--ds-amber-700,#b45309)] leading-5">•</span><span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
      {!readOnly && !missingMetaHint && validationIssues.length === 0 && showTempoTimeNudge && (
        <span className="text-label-11 text-[var(--ds-gray-600)] mr-auto italic">
          Tip: add tempo &amp; time so the song shows its feel.
        </span>
      )}
      <Button variant="ghost" size="md" onClick={handleBack}>{readOnly ? 'Back' : 'Cancel'}</Button>
      {!readOnly && <Button variant="brand" size="md" onClick={handleSave} disabled={!preview || !onSave || !canSave}>Save</Button>}
    </div>
  );
  // Cards layout: Save/Cancel as a bottom card (mirrors the draft card).
  const saveCancelCardEl = (
    <div
      className="shrink-0 rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] px-3 sm:px-4 py-2.5"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {saveCancelInner}
    </div>
  );

  return (
    <div className="h-full bg-[var(--ds-background-200)] flex flex-col">
      {cardsHeader ? (
        <div
          className="flex-1 min-h-0 flex flex-col gap-3 px-3 sm:px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          {draftCardEl}
          {cardHeaderEl}
          {cardWorkAreaEl}
          {saveCancelCardEl}
        </div>
      ) : (
      <>
      {legacyHeaderEl}

      {/* ─── Content Area — full-width chrome on top, then the editor + live
          preview side-by-side beneath it, so opening Song Details / the
          Structure ribbon pushes both columns evenly. ─── */}
      <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">

        {/* ─── Draft recovery banner ─── */}
        {draftFound && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-soft)]">
            <span className="flex-1 min-w-0 text-label-12 text-[var(--color-brand-text)]">
              Unsaved draft found from a previous session.
            </span>
            <Button
              variant="brand"
              size="sm"
              onClick={() => { setMd(draftFound); setDraftFound(null); }}
            >
              Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearDraft(); setDraftFound(null); }}
            >
              Discard
            </Button>
          </div>
        )}

          {/* ─── Editor + preview row ─── */}
          <div className="flex-1 min-h-0 flex w-full overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col w-full border-r border-[var(--ds-gray-300)]">
              {/* `pb-[18px]` (not `py-`) keeps the bottom breathing room for the
                  raw textarea WITHOUT pushing the structure band down — so the
                  Advanced structure row lines up with the Arrange one. */}
              <div className={`flex-1 min-h-0 flex flex-col w-full ${activeTab === 'write' ? 'overflow-auto pb-[18px] px-0' : 'overflow-hidden'}`}>
                <div className="w-full h-full flex flex-col">
                  {renderTab()}
                </div>
              </div>
            </div>

        {/* Drag divider — widens/narrows the preview pane (mirrors Library) */}
        {showSidePreview && preview && (
          <div
            onPointerDown={onPreviewResize}
            className="shrink-0 w-1.5 self-stretch cursor-col-resize relative group"
          >
            <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--ds-gray-300)] group-hover:bg-[var(--color-brand)] transition-colors" />
          </div>
        )}

        {/* RIGHT COLUMN (Preview) */}
        {showSidePreview && preview && (
          <aside
            style={{ width: previewWidth }}
            className="shrink-0 flex flex-col bg-[var(--ds-background-100)]"
          >
            <div className="px-3 py-1 border-b border-[var(--ds-gray-200)] sticky top-0 bg-[var(--ds-background-100)] z-10 shadow-sm flex items-center justify-between gap-2">
              <span className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">Preview</span>
              {previewControls}
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {previewChartEl}
            </div>
          </aside>
        )}
        </div>
      </div>
      </>
      )}

      {/* ─── Narrow-screen preview peek (slide-over) ─── */}
      {!isWide && previewPeekOpen && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-[var(--ds-background-100)]"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="shrink-0 px-3 py-2 border-b border-[var(--ds-gray-200)] flex items-center justify-between gap-2">
            <span className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">Preview</span>
            <div className="flex items-center gap-1.5">
              {cardsHeader ? aaTriggerEl : previewControls}
              <IconButton variant="ghost" size="sm" onClick={() => setPreviewPeekOpen(false)} aria-label="Close preview">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {(cardsHeader ? cardPreviewChartEl : previewChartEl) || (
              <div className="flex-1 flex items-center justify-center text-copy-13 text-[var(--ds-gray-600)] italic">
                Nothing to preview yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Legacy sticky bottom action bar (cards layout uses saveCancelCardEl) ─── */}
      {!cardsHeader && (
        <div
          className="shrink-0 sticky bottom-0 z-30 border-t border-[var(--ds-gray-300)] w-full"
          style={{
            background: 'var(--header-bg-blur)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="w-full px-5 py-3">
            {saveCancelInner}
          </div>
        </div>
      )}

      {promptConfig && (
        <PromptDialog
          open
          title={promptConfig.title}
          label={promptConfig.label}
          placeholder={promptConfig.placeholder}
          initialValue={promptConfig.initialValue || ''}
          confirmLabel={promptConfig.confirmLabel}
          onSubmit={(v) => promptConfig.onSubmit?.(v)}
          onClose={() => setPromptConfig(null)}
        />
      )}

      {/* Preview display popover (card layout) — writes GLOBAL display settings. */}
      {cardAaMenuEl}
      {canvasAaMenuEl}

      {/* Version history — restore a previously-saved snapshot of this song. */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} size="md" ariaLabel="Version history">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-1)]">
          <h2 className="text-copy-15 font-semibold text-[var(--ds-gray-1000)] m-0">Version history</h2>
          <IconButton variant="ghost" size="sm" onClick={() => setHistoryOpen(false)} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </IconButton>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {versions.length === 0 ? (
            <p className="text-copy-13 text-[var(--ds-gray-600)] px-3 py-6 text-center m-0">No saved versions yet. Each time you save, a snapshot is kept here.</p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {versions.slice().reverse().map((v, i) => {
                const title = (v.md.match(/^title:\s*(.+)$/m) || [])[1]?.trim() || 'Untitled';
                const isLatest = i === 0;
                return (
                  <li key={v.ts} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--ds-gray-100)]">
                    <div className="flex-1 min-w-0">
                      <div className="text-copy-13 text-[var(--ds-gray-1000)] truncate">{new Date(v.ts).toLocaleString()}{isLatest && <span className="ml-2 text-label-10 uppercase tracking-wide text-[var(--ds-gray-500)]">latest</span>}</div>
                      <div className="text-copy-11 text-[var(--ds-gray-500)] truncate">{title}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setMd(v.md); setHistoryOpen(false); toast({ title: 'Version restored', description: 'Review, then Save to keep it.' }); }}
                    >
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Dialog>

      {/* Source — raw-markdown editor (card layout). Reuses WriteTab so the
          toolbar's paste-import comes along. Edits the same body via setBody. */}
      {cardsHeader && (
        <Dialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} size="xl" ariaLabel="Edit source" className="h-[85vh] flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-1)]">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-600)]"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              <h2 className="text-copy-15 font-semibold text-[var(--ds-gray-1000)] m-0">Source</h2>
            </div>
            <IconButton variant="ghost" size="sm" onClick={() => setSourceDialogOpen(false)} aria-label="Close source">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </IconButton>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <WriteTab
              md={splitMd(md).body.replace(/^\n+/, '')}
              onChange={setBody}
              textareaRef={textareaRef}
              customSectionTypes={customSectionTypes}
              time={currentTime || '4/4'}
              songKey={currentKey || 'C'}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onImport={handleImport}
              structureRow={structureRowEl}
            />
          </div>
        </Dialog>
      )}

      <EditArrangementsDialog
        open={editArrangementsOpen}
        onClose={() => setEditArrangementsOpen(false)}
        arrangements={workingSong.arrangements || []}
        defaultId={workingSong.defaultArrangementId}
        onRename={handleRenameArrangementById}
        onDelete={handleDeleteArrangementById}
        onSetDefault={handleSetDefaultArrangement}
        onAdd={handleAddArrangement}
      />
    </div>
  );
}
