import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import ChartView from './ChartView';
import { parseSongMd, songToMd, generateId, splitMd, replaceFrontmatter, parseFrontmatterFields, serializeFrontmatterFields } from '../parser';
import { ALL_KEYS } from '../music';
import { addArrangement, deleteArrangement, renameArrangement, setDefaultArrangement, withArrangement, getArrangement, songFromFlat } from '../arrangements';
import WriteTab from './editor/WriteTab';
import ArrangeTab from './editor/ArrangeTab';
import MetadataPanel from './editor/MetadataPanel';
import { EditArrangementsDialog } from './editor/ArrangementMenu';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Tabs } from './ui/Tabs';
import { toast } from './ui/use-toast';
import { useConfirm } from './ui/useConfirmHook';
import { headerFrostStyle } from '../lib/headerFrost';
import ScreenHeader from './ui/ScreenHeader';

const TAB_LIST = [
  { id: 'write', label: 'Write' },
  {
    id: 'arrange',
    label: (
      <span className="flex items-center gap-1.5">
        Arrange
        <span
          className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
        >
          BETA
        </span>
      </span>
    ),
  },
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

export default function Editor({ song, onSave, onBack, onDelete, onMove, activeLibrary, team, importProgress, customSectionTypes }) {
  const confirm = useConfirm();

  // Working copy of the song we're editing. For a new song, songFromFlat
  // produces a fresh v2 song with one "Main Arrangement". For existing v2
  // songs, we hold a reference and patch arrangements as the user edits.
  const [workingSong, setWorkingSong] = useState(() => {
    if (song && Array.isArray(song.arrangements)) return song;
    if (song) return songFromFlat(song);
    return songFromFlat({ id: generateId(), title: 'New Song', artist: '', key: 'C', tempo: null, time: '', sections: [] });
  });

  const [activeArrangementId, setActiveArrangementId] = useState(
    workingSong.defaultArrangementId || workingSong.arrangements?.[0]?.id
  );

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
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const showSidePreview = isWide && previewEnabled;
  const [editArrangementsOpen, setEditArrangementsOpen] = useState(false);
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

  const handleAddArrangement = useCallback(async () => {
    const name = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt('Arrangement name:', `Arrangement ${(workingSong.arrangements?.length || 0) + 1}`)
      : null;
    if (!name) return;
    const seedArr = getArrangement(workingSong, activeArrangementId);
    const { song: nextSong, arrangementId: newId } = addArrangement(workingSong, name.trim(), seedArr);
    setWorkingSong(nextSong);
    const arr = getArrangement(nextSong, newId);
    const newMd = songToMd(nextSong, arr);
    setActiveArrangementId(newId);
    setMd(newMd);
    setSavedMd(newMd);
    toast({ title: 'Arrangement added', description: name });
  }, [workingSong, activeArrangementId]);

  const handleRenameArrangement = useCallback(() => {
    const current = getArrangement(workingSong, activeArrangementId);
    const name = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt('Rename arrangement:', current?.name || '')
      : null;
    if (!name || !name.trim()) return;
    const next = renameArrangement(workingSong, activeArrangementId, name.trim());
    setWorkingSong(next);
    // Reseed md so frontmatter shows the new name
    const arr = getArrangement(next, activeArrangementId);
    setMd(songToMd(next, arr));
    setSavedMd(songToMd(next, arr));
  }, [workingSong, activeArrangementId]);

  const handleDeleteArrangement = useCallback(async () => {
    if ((workingSong.arrangements?.length || 0) <= 1) return;
    const current = getArrangement(workingSong, activeArrangementId);
    const ok = await confirm({
      title: 'Delete arrangement?',
      description: `"${current?.name || 'This arrangement'}" will be removed from this song.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const next = deleteArrangement(workingSong, activeArrangementId);
    setWorkingSong(next);
    const newActive = next.defaultArrangementId;
    const arr = getArrangement(next, newActive);
    setActiveArrangementId(newActive);
    setMd(songToMd(next, arr));
    setSavedMd(songToMd(next, arr));
  }, [workingSong, activeArrangementId, confirm]);

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
  const currentKey = preview?.key || 'C';
  const currentTempo = preview?.tempo ?? '';
  const currentTime = preview?.time ?? '';

  // Render active tab content
  const renderTab = () => {
    switch (activeTab) {
      case 'write':
        return <WriteTab md={md} onChange={setMd} textareaRef={textareaRef} customSectionTypes={customSectionTypes} />;
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

  return (
    <div className="h-screen bg-[var(--ds-background-200)] flex flex-col">
      {/* ─── Sticky Header — matches the SetlistBuilder pattern: title +
          secondary actions only. The primary Save/Cancel pair lives in the
          bottom action bar so it's always thumb-reachable on mobile. ─── */}
      <ScreenHeader
        title={preview?.title || (song ? 'Edit Song' : 'New Song')}
        actions={
          <>
            {importProgress && (
              <span
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-label-11 font-semibold border"
                style={{
                  color: 'var(--color-brand-text)',
                  borderColor: 'var(--color-brand-border)',
                  background: 'var(--color-brand-soft)',
                }}
              >
                Importing {importProgress.current} of {importProgress.total}
                {importProgress.onSkip && (
                  <button
                    onClick={importProgress.onSkip}
                    className="bg-transparent border-none p-0 text-[var(--color-brand-text)] underline cursor-pointer text-label-11 font-semibold"
                  >
                    Skip
                  </button>
                )}
              </span>
            )}
            {song && onMove && team && (
              <Button variant="secondary" size="sm" onClick={handleMoveSong}>
                Move to {activeLibrary === 'personal' ? 'Team' : 'Personal'}
              </Button>
            )}
            {song && onDelete && (
              <IconButton variant="error" size="sm" onClick={handleDeleteSong} aria-label="Delete song">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </IconButton>
            )}
          </>
        }
      />

      {/* ─── Song Details toggle + Key / tempo / time toolbar +
          collapsible metadata. The toggle and the music meta share one
          row so the header stays compact. ─── */}
      <div className="material-header border-b border-[var(--ds-gray-200)] pb-1" style={headerFrostStyle}>
        <div className="a4-container pt-2 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setMetaPanelOpen(v => !v)}
              aria-expanded={metaPanelOpen}
              className="inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer px-0 py-0.5"
            >
              <span className="text-[10px] text-[var(--ds-gray-600)]">{metaPanelOpen ? '▾' : '▸'}</span>
              <span className="text-label-11 font-semibold text-[var(--ds-gray-600)] uppercase tracking-wider">
                Song Details
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={currentKey}
                onChange={e => updateField('key', e.target.value)}
                className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1.5 py-0.5 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none cursor-pointer"
                aria-label="Key"
              >
                {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input
                type="number"
                value={currentTempo}
                onChange={e => updateField('tempo', e.target.value)}
                className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1.5 py-0.5 text-label-11 font-mono text-[var(--ds-gray-1000)] outline-none w-14"
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

          {/* Collapsible metadata — Song Details now hosts the arrangement
              picker, key history pills, and the rest of the song-level
              fields. The picker is the single trigger Proclaim-style
              dropdown. */}
          <MetadataPanel
            md={md}
            onChange={setMd}
            isOpen={metaPanelOpen}
            onToggle={() => setMetaPanelOpen(v => !v)}
            keyHistory={workingSong.keyHistory}
            arrangements={workingSong.arrangements}
            activeArrangementId={activeArrangementId}
            defaultArrangementId={workingSong.defaultArrangementId}
            onSwitchArrangement={switchArrangement}
            onAddArrangement={handleAddArrangement}
            onRenameArrangement={handleRenameArrangement}
            onDeleteArrangement={handleDeleteArrangementById}
            onEditArrangements={() => setEditArrangementsOpen(true)}
          />

          {/* Tabs + tools */}
          <div className="flex items-center justify-between">
            <Tabs tabs={TAB_LIST} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex items-center gap-1 pb-1">
              {activeTab === 'write' && (
                <>
                  <IconButton variant="ghost" size="xs" onClick={handleUndo} aria-label="Undo">↶</IconButton>
                  <IconButton variant="ghost" size="xs" onClick={handleRedo} aria-label="Redo">↷</IconButton>
                </>
              )}
              <IconButton variant="ghost" size="xs" onClick={handleImport} aria-label="Import from clipboard">📋</IconButton>
              {isWide && (
                <IconButton
                  variant={previewEnabled ? 'active' : 'ghost'}
                  size="xs"
                  onClick={() => setPreviewEnabled(v => !v)}
                  aria-label={previewEnabled ? 'Hide preview' : 'Show preview'}
                  aria-pressed={previewEnabled}
                  title={previewEnabled ? 'Hide preview' : 'Show preview'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content Area — split-screen on wide viewports so the user
          can see the rendered chart while editing. The preview is the
          existing ChartView in isPreview mode, fed by the parsed `preview`
          state we already maintain for save. ─── */}
      <div className="flex-1 min-h-0 flex w-full overflow-hidden">
        <div className={`flex-1 min-h-0 flex flex-col a4-container w-full ${activeTab === 'write' ? 'overflow-auto py-[18px] px-0' : 'overflow-hidden'}`}>
          {renderTab()}
        </div>
        {showSidePreview && preview && (
          <aside
            aria-label="Live chart preview"
            className="hidden md:flex w-[44%] max-w-[640px] border-l border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] flex-col min-h-0 overflow-auto"
          >
            <div className="px-4 py-2 border-b border-[var(--ds-gray-200)] text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">
              Preview
            </div>
            <div className="flex-1 min-h-0 px-4 py-4">
              <ChartView song={preview} isPreview />
            </div>
          </aside>
        )}
      </div>

      {/* ─── Sticky bottom action bar — Cancel + Save, mirrors SetlistBuilder ─── */}
      <div
        className="sticky bottom-0 z-30 border-t border-[var(--ds-gray-300)]"
        style={{
          background: 'var(--header-bg-blur)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="a4-container px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={handleBack}>Cancel</Button>
          <Button variant="brand" size="md" onClick={handleSave} disabled={!preview}>Save</Button>
        </div>
      </div>

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
