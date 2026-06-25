import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import ChartView from './ChartView';
import { parseSongMd, songToMd, generateId, splitMd, replaceFrontmatter, parseFrontmatterFields, serializeFrontmatterFields, EXTRA_META_KEYS } from '../parser';
import { ALL_KEYS_ALL, transposeChord, transposeKey } from '../music';
import { isChordToken } from '../importer';
import { addArrangement, deleteArrangement, renameArrangement, setDefaultArrangement, withArrangement, getArrangement, songFromFlat } from '../arrangements';
import { importChartText } from '../lib/importChords';
import WriteTab from './editor/WriteTab';
import ArrangeTabV2 from './editor/ArrangeTabV2';
import TabsTab from './editor/TabsTab';
import MetadataPanel from './editor/MetadataPanel';
import StructureRow from './editor/StructureRow';
import ArrangementMenu, { EditArrangementsDialog } from './editor/ArrangementMenu';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SegmentedControl } from './ui/SegmentedControl';
import { Tabs } from './ui/Tabs';
import PromptDialog from './ui/PromptDialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/Select';
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

function TimeSignatureControl({ value, onChange }) {
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

  if (customOpen) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={numerator}
          onChange={e => setPart(0, e.target.value)}
          className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1 py-0.5 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none w-9 text-center"
          aria-label="Time signature beats"
          placeholder="4"
        />
        <span className="text-label-11 text-[var(--ds-gray-600)]">/</span>
        <input
          type="text"
          inputMode="numeric"
          value={denominator}
          onChange={e => setPart(1, e.target.value)}
          className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1 py-0.5 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none w-9 text-center"
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
        className="h-8 w-auto gap-1 px-2 text-label-12 font-mono bg-[var(--ds-gray-100)]"
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

export default function Editor({ song, onSave, onBack, onDirtyChange, onDelete, importProgress, customSectionTypes, readOnly = false, chartDefaults = {}, initialArrangementId = null }) {
  const confirm = useConfirm();

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
  const [activeTab, setActiveTab] = useState('arrange');
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
  const [editArrangementsOpen, setEditArrangementsOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState(null);
  // One-time inline explainer teaching how the structure (slide order) works.
  // Device-local flag, never synced — follows the helpPageSeen precedent.
  const [structureTipSeen, setStructureTipSeen] = useState(() => {
    try { return localStorage.getItem('setlists-md:structure-tip-seen') === '1'; } catch { return false; }
  });
  const dismissStructureTip = useCallback(() => {
    setStructureTipSeen(true);
    try { localStorage.setItem('setlists-md:structure-tip-seen', '1'); } catch { /* private mode */ }
  }, []);
  const textareaRef = useRef(null);
  const isDirty = md !== savedMd;

  // Surface dirty state to the app shell so global navigation (browser back,
  // top-nav, notifications) can prompt before discarding — mirrors the setlist
  // builder. Clear the flag on unmount so a stale "dirty" never blocks nav.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

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

  const handleUndo = useCallback(() => {
    textareaRef.current?.focus();
    document.execCommand('undo');
  }, []);

  const handleRedo = useCallback(() => {
    textareaRef.current?.focus();
    document.execCommand('redo');
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
    const newBody = body.replace(/\[([^\]]+)\]/g, (m, ch) => (isChordToken(ch) ? `[${transposeChord(ch, semis)}]` : m));
    const fields = parseFrontmatterFields(frontmatter);
    if (fields.key) fields.key = transposeKey(fields.key, semis);
    setMd(`---\n${serializeFrontmatterFields(fields)}\n---\n\n${newBody.replace(/^\n+/, '')}`);
  }, [md]);

  // The one official structure control — rendered inside both the Arrange and
  // Advanced tabs (not the header) so editing the slide order has a single home.
  const structureRowEl = (
    <StructureRow
      value={structureValue}
      mode={isCustomStructure ? 'custom' : 'auto'}
      availableSections={availableSections}
      onChangeValue={(next) => updateField('structure', next)}
      onChangeMode={setStructureMode}
      tipSeen={structureTipSeen}
      onDismissTip={dismissStructureTip}
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
      case 'arrange':
        return <ArrangeTabV2 md={md} onChange={setMd} customSectionTypes={customSectionTypes} structureRow={structureRowEl} />;
      default:
        return <ArrangeTabV2 md={md} onChange={setMd} customSectionTypes={customSectionTypes} structureRow={structureRowEl} />;
    }
  };

  const handleDeleteSong = useCallback(async () => {
    if (!song || !onDelete) return;
    const ok = await confirm({
      title: 'Delete song?',
      description: `"${preview?.title || song.title || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete(song.id);
  }, [song, onDelete, confirm, preview]);

  // Arrangement picker + key/tempo/time. Rendered inline on the title row when
  // wide; tucked into the Song Details panel on narrow screens so the header
  // collapses to just title + structure + mode tabs.
  const musicControls = (
    <div className="flex items-center gap-2 flex-wrap">
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
      <div className="flex items-center gap-1.5">
        <Select value={currentKey} onValueChange={changeSongKey}>
          <SelectTrigger
            aria-label="Key"
            className={`h-8 w-auto gap-1 px-2 text-label-12 font-mono bg-[var(--ds-gray-100)] ${keySet ? '' : 'ring-1 ring-[var(--ds-amber-500,#d97706)]'}`}
          >
            <SelectValue placeholder="Key?" />
          </SelectTrigger>
          <SelectContent className="font-mono">
            {ALL_KEYS_ALL.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Explicit transpose: moves the actual chords (and the key label) by a
            semitone. Separate from the Key field so relabelling never rewrites
            the user's chords. */}
        <div className="flex items-center rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] overflow-hidden">
          <IconButton variant="ghost" size="xs" aria-label="Transpose down a semitone" title="Transpose down" onClick={() => transposeAllChords(-1)}>−</IconButton>
          <span className="px-1 text-label-10 uppercase tracking-wide text-[var(--ds-gray-600)] select-none">Tr</span>
          <IconButton variant="ghost" size="xs" aria-label="Transpose up a semitone" title="Transpose up" onClick={() => transposeAllChords(1)}>+</IconButton>
        </div>
        <input
          type="number"
          value={currentTempo}
          onChange={e => updateField('tempo', e.target.value)}
          className="h-8 bg-[var(--ds-gray-100)] rounded-md px-2 text-label-12 font-mono text-[var(--ds-gray-1000)] outline-none w-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min="30" max="300"
          placeholder="bpm"
          aria-label="Tempo"
        />
        <TimeSignatureControl
          value={currentTime}
          onChange={v => updateField('time', v)}
        />
      </div>
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

  // Show the empty-state chooser for a fresh blank song (no chords/lyrics yet).

  return (
    <div className="h-full bg-[var(--ds-background-200)] flex flex-col">
      {/* ─── Unified header. Row 1: title (taps to toggle Song Details) +
          (wide) arrangement/key/tempo/time + preview / actions. Row 2:
          structure summary. Row 3: edit-mode tabs. On narrow screens the music
          controls move into the Song Details panel so the header stays compact.
          Save/Cancel live in the bottom bar so they stay thumb-reachable. ─── */}
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
            {!isWide && (
              <IconButton variant="ghost" size="sm" onClick={() => setPreviewPeekOpen(true)} aria-label="Preview">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </IconButton>
            )}
            {song && onDelete && (
              <IconButton variant="error" size="sm" onClick={handleDeleteSong} aria-label="Delete song">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </IconButton>
            )}
          </div>
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

        {/* Row: edit-mode tabs (Arrange / Advanced / Tabs), left-aligned */}
        <div className="px-1 sm:px-2">
          <Tabs
            tabs={[...MODE_OPTIONS, { id: 'tabs', label: 'Tabs' }]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </header>

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
              <div className={`flex-1 min-h-0 flex flex-col w-full ${activeTab === 'write' ? 'overflow-auto py-[18px] px-0' : 'overflow-hidden'}`}>
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

      {/* ─── Narrow-screen preview peek (slide-over) ─── */}
      {!isWide && previewPeekOpen && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-[var(--ds-background-100)]"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="shrink-0 px-3 py-2 border-b border-[var(--ds-gray-200)] flex items-center justify-between gap-2">
            <span className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">Preview</span>
            <div className="flex items-center gap-1">
              {previewControls}
              <IconButton variant="ghost" size="sm" onClick={() => setPreviewPeekOpen(false)} aria-label="Close preview">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {previewChartEl || (
              <div className="flex-1 flex items-center justify-center text-copy-13 text-[var(--ds-gray-600)] italic">
                Nothing to preview yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Sticky bottom action bar — Cancel + Save, mirrors SetlistBuilder ─── */}
      <div
        className="shrink-0 sticky bottom-0 z-30 border-t border-[var(--ds-gray-300)] w-full"
        style={{
          background: 'var(--header-bg-blur)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="w-full px-5 py-3 flex items-center justify-end gap-3">
          {!readOnly && missingMetaHint && (
            <span className="text-label-11 text-[var(--ds-amber-700,#b45309)] mr-auto flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {missingMetaHint}
            </span>
          )}
          {!readOnly && !missingMetaHint && showTempoTimeNudge && (
            <span className="text-label-11 text-[var(--ds-gray-600)] mr-auto italic">
              Tip: add tempo &amp; time so the song shows its feel.
            </span>
          )}
          <Button variant="ghost" size="md" onClick={handleBack}>{readOnly ? 'Back' : 'Cancel'}</Button>
          {!readOnly && <Button variant="brand" size="md" onClick={handleSave} disabled={!preview || !onSave || !canSave}>Save</Button>}
        </div>
      </div>

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
