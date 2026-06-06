import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import ChartView from './ChartView';
import { parseSongMd, songToMd, generateId, splitMd, replaceFrontmatter, parseFrontmatterFields, serializeFrontmatterFields } from '../parser';
import { ALL_KEYS } from '../music';
import { addArrangement, deleteArrangement, renameArrangement, setDefaultArrangement, withArrangement, getArrangement, songFromFlat } from '../arrangements';
import WriteTab from './editor/WriteTab';
import ArrangeTab from './editor/ArrangeTab';
import MetadataPanel from './editor/MetadataPanel';
import StructureEditor from './editor/StructureEditor';
import ArrangementMenu, { EditArrangementsDialog } from './editor/ArrangementMenu';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SegmentedControl } from './ui/SegmentedControl';
import PromptDialog from './ui/PromptDialog';
import { toast } from './ui/use-toast';
import { useConfirm } from './ui/useConfirmHook';
import { headerFrostStyle } from '../lib/headerFrost';

// The two edit modes. Arrange (visual) is the primary canvas; Source is the
// raw-markdown power-user escape hatch — hence the compact </> label.
const MODE_OPTIONS = [
  {
    value: 'arrange',
    label: (
      <span className="inline-flex items-center gap-1.5">
        Arrange
        <span
          className="text-[9px] font-bold leading-none px-1 py-0.5 rounded-full"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
        >
          BETA
        </span>
      </span>
    ),
  },
  { value: 'write', label: 'Advanced' },
];

const TIME_OPTIONS = ['4/4', '3/4', '6/8', '7/8', '12/8', '2/4', '5/4'];
const CUSTOM_TIME = '__custom__';

function TimeSignatureControl({ value, onChange }) {
  const isCustom = value && !TIME_OPTIONS.includes(value);
  const [customOpen, setCustomOpen] = useState(isCustom);
  const [numerator, denominator] = (isCustom ? value.split('/') : ['', '']);

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === CUSTOM_TIME) {
      setCustomOpen(true);
      // Don't clear an existing custom value; otherwise start blank.
      if (!isCustom) onChange('');
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
    <select
      value={value || ''}
      onChange={handleSelect}
      className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1.5 py-0.5 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none cursor-pointer"
      aria-label="Time signature"
    >
      <option value="">—</option>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      <option value={CUSTOM_TIME}>Custom…</option>
    </select>
  );
}

const DEFAULT_MD = `---
title: New Song
artist:
key: C
---

## Verse 1

`;

