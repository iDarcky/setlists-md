import { useMemo, useState, useCallback } from 'react';
import { parseSongMd, songToMd, parseTabBlock } from '../../parser';
import TabBlock from '../TabBlock';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { useConfirm } from '../ui/useConfirmHook';
import TabGridEditor from './TabGridEditorV2';
import { TAB_INSTRUMENTS, instrumentForStrings } from './tabInstruments';

function tabObjectFromEditor(saved) {
  const lines = saved.split('\n');
  const tm = saved.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const time = tm && tm[1] ? tm[1].trim() : null;
  const stringLines = lines.map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const tab = parseTabBlock(stringLines);
  tab.time = time;
  return tab;
}

function nextTabName(library = []) {
  const used = new Set(library.map(t => t.name));
  let n = library.length + 1;
  while (used.has(`Tab ${n}`)) n++;
  return `Tab ${n}`;
}

// Count how many section lines reference a named tab.
function countRefs(sections, name) {
  let n = 0;
  for (const s of sections) for (const l of (s.lines || [])) if (l && typeof l === 'object' && l.type === 'tabref' && l.name === name) n++;
  return n;
}

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// Tabs mode — a library of independent, reusable tab blocks. Create/rename/edit
// them here; place them into sections from Arrange's “+ Add → Tab”. Blocks live
// in a trailing region of the .md and are referenced by name, so one block can
// be reused in many spots and edits propagate everywhere.
export default function TabsTab({ md, onChange, subdivision = 1 }) {
  const song = useMemo(() => { try { return parseSongMd(md); } catch { return null; } }, [md]);
  const library = useMemo(() => song?.tabLibrary || [], [song]);
  const confirm = useConfirm();

  const [instrument, setInstrument] = useState('electric');
  const [editorFor, setEditorFor] = useState(null);
  const [renaming, setRenaming] = useState(null); // { name, value }

  const emit = useCallback((nextSong) => onChange(songToMd(nextSong)), [onChange]);

  const createTab = useCallback((tab) => {
    if (!song) return;
    emit({ ...song, tabLibrary: [...library, { name: nextTabName(library), tab }] });
  }, [song, library, emit]);

  const updateTabContent = useCallback((name, tab) => {
    if (!song) return;
    emit({ ...song, tabLibrary: library.map(t => t.name === name ? { ...t, tab } : t) });
  }, [song, library, emit]);

  const renameTab = useCallback((oldName, raw) => {
    const newName = (raw || '').trim();
    setRenaming(null);
    if (!song || !newName || newName === oldName) return;
    if (library.some(t => t.name === newName)) return; // keep names unique
    emit({
      ...song,
      tabLibrary: library.map(t => t.name === oldName ? { ...t, name: newName } : t),
      sections: song.sections.map(s => ({
        ...s,
        lines: (s.lines || []).map(l => (l && typeof l === 'object' && l.type === 'tabref' && l.name === oldName) ? { ...l, name: newName } : l),
      })),
    });
  }, [song, library, emit]);

  const deleteTab = useCallback(async (name) => {
    if (!song) return;
    const refs = countRefs(song.sections, name);
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: refs > 0
        ? `This tab is placed in ${refs} ${refs === 1 ? 'spot' : 'spots'}. Deleting it removes the block and every placement.`
        : 'This removes the saved tab block.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    emit({
      ...song,
      tabLibrary: library.filter(t => t.name !== name),
      sections: song.sections.map(s => ({
        ...s,
        lines: (s.lines || []).filter(l => !(l && typeof l === 'object' && l.type === 'tabref' && l.name === name)),
      })),
    });
  }, [song, library, emit, confirm]);

  const handleEditorSave = useCallback((saved) => {
    const tab = tabObjectFromEditor(saved);
    // Carry the chosen instrument so it round-trips through the .md format and
    // can be filtered in the chart/practice/live views.
    if (editorFor.instrument) tab.instrument = editorFor.instrument;
    if (editorFor.mode === 'new') createTab(tab);
    else updateTabContent(editorFor.name, tab);
    setEditorFor(null);
  }, [editorFor, createTab, updateTabContent]);

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start a song in the Advanced tab to add tabs</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Create row — pick an instrument and add a new library tab. */}
      <div className="shrink-0 flex flex-wrap items-end gap-3 pl-3 pr-6 py-3 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-200)]">
        <label className="flex flex-col gap-1">
          <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">Instrument</span>
          <div className="flex gap-1">
            {Object.entries(TAB_INSTRUMENTS).map(([id, cfg]) => (
              <button
                key={id}
                type="button"
                onClick={() => setInstrument(id)}
                className={`px-2.5 py-1 rounded-md text-label-12 font-semibold cursor-pointer border ${instrument === id ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)] border-[var(--ds-gray-400)]'}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </label>
        <Button
          variant="brand"
          size="sm"
          onClick={() => setEditorFor({
            mode: 'new',
            tab: null,
            strings: TAB_INSTRUMENTS[instrument].strings,
            tunings: TAB_INSTRUMENTS[instrument].tunings,
            instrument,
            counts: TAB_INSTRUMENTS[instrument].counts,
          })}
        >
          + New tab
        </Button>
        <p className="text-label-10 text-[var(--ds-gray-500)] ml-auto self-center max-w-[280px]">
          Saved tabs are reusable blocks — place them into sections from Arrange’s “+ Add”.
        </p>
      </div>

      {/* Library */}
      <div className="flex-1 overflow-auto pl-3 pr-6 py-4">
        {library.length === 0 ? (
          <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0">No tabs yet. Pick an instrument, then “New tab”.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {library.map((entry) => {
            const instr = entry.tab?.instrument || instrumentForStrings(entry.tab?.strings?.length);
            const refs = countRefs(song.sections, entry.name);
            const isRenaming = renaming?.name === entry.name;
            return (
              <div key={entry.name} className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={e => setRenaming({ name: entry.name, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') renameTab(entry.name, renaming.value); else if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={() => renameTab(entry.name, renaming.value)}
                        className="text-label-13 font-bold bg-[var(--ds-gray-100)] border border-[var(--color-brand-border)] rounded-md px-1.5 py-0.5 text-[var(--ds-gray-1000)] outline-none min-w-0 w-[140px]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRenaming({ name: entry.name, value: entry.name })}
                        title="Rename"
                        className="text-label-13 font-bold text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0 truncate hover:text-[var(--color-brand-text)]"
                      >
                        {entry.name}
                      </button>
                    )}
                    <span className="text-label-10 text-[var(--ds-gray-500)] shrink-0">{TAB_INSTRUMENTS[instr]?.label || 'Guitar'}</span>
                    <span className="text-label-10 text-[var(--ds-gray-500)] shrink-0">· {refs === 0 ? 'unused' : `${refs} ${refs === 1 ? 'placement' : 'placements'}`}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton variant="ghost" size="xs" aria-label="Edit tab" title="Edit"
                      onClick={() => setEditorFor({ mode: 'edit', name: entry.name, tab: entry.tab, strings: entry.tab.strings.map(s => s.note), tunings: TAB_INSTRUMENTS[instr].tunings, instrument: instr, counts: TAB_INSTRUMENTS[instr].counts })}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton variant="error" size="xs" aria-label="Delete tab" title="Delete" onClick={() => deleteTab(entry.name)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <TabBlock data={entry.tab} />
              </div>
            );
          })}
          </div>
        )}
      </div>

      {editorFor && (
        <TabGridEditor
          initialTab={editorFor.tab}
          strings={editorFor.strings}
          tunings={editorFor.tunings}
          instrument={editorFor.instrument}
          counts={editorFor.counts}
          subdivision={subdivision}
          time={editorFor.tab?.time || song.time || '4/4'}
          onSave={handleEditorSave}
          onClose={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}