export default function Editor({ song, onSave, onBack, onDelete, onMove, onCopy, activeLibrary, team, importProgress, customSectionTypes, readOnly = false, chartDefaults = {}, initialArrangementId = null }) {
  const confirm = useConfirm();

  // Working copy of the song we're editing. For a new song, songFromFlat
  // produces a fresh v2 song with one "Main Arrangement". For existing v2
  // songs, we hold a reference and patch arrangements as the user edits.
  const [workingSong, setWorkingSong] = useState(() => {
    if (song && Array.isArray(song.arrangements)) return song;
    if (song) return songFromFlat(song);
    return songFromFlat({ id: generateId(), title: 'New Song', artist: '', key: 'C', tempo: null, time: '', sections: [] });
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
  const [activeTab, setActiveTab] = useState('arrange');
  const [preview, setPreview] = useState(null);
  const [metaPanelOpen, setMetaPanelOpen] = useState(!song);
  const isWide = useMediaQuery('(min-width: 1024px)');
  // Side preview defaults ON only on roomy screens (>=1280). At 1024-1279
  // (iPad landscape) it stays collapsed so the editor keeps full width while
  // typing; the user can still toggle it on as a 42%-wide panel.
  const [previewEnabled, setPreviewEnabled] = useState(
    () => typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1280px)').matches
      : true,
  );
  const showSidePreview = isWide && previewEnabled;
  const [editArrangementsOpen, setEditArrangementsOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState(null);
  const textareaRef = useRef(null);
  const isDirty = md !== savedMd;

  // Parse md → preview with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setPreview(parseSongMd(md)); }
      catch { setPreview(null); }
    }, 300);
    return () => clearTimeout(timer);
  }, [md]);

  const handleSave = useCallback(() => {
    if (!preview) return;
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
      sections: Array.isArray(preview.sections) ? preview.sections : a.sections,
    }));
    nextSong.title = preview.title || nextSong.title;
    nextSong.artist = preview.artist || nextSong.artist;
    if (preview.ccli !== undefined) nextSong.ccli = preview.ccli;
    if (preview.tags !== undefined) nextSong.tags = preview.tags;
    if (preview.spotify !== undefined) nextSong.spotify = preview.spotify;
    if (preview.youtube !== undefined) nextSong.youtube = preview.youtube;
    setWorkingSong(nextSong);
    onSave(nextSong);
    setSavedMd(md);
    toast({
      title: 'Song saved',
      description: preview.title || 'Untitled',
    });
  }, [preview, onSave, md, workingSong, activeArrangementId]);

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
    }
    onBack?.();
  }, [isDirty, confirm, onBack]);

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

  const handleImport = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      if (md.trim()) {
        const ok = await confirm({
          title: 'Replace content?',
          description: 'The current editor content will be replaced with the clipboard contents.',
          confirmLabel: 'Replace',
        });
        if (!ok) return;
      }
      setMd(text);
    } catch {
      toast({
        title: 'Clipboard unavailable',
        description: 'Try pasting directly into the editor.',
        variant: 'error',
      });
    }
  }, [md, confirm]);

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
  const currentKey = fmFields.key || 'C';
  const currentTempo = fmFields.tempo ?? '';
  const currentTime = fmFields.time ?? '';

  // Structure ribbon data (always-visible, edited via the frontmatter
  // `structure` field). availableSections is derived from the body's
  // `## Section` headers so the picker offers the song's real sections.
  const structureValue = fmFields.structure;
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

  // The Advanced (raw) editor shows only the song body — frontmatter is owned
  // entirely by Song Details, so IDs and metadata can't be broken by hand.
  const setBody = useCallback((newBody) => {
    const { frontmatter } = splitMd(md);
    setMd(frontmatter ? `---\n${frontmatter}\n---\n\n${newBody}` : newBody);
  }, [md]);

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
            onUndo={handleUndo}
            onRedo={handleRedo}
            onImport={handleImport}
          />
        );
      case 'arrange':
        return <ArrangeTab md={md} onChange={setMd} customSectionTypes={customSectionTypes} />;
      default:
        return <ArrangeTab md={md} onChange={setMd} />;
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

  const handleMoveSong = useCallback(async () => {
    if (!song || !onMove || !team) return;
    const target = activeLibrary === 'personal' ? team.id : 'personal';
    const label = activeLibrary === 'personal' ? team.name : 'Personal Library';
    const ok = await confirm({
      title: `Move to ${label}?`,
      description: activeLibrary === 'personal'
        ? `"${preview?.title || song.title || 'this song'}" will be shared with everyone in ${team.name}.`
        : `"${preview?.title || song.title || 'this song'}" will be moved out of ${team.name} and into your personal library only.`,
      confirmLabel: 'Move',
    });
    if (ok) onMove(target);
  }, [song, onMove, team, activeLibrary, confirm, preview]);

  const handleCopySong = useCallback(async () => {
    if (!song || !onCopy || !team) return;
    const target = activeLibrary === 'personal' ? team.id : 'personal';
    const label = activeLibrary === 'personal' ? team.name : 'Personal Library';
    const ok = await confirm({
      title: `Copy to ${label}?`,
      description: activeLibrary === 'personal'
        ? `A copy of "${preview?.title || song.title || 'this song'}" will be added to ${team.name}. The original stays in your personal library.`
        : `A copy of "${preview?.title || song.title || 'this song'}" will be added to your personal library. The original stays in ${team.name}.`,
      confirmLabel: 'Copy',
    });
    if (ok) onCopy(target);
  }, [song, onCopy, team, activeLibrary, confirm, preview]);

  return (
    <div className="h-full bg-[var(--ds-background-200)] flex flex-col">
      {/* ─── Unified header. Row 1: title (taps to toggle Song Details) +
          mode toggle / preview / actions. Row 2: arrangement + key/tempo/time.
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
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left bg-transparent border-none cursor-pointer p-0"
          >
            <h1 className="text-heading-18 text-[var(--text-1)] m-0 leading-tight truncate">
              {fmFields.title || (song ? 'Edit Song' : 'New Song')}
            </h1>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-[var(--ds-gray-600)] transition-transform duration-200 ${metaPanelOpen ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

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
            <SegmentedControl size="sm" value={activeTab} onChange={setActiveTab} options={MODE_OPTIONS} />
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
            {song && onMove && team && (
              <Button variant="secondary" size="sm" onClick={handleMoveSong} className="hidden md:inline-flex">
                Move to {activeLibrary === 'personal' ? 'Team' : 'Personal'}
              </Button>
            )}
            {song && onCopy && team && (
              <Button variant="secondary" size="sm" onClick={handleCopySong} className="hidden md:inline-flex">
                Copy to {activeLibrary === 'personal' ? 'Team' : 'Personal'}
              </Button>
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

        {/* Row 2: arrangement + key / tempo / time */}
        <div className="flex items-center gap-2 flex-wrap px-3 sm:px-4 pb-2">
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
            <select
              value={currentKey}
              onChange={e => updateField('key', e.target.value)}
              className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1.5 py-1 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none cursor-pointer"
              aria-label="Key"
            >
              {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <input
              type="number"
              value={currentTempo}
              onChange={e => updateField('tempo', e.target.value)}
              className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1.5 py-1 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none w-14"
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

        {/* Row 3: structure summary (opens a focused sheet to edit) */}
        <div className="px-3 sm:px-4 pb-2">
          <StructureEditor
            value={structureValue}
            availableSections={availableSections}
            onChange={(next) => updateField('structure', next)}
            autoSeed={false}
          />
        </div>
      </header>

      {/* ─── Content Area — full-width chrome on top, then the editor + live
          preview side-by-side beneath it, so opening Song Details / the
          Structure ribbon pushes both columns evenly. ─── */}
      <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">

        {/* ─── Song Details (collapsible, toggled from the title chevron) ─── */}
        {metaPanelOpen && (
          <div className="shrink-0 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] px-4 sm:px-6 py-2" style={headerFrostStyle}>
            <MetadataPanel
              md={md}
              onChange={setMd}
              isOpen
              keyHistory={workingSong.keyHistory}
            />
          </div>
        )}

          {/* ─── Editor + preview row ─── */}
          <div className="flex-1 min-h-0 flex w-full overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col w-full border-r border-[var(--ds-gray-300)]">
              <div className={`flex-1 min-h-0 flex flex-col w-full ${activeTab === 'write' ? 'overflow-auto py-[18px] px-0' : 'overflow-hidden'}`}>
                <div className="wide-container w-full h-full flex flex-col">
                  {renderTab()}
                </div>
              </div>
            </div>

        {/* RIGHT COLUMN (Preview) */}
        {showSidePreview && preview && (
          <aside
            className="w-[42%] min-w-[340px] max-w-[560px] shrink-0 border-l border-[var(--ds-gray-300)] flex flex-col bg-[var(--ds-background-100)]"
          >
            <div className="px-4 py-2 border-b border-[var(--ds-gray-200)] text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)] sticky top-0 bg-[var(--ds-background-100)] z-10 shadow-sm">
              Preview
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <ChartView song={preview} isPreview {...chartDefaults} />
            </div>
          </aside>
        )}
        </div>
      </div>

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
        <div className="w-full px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={handleBack}>{readOnly ? 'Back' : 'Cancel'}</Button>
          {!readOnly && <Button variant="brand" size="md" onClick={handleSave} disabled={!preview || !onSave}>Save</Button>}
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
